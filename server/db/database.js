import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import initSqlJs from 'sql.js';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'library.sqlite');
const isPostgres = Boolean(process.env.DATABASE_URL);

let SQL;
let db;
let pg;

export async function initDatabase() {
  if (isPostgres) {
    pg = neon(process.env.DATABASE_URL);
    await initPostgres();
    return;
  }

  await initLocalSqlite();
}

async function initLocalSqlite() {
  fs.mkdirSync(dataDir, { recursive: true });

  SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)
  });

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      issued_to TEXT,
      issued_user_id INTEGER,
      due_date TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS book_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT NOT NULL,
      decided_at TEXT,
      decided_by INTEGER,
      returned_at TEXT
    );
  `);

  migrateSqliteColumn('users', 'role', "TEXT NOT NULL DEFAULT 'student'");
  migrateSqliteColumn('books', 'issued_user_id', 'INTEGER');
  migrateSqliteColumn('book_requests', 'returned_at', 'TEXT');

  persistDatabase();
}

async function initPostgres() {
  await pg.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      created_at TEXT NOT NULL
    )
  `);

  await pg.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await pg.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      issued_to TEXT,
      issued_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await pg.query(`
    CREATE TABLE IF NOT EXISTS book_requests (
      id SERIAL PRIMARY KEY,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT NOT NULL,
      decided_at TEXT,
      decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      returned_at TEXT
    )
  `);

  await pg.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'");
  await pg.query('ALTER TABLE books ADD COLUMN IF NOT EXISTS issued_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
  await pg.query('ALTER TABLE book_requests ADD COLUMN IF NOT EXISTS returned_at TEXT');
}

function migrateSqliteColumn(table, column, definition) {
  const columns = sqliteAll(`PRAGMA table_info(${table})`);
  const exists = columns.some((item) => item.name === column);

  if (!exists) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function persistDatabase() {
  if (!isPostgres) {
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  }
}

export async function all(sql, params = []) {
  if (isPostgres) {
    return pg.query(toPostgresParams(sql), params);
  }

  return sqliteAll(sql, params);
}

export async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

export async function run(sql, params = []) {
  if (isPostgres) {
    await pg.query(toPostgresParams(sql), params);
    return;
  }

  db.run(sql, params);
  persistDatabase();
}

export async function insert(sql, params = []) {
  if (isPostgres) {
    const rows = await pg.query(`${toPostgresParams(sql)} RETURNING id`, params);
    return rows[0]?.id;
  }

  db.run(sql, params);
  const row = sqliteAll('SELECT last_insert_rowid() AS id')[0];
  persistDatabase();
  return Number(row.id);
}

function sqliteAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();
  return rows;
}

function toPostgresParams(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
