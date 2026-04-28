import cron from 'node-cron';
import { scrapeAllDevices } from './scraper.js';
import db from './db.js';

let cronTask: ReturnType<typeof cron.schedule> | null = null;

export function initCron() {
  // Run on startup
  console.log('[CRON] Executing initial startup scrape...');
  scrapeAllDevices().catch(console.error);

  scheduleCron();
}

export function scheduleCron() {
  if (cronTask) {
    cronTask.stop();
  }
  
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'cron_interval'").get() as { value: string } | undefined;
  const intervalMinutes = parseInt(setting?.value || '60', 10) || 60;

  console.log(`[CRON] Scheduling scraper every ${intervalMinutes} minutes.`);
  
  let cronExpression;
  if (intervalMinutes < 60) {
     cronExpression = `*/${intervalMinutes} * * * *`;
  } else if (intervalMinutes === 60) {
     cronExpression = `0 * * * *`;
  } else {
     const hours = Math.floor(intervalMinutes / 60);
     cronExpression = `0 */${hours} * * *`;
  }

  cronTask = cron.schedule(cronExpression, async () => {
    console.log('[CRON] Starting periodic device scrape...');
    await scrapeAllDevices();
    console.log('[CRON] Completed periodic device scrape.');
  });
}
