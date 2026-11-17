import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let dbInstance = null;

export function getDefaultDbPath() {
  return process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'database.sqlite');
}

export function initDatabase(dbPath = getDefaultDbPath()) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS editions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL UNIQUE,
      voting_start TEXT NOT NULL,
      voting_end TEXT NOT NULL,
      event_date TEXT NOT NULL,
      is_finished INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edition_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS nominees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      is_winner INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edition_id INTEGER NOT NULL,
      nickname TEXT NOT NULL,
      voter_token TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      device_fingerprint TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (edition_id, voter_token),
      FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voter_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      will_win_nominee_id INTEGER,
      want_win_nominee_id INTEGER,
      UNIQUE (voter_id, category_id),
      FOREIGN KEY (voter_id) REFERENCES voters(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (will_win_nominee_id) REFERENCES nominees(id) ON DELETE SET NULL,
      FOREIGN KEY (want_win_nominee_id) REFERENCES nominees(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_categories_edition ON categories(edition_id, display_order);
    CREATE INDEX IF NOT EXISTS idx_nominees_category ON nominees(category_id);
    CREATE INDEX IF NOT EXISTS idx_voters_edition ON voters(edition_id);
    CREATE INDEX IF NOT EXISTS idx_voters_ip_ua ON voters(edition_id, ip_address, user_agent);
    CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id);
    CREATE INDEX IF NOT EXISTS idx_votes_category ON votes(category_id);
  `);

  dbInstance = db;
  return db;
}

export function getDb() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}
