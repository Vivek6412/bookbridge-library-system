import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, initDatabase, insert, run } from './db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 4000);
const sessionCookie = 'library_session';
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 'development-session-secret-change-me';

app.use(express.json());
app.use(cookieParser(sessionSecret));

function nowIso() {
  return new Date().toISOString();
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function cleanText(value) {
  return String(value || '').trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeRole(role) {
  return role === 'admin' ? 'admin' : 'student';
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    createdAt: user.created_at
  };
}

function publicBook(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    status: book.status,
    issuedTo: book.issued_to,
    issuedUserId: book.issued_user_id,
    dueDate: book.due_date,
    createdBy: book.created_by,
    createdAt: book.created_at,
    updatedAt: book.updated_at
  };
}

function publicRequest(request) {
  return {
    id: request.id,
    bookId: request.book_id,
    userId: request.user_id,
    status: request.status,
    requestedAt: request.requested_at,
    decidedAt: request.decided_at,
    returnedAt: request.returned_at,
    studentName: request.student_name,
    studentEmail: request.student_email,
    bookTitle: request.book_title,
    bookAuthor: request.book_author,
    dueDate: request.due_date,
    issuedTo: request.issued_to
  };
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(sessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    expires: new Date(expiresAt),
    signed: true
  });
}

function clearSessionCookie(res) {
  res.clearCookie(sessionCookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  });
}

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  const expiresAt = expires.toISOString();

  insert(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [token, userId, expiresAt, nowIso()]
  );
  setSessionCookie(res, token, expiresAt);
}

function getCurrentUser(req) {
  const token = req.signedCookies?.[sessionCookie];
  if (!token) return null;

  const session = get(
    `SELECT sessions.*, users.name, users.email, users.role, users.created_at AS user_created_at
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ?`,
    [token]
  );

  if (!session) return null;

  if (new Date(session.expires_at) <= new Date()) {
    run('DELETE FROM sessions WHERE id = ?', [token]);
    return null;
  }

  return {
    id: session.user_id,
    name: session.name,
    email: session.email,
    role: normalizeRole(session.role),
    created_at: session.user_created_at
  };
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Please log in first.' });
  }

  req.user = user;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: 'You do not have permission for this action.' });
    }

    next();
  };
}

