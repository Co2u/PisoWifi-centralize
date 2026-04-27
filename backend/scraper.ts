import axios from 'axios';
import * as cheerio from 'cheerio';
import db from './db.js';

const REQUEST_TIMEOUT = 10000; // 10 seconds

export async function scrapeDevice(deviceId: number) {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any;
  if (!device) return { success: false, error: 'Device not found' };

  try {
    const baseUrl = `http://${device.zerotier_ip}`;
    
    // Real PISOFi scraping logic
    // 1. Authenticate to get session cookie
    const loginRes = await axios.post(`${baseUrl}/admin/login`, {
      username: device.username,
      password: device.password
    }, { 
      timeout: REQUEST_TIMEOUT,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' } // Common for simple admin panels
    });

    const cookies = loginRes.headers['set-cookie'];
    if (!cookies || cookies.length === 0) {
      throw new Error('Authentication failed: No session cookie received');
    }

    // Extract the primary session cookie
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

    // 2. Fetch the dashboard or income statistics page
    // Note: The specific URL and CSS selectors depend on the exact PISOFi firmware version.
    const statsRes = await axios.get(`${baseUrl}/admin/system`, {
      headers: { Cookie: cookieString },
      timeout: REQUEST_TIMEOUT
    });

    const $ = cheerio.load(statsRes.data);
    
    // 3. Extract the daily income text
    // We attempt multiple common selectors where PisoFi might store the daily income
    let incomeText = $('#daily-income').text() || 
                     $('.daily-sales').text() || 
                     $('div:contains("Daily Income")').next().text() || 
                     $('div:contains("Income Today")').next().text() ||
                     $('.income-today').text() ||
                     '0';

    // Clean up the string to extract numbers (e.g. "₱ 1,234.50" -> 1234.50)
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
    const errorMsg = err.message || 'Unknown scrape error';
    
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
