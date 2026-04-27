import axios from 'axios';
import * as cheerio from 'cheerio';
import db from './db.js';

const REQUEST_TIMEOUT = 10000; // 10 seconds

export async function scrapeDevice(deviceId: number) {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any;
  if (!device) return { success: false, error: 'Device not found' };

  try {
    const baseUrl = `http://${device.zerotier_ip}`;
    
    // In a real PISOFi system, you'd perform a login POST request to get a session cookie,
    // and then fetch the statistics page.
    // Example:
    /*
    const loginRes = await axios.post(`${baseUrl}/admin/login`, {
      username: device.username,
      password: device.password
    }, { timeout: REQUEST_TIMEOUT });
    const cookie = loginRes.headers['set-cookie'];
    
    const statsRes = await axios.get(`${baseUrl}/admin/income`, {
      headers: { Cookie: cookie },
      timeout: REQUEST_TIMEOUT
    });
    const $ = cheerio.load(statsRes.data);
    const incomeString = $('#daily-income').text() || '0';
    */

    // --- MOCK SCRAPING LOGIC FOR DEVELOPMENT (since we are in an isolated env) ---
    // In a real environment, you replace this with actual login/scraping endpoints.
    let incomeAmount = 0;
    
    // We simulate a ping to the device to check availability.
    // Replace this simulation with the real Axios call above when actual devices are present on the host network.
    const isMockAvailable = Math.random() > 0.1; // 90% chance online
    if (!isMockAvailable) {
      throw new Error(`Connection timeout parsing ${baseUrl}`);
    }

    // MOCK extraction
    incomeAmount = Math.floor(Math.random() * 500) + 100; // Random daily amount
    
    // -------------------------------------------------------------

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
