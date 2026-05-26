import crypto from 'node:crypto';
import { sessionCookie, isProduction } from '../config.js';
import { insert, run } from '../db/database.js';
import { nowIso } from './helpers.js';

export function setSessionCookie(res, token, expiresAt) {
  res.cookie(sessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    expires: new Date(expiresAt),
    signed: true
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(sessionCookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  });
}

export async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  const expiresAt = expires.toISOString();

  await insert(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [token, userId, expiresAt, nowIso()]
  );
  setSessionCookie(res, token, expiresAt);
}
