import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();

router.use(authenticateToken);

// Get all devices
router.get('/', (req, res) => {
  const devices = db.prepare('SELECT id, name, location, zerotier_ip, status, last_seen FROM devices ORDER BY name ASC').all();
  res.json(devices);
});

// Get single device
router.get('/:id', (req, res) => {
  const device = db.prepare('SELECT id, name, location, zerotier_ip, username, status, last_seen FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

// Create device
router.post('/', (req, res) => {
  const { name, location, zerotier_ip, username, password } = req.body;
  if (!name || !zerotier_ip || !username || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const info = db.prepare('INSERT INTO devices (name, location, zerotier_ip, username, password) VALUES (?, ?, ?, ?, ?)')
      .run(name, location, zerotier_ip, username, password);
    res.json({ id: info.lastInsertRowid, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete device
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update device
router.put('/:id', (req, res) => {
  const { name, location, zerotier_ip, username, password } = req.body;
  try {
    if (password) {
      db.prepare('UPDATE devices SET name = ?, location = ?, zerotier_ip = ?, username = ?, password = ? WHERE id = ?')
        .run(name, location, zerotier_ip, username, password, req.params.id);
    } else {
      db.prepare('UPDATE devices SET name = ?, location = ?, zerotier_ip = ?, username = ? WHERE id = ?')
        .run(name, location, zerotier_ip, username, req.params.id);
    }
    res.json({ success: true });
  } catch(err: any) {
    res.status(500).json({ error: err.message });
  }
})

export default router;
