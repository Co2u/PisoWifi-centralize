import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, username: user.username });
});

router.put('/credentials', authenticateToken, (req: any, res: any) => {
  const { currentPassword, newUsername, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || (!newUsername && !newPassword)) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const valid = bcrypt.compareSync(currentPassword, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Incorrect current password' });
  }

  const updateUsername = newUsername || user.username;
  let updatePassword = user.password;

  if (newPassword) {
    updatePassword = bcrypt.hashSync(newPassword, 10);
  }

  try {
    db.prepare('UPDATE users SET username = ?, password = ? WHERE id = ?').run(updateUsername, updatePassword, userId);
    res.json({ success: true, message: 'Credentials updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Middleware for protecting routes
export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

export default router;
