import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath/*, { verbose: console.log }*/); // Remove verbose in production

// Initialize the database schema
export function initDB() {
  db.pragma('journal_mode = WAL');

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  
  db.exec(`INSERT OR IGNORE INTO settings (key, value) VALUES ('cron_interval', '60')`);

  // Users table for dashboard login
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Default admin user (admin/admin) if not exists
  const countUsers = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  if (countUsers.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin', salt);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
  }

  // Devices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      zerotier_ip TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      status TEXT DEFAULT 'offline',
      last_seen DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Income Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS income_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL, -- YYYY-MM-DD
      raw_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(device_id, date),
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);

  // Scrape Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS scrape_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      status TEXT NOT NULL, -- success, fail
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);
}

export default db;
