import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from './auth.js';
import { scheduleCron } from '../cron.js';

const router = Router();
router.use(authenticateToken);

// Get all settings
router.get('/', (req, res) => {
  const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string, value: string }[];
  const settingsObj = settings.reduce((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  res.json(settingsObj);
});

// Update settings
router.post('/', (req, res) => {
  const { cron_interval } = req.body;
  
  if (cron_interval !== undefined) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('cron_interval', String(cron_interval));
    
    // Reschedule cron job
    scheduleCron();
  }
  
  res.json({ success: true });
});

export default router;
