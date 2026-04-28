import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import db from './db.js';

const REQUEST_TIMEOUT = 15000; // 15 seconds

export async function scrapeDevice(deviceId: number) {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any;
  if (!device) return { success: false, error: 'Device not found' };

  try {
    let baseUrl = device.zerotier_ip.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `http://${baseUrl}`;
    }
    baseUrl = baseUrl.replace(/\/+$/, ""); // Remove trailing slash if any
    
    // Real PISOFi scraping logic
    
    // Create an axios instance with cookie jar for session management
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));

    // 0. Fetch the login page to get CSRF token and initial cookies
    const loginPageRes = await client.get(`${baseUrl}/auth/signin/`, { timeout: REQUEST_TIMEOUT });
    
    const $login = cheerio.load(loginPageRes.data);
    let csrfName = '';
    let csrfValue = '';
    
    // Look for hidden CSRF input
    $login('input[type="hidden"]').each((_, el) => {
      const name = $login(el).attr('name');
      const val = $login(el).attr('value');
      // Common CSRF names: csrf_test_name, csrf_token_name, etc.
      if (name && name.toLowerCase().includes('csrf')) {
        csrfName = name;
        csrfValue = val || '';
      }
    });

    // CodeIgniter CSRF Token via Cookie (sometimes the hidden input is named differently or we just need the cookie)
    // If we didn't find a hidden input, let's see if there's a CSRF cookie we can use for the post body
    if (!csrfName) {
      const cookies = await jar.getCookies(baseUrl);
      const csrfCookie = cookies.find((c: any) => c.key.toLowerCase().includes('csrf'));
      if (csrfCookie) {
         csrfName = csrfCookie.key; // e.g., csrf_cookie_name
         csrfValue = csrfCookie.value;
      } /* Fallback for pisofi is usually 'csrf_test_name' */
      else {
         csrfName = 'csrf_test_name';
      }
    }

    // 1. Authenticate to get session cookie
    const params = new URLSearchParams();
    params.append('username', device.username);
    params.append('password', device.password);
    if (csrfName && csrfValue) {
      params.append(csrfName, csrfValue);
    }

    const loginRes = await client.post(`${baseUrl}/auth/signin/`, params, { 
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    // Some versions redirect on success, or return 200 with dashboard.
    // Ensure we reached the dashboard or successful login.
    if (loginRes.data.includes('Invalid credentials') || loginRes.data.includes('Incorrect login')) {
       throw new Error('Authentication failed: Invalid credentials');
    }

    // 2. Fetch the dashboard or income statistics page
    // Note: The specific URL and CSS selectors depend on the exact PISOFi firmware version.
    const statsRes = await client.get(`${baseUrl}/admin/system`, {
      timeout: REQUEST_TIMEOUT
    });

    const $ = cheerio.load(statsRes.data);
    
    // 3. Extract the daily income text
    // We attempt multiple common selectors where PisoFi might store the daily income
    let incomeText = '';
    const salesHeader = $('*:contains("Today\'s Sales")').last();
    if (salesHeader.length > 0) {
       // The amount "186" is usually near the header, so grabbing the parent's text is a safe bet to capture the digits.
       incomeText = salesHeader.parent().text();
    }

    if (!incomeText) {
      incomeText = $('#daily-income').text() || 
                      $('.daily-sales').text() || 
                      $('div:contains("Daily Income")').next().text() || 
                      $('div:contains("Income Today")').next().text() ||
                      $('.income-today').text() ||
                      '0';
    }

    // Clean up the string to extract numbers (e.g. "Today's Sales 1,234.50" -> 1234.50)
    incomeText = incomeText.replace(/[^0-9.]/g, '');
    let incomeAmount = parseFloat(incomeText);

    if (isNaN(incomeAmount)) {
        incomeAmount = 0; // Fallback if parsing fails
    }

    // Store the data
    const today = new Date().toISOString().split('T')[0];
    
    const existingLog = db.prepare('SELECT id FROM income_logs WHERE device_id = ? AND date = ?').get(device.id, today);
    if (existingLog) {
      db.prepare('UPDATE income_logs SET amount = ?, raw_value = ?, created_at = CURRENT_TIMESTAMP WHERE device_id = ? AND date = ?')
        .run(incomeAmount, JSON.stringify({ source: 'scrape' }), device.id, today);
    } else {
      db.prepare('INSERT INTO income_logs (device_id, amount, date, raw_value) VALUES (?, ?, ?, ?)')
        .run(device.id, incomeAmount, today, JSON.stringify({ source: 'scrape' }));
    }

    // Update device status
    db.prepare("UPDATE devices SET status = 'online', last_seen = CURRENT_TIMESTAMP WHERE id = ?").run(device.id);

    // Write scrape log success
    db.prepare('INSERT INTO scrape_logs (device_id, status, message) VALUES (?, ?, ?)')
      .run(device.id, 'success', `Scraped daily income: ₱${incomeAmount}`);

    return { success: true, amount: incomeAmount };

  } catch (err: any) {
    let errorMsg = err.message || 'Unknown scrape error';
    if (err.response) {
      // Axios error
      errorMsg = `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`;
    }
    
    // Update device status
    db.prepare("UPDATE devices SET status = 'offline' WHERE id = ?").run(device.id);
    
    // Write scrape log failure
    db.prepare('INSERT INTO scrape_logs (device_id, status, message) VALUES (?, ?, ?)')
      .run(device.id, 'fail', errorMsg);
      
    return { success: false, error: errorMsg };
  }
}

export async function scrapeAllDevices() {
  const devices = db.prepare('SELECT id FROM devices').all() as { id: number }[];
  const results = [];
  for (const device of devices) {
    results.push(await scrapeDevice(device.id));
  }
  return results;
}
