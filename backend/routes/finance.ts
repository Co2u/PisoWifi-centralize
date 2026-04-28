import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from './auth.js';
import { scrapeDevice, scrapeAllDevices } from '../scraper.js';

const router = Router();
router.use(authenticateToken);

// Trigger manual scrape all
router.post('/scrape/run', async (req, res) => {
  const results = await scrapeAllDevices();
  res.json({ success: true, results });
});

// Trigger manual scrape single
router.post('/scrape/run/:id', async (req, res) => {
  const result = await scrapeDevice(Number(req.params.id));
  res.json(result);
});

// Analytics Dashboard Overview
router.get('/analytics/overview', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const totalIncomeTodayRow = db.prepare('SELECT SUM(amount) as total FROM income_logs WHERE date = ?').get(today) as any;
  const totalIncomeAllTimeRow = db.prepare('SELECT SUM(amount) as total FROM income_logs').get() as any;
  
  const devicesStatus = db.prepare('SELECT status, COUNT(*) as count FROM devices GROUP BY status').all() as any[];
  
  res.json({
    incomeToday: totalIncomeTodayRow?.total || 0,
    incomeAllTime: totalIncomeAllTimeRow?.total || 0,
    onlineDevices: devicesStatus.find(s => s.status === 'online')?.count || 0,
    offlineDevices: devicesStatus.find(s => s.status === 'offline')?.count || 0,
  });
});

// Income by Device (Today)
router.get('/income/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const logs = db.prepare(`
    SELECT d.id as device_id, d.name, d.location, i.amount 
    FROM devices d
    LEFT JOIN income_logs i ON d.id = i.device_id AND i.date = ?
    ORDER BY i.amount DESC
  `).all(today);
  
  res.json(logs);
});

// Get historical income for a device
router.get('/income/device/:id', (req, res) => {
  const { startDate, endDate, days } = req.query;
  
  if (startDate && endDate) {
    const logs = db.prepare('SELECT * FROM income_logs WHERE device_id = ? AND date >= ? AND date <= ? ORDER BY date DESC').all(req.params.id, startDate, endDate);
    return res.json(logs);
  }

  const limitDays = parseInt(days as string) || 30;
  const logs = db.prepare('SELECT * FROM income_logs WHERE device_id = ? ORDER BY date DESC LIMIT ?').all(req.params.id, limitDays);
  res.json(logs);
});

// Get scrape logs for a device
router.get('/scrape-logs/:id', (req, res) => {
  const logs = db.prepare('SELECT * FROM scrape_logs WHERE device_id = ? ORDER BY timestamp DESC LIMIT 50').all(req.params.id);
  res.json(logs);
});

// Analytics chart data (Total income over time)
router.get('/analytics/chart', (req, res) => {
  const { startDate, endDate, days } = req.query;
  
  if (startDate && endDate) {
    const data = db.prepare(`
      SELECT date, SUM(amount) as total 
      FROM income_logs 
      WHERE date >= ? AND date <= ?
      GROUP BY date 
      ORDER BY date DESC 
    `).all(startDate, endDate);
    return res.json(data.reverse());
  }

  const limitDays = parseInt(days as string) || 7;
  const data = db.prepare(`
    SELECT date, SUM(amount) as total 
    FROM income_logs 
    GROUP BY date 
    ORDER BY date DESC 
    LIMIT ?
  `).all(limitDays);
  
  res.json(data.reverse());
});

export default router;
