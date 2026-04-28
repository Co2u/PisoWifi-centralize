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
});

// ZeroTier Sync
router.post('/zerotier-sync', async (req, res) => {
  const { zt_token, zt_network_id, default_username, default_password } = req.body;
  if (!zt_token || !zt_network_id || !default_username || !default_password) {
    return res.status(400).json({ error: 'Missing required configuration for ZeroTier sync' });
  }

  try {
    const axios = (await import('axios')).default;
    const ztRes = await axios.get(`https://my.zerotier.com/api/v1/network/${zt_network_id}/member`, {
      headers: { Authorization: `Bearer ${zt_token}` }
    });

    const members = ztRes.data;
    let addedCount = 0;
    let updateCount = 0;

    const existingDevices = db.prepare('SELECT id, zerotier_ip FROM devices').all() as any[];
    const ipMap = new Map(existingDevices.map(d => [d.zerotier_ip, d.id]));

    for (const member of members) {
      // Only care about authorized members with assigned IPs
      if (member.config && member.config.authorized && member.config.ipAssignments && member.config.ipAssignments.length > 0) {
        const ip = member.config.ipAssignments[0];
        const name = member.name || member.nodeId; // fallback to node id if no name
        const description = member.description || '';

        if (ipMap.has(ip)) {
          // IP already exists, maybe update name? Optional. For now let's just update the name
          db.prepare('UPDATE devices SET name = ?, location = ? WHERE id = ?')
            .run(name, description, ipMap.get(ip));
          updateCount++;
        } else {
          // New device!
          db.prepare('INSERT INTO devices (name, location, zerotier_ip, username, password) VALUES (?, ?, ?, ?, ?)')
            .run(name, description, ip, default_username, default_password);
          addedCount++;
        }
      }
    }

    res.json({ success: true, added: addedCount, updated: updateCount });
  } catch (err: any) {
    console.error('ZeroTier sync error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.message || err.message || 'ZeroTier sync failed' });
  }
});

export default router;
