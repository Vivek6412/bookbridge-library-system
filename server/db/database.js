import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'library.sqlite');

let SQL;
let db;

export async function initDatabase() {
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

  migrateColumn('users', 'role', "TEXT NOT NULL DEFAULT 'student'");
  migrateColumn('books', 'issued_user_id', 'INTEGER');
  migrateColumn('book_requests', 'returned_at', 'TEXT');

  persistDatabase();
}

function migrateColumn(table, column, definition) {
  const columns = all(`PRAGMA table_info(${table})`);
  const exists = columns.some((item) => item.name === column);

  if (!exists) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function persistDatabase() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();
  return rows;
}

export function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

export function run(sql, params = []) {
  db.run(sql, params);
  persistDatabase();
}

export function insert(sql, params = []) {
  db.run(sql, params);
  const row = get('SELECT last_insert_rowid() AS id');
  persistDatabase();
  return Number(row.id);
}
