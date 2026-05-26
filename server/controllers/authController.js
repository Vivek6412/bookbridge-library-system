import bcrypt from 'bcryptjs';
import { get, insert, run } from '../db/database.js';
import { cleanText, isValidEmail, nowIso } from '../utils/helpers.js';
import { normalizeRole, publicUser } from '../utils/formatters.js';
import { createSession, clearSessionCookie } from '../utils/session.js';
import { sessionCookie } from '../config.js';
import { getCurrentUser } from '../middleware/auth.js';

export async function signup(req, res) {
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

  const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const hash = await bcrypt.hash(password, 12);
  const userId = await insert(
    'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    [name, email, hash, role, nowIso()]
  );

  await createSession(res, userId);
  const user = await get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [userId]);
  res.status(201).json({ user: publicUser(user) });
}

export async function login(req, res) {
  const email = cleanText(req.body.email).toLowerCase();
  const password = String(req.body.password || '');

  const user = await get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  await createSession(res, user.id);
  res.json({ user: publicUser(user) });
}

export async function logout(req, res) {
  const token = req.signedCookies?.[sessionCookie];
  if (token) {
    await run('DELETE FROM sessions WHERE id = ?', [token]);
  }

  clearSessionCookie(res);
  res.json({ ok: true });
}

export async function me(req, res) {
  res.json({ user: publicUser(await getCurrentUser(req)) });
}