function getRequestById(id) {
  return get(
    `SELECT book_requests.*, users.name AS student_name, users.email AS student_email,
            books.title AS book_title, books.author AS book_author,
            books.due_date, books.issued_to
     FROM book_requests
     JOIN users ON users.id = book_requests.user_id
     JOIN books ON books.id = book_requests.book_id
     WHERE book_requests.id = ?`,
    [id]
  );
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/signup', async (req, res) => {
  const name = cleanText(req.body.name);
  const email = cleanText(req.body.email).toLowerCase();
  const password = String(req.body.password || '');
  const role = normalizeRole(req.body.role);

  if (name.length < 2) {
    return res.status(400).json({ message: 'Name must be at least 2 characters.' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  const existing = get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const hash = await bcrypt.hash(password, 12);
  const userId = insert(
    'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    [name, email, hash, role, nowIso()]
  );

  createSession(res, userId);
  const user = get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [userId]);
  res.status(201).json({ user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = cleanText(req.body.email).toLowerCase();
  const password = String(req.body.password || '');

  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  createSession(res, user.id);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.signedCookies?.[sessionCookie];
  if (token) {
    run('DELETE FROM sessions WHERE id = ?', [token]);
  }

  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: publicUser(getCurrentUser(req)) });
});

app.get('/api/books', requireAuth, (req, res) => {
  const q = cleanText(req.query.q).toLowerCase();
  const books = all(
    `SELECT * FROM books
     WHERE ? = ''
        OR lower(title) LIKE ?
        OR lower(author) LIKE ?
        OR lower(COALESCE(issued_to, '')) LIKE ?
     ORDER BY created_at DESC`,
    [q, `%${q}%`, `%${q}%`, `%${q}%`]
  );

  res.json({ books: books.map(publicBook) });
});

app.post('/api/books', requireAuth, requireRole('admin'), (req, res) => {
  const title = cleanText(req.body.title);
  const author = cleanText(req.body.author);

  if (!title || !author) {
    return res.status(400).json({ message: 'Title and author are required.' });
  }

  const timestamp = nowIso();
  const bookId = insert(
    `INSERT INTO books
      (title, author, status, issued_to, issued_user_id, due_date, created_by, created_at, updated_at)
     VALUES (?, ?, 'available', NULL, NULL, NULL, ?, ?, ?)`,
    [title, author, req.user.id, timestamp, timestamp]
  );

  res.status(201).json({
    book: publicBook(get('SELECT * FROM books WHERE id = ?', [bookId]))
  });
});

app.put('/api/books/:id', requireAuth, requireRole('admin'), (req, res) => {
  const title = cleanText(req.body.title);
  const author = cleanText(req.body.author);
  const book = get('SELECT * FROM books WHERE id = ?', [req.params.id]);

  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  if (!title || !author) {
    return res.status(400).json({ message: 'Title and author are required.' });
  }

  run('UPDATE books SET title = ?, author = ?, updated_at = ? WHERE id = ?', [
    title,
    author,
    nowIso(),
    req.params.id
  ]);

  res.json({ book: publicBook(get('SELECT * FROM books WHERE id = ?', [req.params.id])) });
});

app.delete('/api/books/:id', requireAuth, requireRole('admin'), (req, res) => {
  const book = get('SELECT * FROM books WHERE id = ?', [req.params.id]);
  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  run('DELETE FROM books WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/books/:id/issue', requireAuth, requireRole('admin'), (req, res) => {
  const book = get('SELECT * FROM books WHERE id = ?', [req.params.id]);
  const issuedTo = cleanText(req.body.issuedTo || req.body.issued_to);

  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  if (book.status === 'issued') {
    return res.status(409).json({ message: 'This book is already issued.' });
  }

  if (!issuedTo) {
    return res.status(400).json({ message: 'Issued-to name is required.' });
  }

  run(
    `UPDATE books
     SET status = 'issued', issued_to = ?, issued_user_id = NULL, due_date = ?, updated_at = ?
     WHERE id = ?`,
    [issuedTo, addDays(7), nowIso(), req.params.id]
  );

  res.json({ book: publicBook(get('SELECT * FROM books WHERE id = ?', [req.params.id])) });
});

app.post('/api/books/:id/request', requireAuth, requireRole('student'), (req, res) => {
  const book = get('SELECT * FROM books WHERE id = ?', [req.params.id]);

  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  if (book.status !== 'available') {
    return res.status(409).json({ message: 'This book is currently issued.' });
  }

  const existing = get(
    `SELECT * FROM book_requests
     WHERE book_id = ? AND user_id = ? AND status = 'pending'`,
    [req.params.id, req.user.id]
  );

  if (existing) {
    return res.status(409).json({ message: 'You already have a pending request for this book.' });
  }

  const requestId = insert(
    `INSERT INTO book_requests (book_id, user_id, status, requested_at)
     VALUES (?, ?, 'pending', ?)`,
    [req.params.id, req.user.id, nowIso()]
  );

  res.status(201).json({ request: publicRequest(getRequestById(requestId)) });
});

app.get('/api/requests', requireAuth, (req, res) => {
  const query =
    req.user.role === 'admin'
      ? [
          `SELECT book_requests.*, users.name AS student_name, users.email AS student_email,
                  books.title AS book_title, books.author AS book_author,
                  books.due_date, books.issued_to
           FROM book_requests
           JOIN users ON users.id = book_requests.user_id
           JOIN books ON books.id = book_requests.book_id
           ORDER BY book_requests.requested_at DESC`,
          []
        ]
      : [
          `SELECT book_requests.*, users.name AS student_name, users.email AS student_email,
                  books.title AS book_title, books.author AS book_author,
                  books.due_date, books.issued_to
           FROM book_requests
           JOIN users ON users.id = book_requests.user_id
           JOIN books ON books.id = book_requests.book_id
           WHERE book_requests.user_id = ?
           ORDER BY book_requests.requested_at DESC`,
          [req.user.id]
        ];

  res.json({ requests: all(query[0], query[1]).map(publicRequest) });
});

app.post('/api/requests/:id/approve', requireAuth, requireRole('admin'), (req, res) => {
  const request = getRequestById(req.params.id);

  if (!request) {
    return res.status(404).json({ message: 'Request not found.' });
  }

  if (request.status !== 'pending') {
    return res.status(409).json({ message: 'This request has already been handled.' });
  }

  const book = get('SELECT * FROM books WHERE id = ?', [request.book_id]);
  if (!book || book.status !== 'available') {
    return res.status(409).json({ message: 'This book is not available anymore.' });
  }

  const timestamp = nowIso();
  run(
    `UPDATE book_requests
     SET status = 'approved', decided_at = ?, decided_by = ?
     WHERE id = ?`,
    [timestamp, req.user.id, req.params.id]
  );
  run(
    `UPDATE books
     SET status = 'issued', issued_to = ?, issued_user_id = ?, due_date = ?, updated_at = ?
     WHERE id = ?`,
    [request.student_name, request.user_id, addDays(7), timestamp, request.book_id]
  );
  run(
    `UPDATE book_requests
     SET status = 'rejected', decided_at = ?, decided_by = ?
     WHERE book_id = ? AND status = 'pending' AND id != ?`,
    [timestamp, req.user.id, request.book_id, req.params.id]
  );

  res.json({ request: publicRequest(getRequestById(req.params.id)) });
});

app.post('/api/requests/:id/reject', requireAuth, requireRole('admin'), (req, res) => {
  const request = getRequestById(req.params.id);

  if (!request) {
    return res.status(404).json({ message: 'Request not found.' });
  }

  if (request.status !== 'pending') {
    return res.status(409).json({ message: 'This request has already been handled.' });
  }

  run(
    `UPDATE book_requests
     SET status = 'rejected', decided_at = ?, decided_by = ?
     WHERE id = ?`,
    [nowIso(), req.user.id, req.params.id]
  );

  res.json({ request: publicRequest(getRequestById(req.params.id)) });
});

app.post('/api/books/:id/return', requireAuth, requireRole('admin'), (req, res) => {
  const book = get('SELECT * FROM books WHERE id = ?', [req.params.id]);

  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  if (book.status !== 'issued') {
    return res.status(409).json({ message: 'This book is not currently issued.' });
  }

  let fine = 0;
  if (book.due_date) {
    const today = new Date();
    const dueDate = new Date(`${book.due_date}T00:00:00`);
    const daysLate = Math.max(0, Math.ceil((today - dueDate) / 86_400_000));
    fine = daysLate * 10;
  }

  if (book.issued_user_id) {
    run(
      `UPDATE book_requests
       SET status = 'returned', returned_at = ?
       WHERE book_id = ? AND user_id = ? AND status = 'approved'`,
      [nowIso(), req.params.id, book.issued_user_id]
    );
  }

  run(
    `UPDATE books
     SET status = 'available', issued_to = NULL, issued_user_id = NULL, due_date = NULL, updated_at = ?
     WHERE id = ?`,
    [nowIso(), req.params.id]
  );

  res.json({
    fine,
    book: publicBook(get('SELECT * FROM books WHERE id = ?', [req.params.id]))
  });
});

app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ message: 'Request body must be valid JSON.' });
  }

  next(err);
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

await initDatabase();

app.listen(port, () => {
  console.log(`BookBridge server running on http://localhost:${port}`);
});
