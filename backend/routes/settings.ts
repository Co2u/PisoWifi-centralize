import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from './auth.js';
import { scheduleCron } from '../cron.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();
router.use(authenticateToken);

const upload = multer({ dest: os.tmpdir() });

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

// Backup database
router.get('/backup', async (req, res) => {
  try {
    const backupName = `backup-${Date.now()}.sqlite`;
    const backupPath = path.join(process.cwd(), backupName);
    
    await db.backup(backupPath);
    
    res.download(backupPath, 'pisowifi-backup.sqlite', (err) => {
      // Clean up file after download
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Failed to generate backup' });
  }
});

// Restore database
router.post('/restore', upload.single('database'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No database file uploaded' });
  }

  const uploadedDbPath = req.file.path;

  try {
    const transaction = db.transaction(() => {
      db.exec(`ATTACH DATABASE '${uploadedDbPath}' AS restoreDb`);
      
      db.exec("PRAGMA foreign_keys = OFF;");
      
      // Clear current data
      db.exec("DELETE FROM income_logs;");
      db.exec("DELETE FROM scrape_logs;");
      db.exec("DELETE FROM devices;");
      db.exec("DELETE FROM users;");
      db.exec("DELETE FROM settings;");

      // Insert data from restore database
      db.exec("INSERT INTO settings SELECT * FROM restoreDb.settings;");
      db.exec("INSERT INTO users SELECT * FROM restoreDb.users;");
      db.exec("INSERT INTO devices SELECT * FROM restoreDb.devices;");
      db.exec("INSERT INTO income_logs SELECT * FROM restoreDb.income_logs;");
      db.exec("INSERT INTO scrape_logs SELECT * FROM restoreDb.scrape_logs;");
      
      db.exec("PRAGMA foreign_keys = ON;");
      db.exec("DETACH DATABASE restoreDb;");
    });
    
    transaction();

    // Clean up uploaded file
    if (fs.existsSync(uploadedDbPath)) {
      fs.unlinkSync(uploadedDbPath);
    }
    
    // Reschedule cron job with restored settings if any
    scheduleCron();

    res.json({ success: true, message: 'Database restored successfully' });
  } catch (error) {
    console.error('Restore error:', error);
    
    // Try to detach in case of error
    try {
      db.exec("DETACH DATABASE restoreDb;");
    } catch (e) {
      // ignore
    }

    if (fs.existsSync(uploadedDbPath)) {
      fs.unlinkSync(uploadedDbPath);
    }
    res.status(500).json({ error: 'Failed to restore database. Ensure it is a valid backup.' });
  }
});

export default router;
