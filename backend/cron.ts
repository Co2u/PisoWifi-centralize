import cron from 'node-cron';
import { scrapeAllDevices } from './scraper.js';

export function initCron() {
  // Run on startup
  console.log('[CRON] Executing initial startup scrape...');
  scrapeAllDevices().catch(console.error);

  // Run every 2 minutes for near real-time updates
  cron.schedule('*/2 * * * *', async () => {
    console.log('[CRON] Starting periodic device scrape...');
    await scrapeAllDevices();
    console.log('[CRON] Completed periodic device scrape.');
  });
}
