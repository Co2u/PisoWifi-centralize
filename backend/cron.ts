import cron from 'node-cron';
import { scrapeAllDevices } from './scraper.js';

export function initCron() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('[CRON] Starting periodic device scrape...');
    await scrapeAllDevices();
    console.log('[CRON] Completed periodic device scrape.');
  });
}
