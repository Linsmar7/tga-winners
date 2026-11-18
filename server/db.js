import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let dbInstance = null;

export const LEGACY_BASELINE_DATE = '2026-11-17T21:00:00.000Z';

export function getDefaultDbPath() {
  return process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'database.sqlite');
}

function hasColumn(db, tableName, columnName) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return cols.some((c) => c.name === columnName);
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
      points_weight INTEGER NOT NULL DEFAULT 5,
      FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS nominees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      external_url TEXT,
      is_winner INTEGER NOT NULL DEFAULT 0,
      decided_at TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edition_id INTEGER NOT NULL,
      user_id INTEGER,
      nickname TEXT NOT NULL,
      voter_token TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      device_fingerprint TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (edition_id, voter_token),
      FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

    CREATE TABLE IF NOT EXISTS side_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edition_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      options_json TEXT NOT NULL DEFAULT '["Sim","Não"]',
      points INTEGER NOT NULL DEFAULT 3,
      correct_option TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      decided_at TEXT,
      FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS side_bet_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voter_id INTEGER NOT NULL,
      side_bet_id INTEGER NOT NULL,
      selected_option TEXT NOT NULL,
      UNIQUE (voter_id, side_bet_id),
      FOREIGN KEY (voter_id) REFERENCES voters(id) ON DELETE CASCADE,
      FOREIGN KEY (side_bet_id) REFERENCES side_bets(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase ON users(LOWER(username));
    CREATE INDEX IF NOT EXISTS idx_categories_edition ON categories(edition_id, display_order);
    CREATE INDEX IF NOT EXISTS idx_nominees_category ON nominees(category_id);
    CREATE INDEX IF NOT EXISTS idx_voters_edition ON voters(edition_id);
    CREATE INDEX IF NOT EXISTS idx_voters_ip_ua ON voters(edition_id, ip_address, user_agent);
    CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id);
    CREATE INDEX IF NOT EXISTS idx_votes_category ON votes(category_id);
    CREATE INDEX IF NOT EXISTS idx_side_bets_edition ON side_bets(edition_id, display_order);
    CREATE INDEX IF NOT EXISTS idx_side_bet_votes_voter ON side_bet_votes(voter_id);
    CREATE INDEX IF NOT EXISTS idx_side_bet_votes_bet ON side_bet_votes(side_bet_id);
  `);

  // Migrações seguras para bancos SQLite existentes
  if (!hasColumn(db, 'voters', 'user_id')) {
    db.exec('ALTER TABLE voters ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;');
  }
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_voters_edition_user ON voters(edition_id, user_id) WHERE user_id IS NOT NULL;'
  );

  if (!hasColumn(db, 'categories', 'points_weight')) {
    db.exec('ALTER TABLE categories ADD COLUMN points_weight INTEGER NOT NULL DEFAULT 5;');
  }

  if (!hasColumn(db, 'nominees', 'external_url')) {
    db.exec('ALTER TABLE nominees ADD COLUMN external_url TEXT;');
  }

  if (!hasColumn(db, 'nominees', 'decided_at')) {
    db.exec('ALTER TABLE nominees ADD COLUMN decided_at TEXT;');
  }

  // Backfill de decided_at para vencedores já marcados antes da migração (base 17/11/2026)
  const legacyWinners = db
    .prepare(
      `SELECT n.id, c.display_order
       FROM nominees n
       INNER JOIN categories c ON c.id = n.category_id
       WHERE n.is_winner = 1 AND (n.decided_at IS NULL OR n.decided_at = '')
       ORDER BY c.display_order ASC, c.id ASC, n.id ASC`
    )
    .all();

  if (legacyWinners.length > 0) {
    const baseMs = new Date(LEGACY_BASELINE_DATE).getTime();
    const updateDecided = db.prepare('UPDATE nominees SET decided_at = ? WHERE id = ?');
    const backfillTx = db.transaction(() => {
      legacyWinners.forEach((row, idx) => {
        const ts = new Date(baseMs + idx * 60_000).toISOString();
        updateDecided.run(ts, row.id);
      });
    });
    backfillTx();
  }

  // Backfill de created_at/updated_at se algum registro legado de voter estiver sem data
  db.prepare(
    `UPDATE voters
     SET created_at = COALESCE(NULLIF(created_at, ''), ?),
         updated_at = COALESCE(NULLIF(updated_at, ''), ?)
     WHERE created_at IS NULL OR created_at = '' OR updated_at IS NULL OR updated_at = ''`
  ).run(LEGACY_BASELINE_DATE, LEGACY_BASELINE_DATE);

  dbInstance = db;
  return db;
}

export function getDb() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}
