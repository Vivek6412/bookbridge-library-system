import { sessionCookie } from '../config.js';
import { get, run } from '../db/database.js';
import { normalizeRole } from '../utils/formatters.js';

export async function getCurrentUser(req) {
  const token = req.signedCookies?.[sessionCookie];
  if (!token) return null;

  const session = await get(
    `SELECT sessions.*, users.name, users.email, users.role, users.created_at AS user_created_at
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ?`,
    [token]
  );

  if (!session) return null;

  if (new Date(session.expires_at) <= new Date()) {
    await run('DELETE FROM sessions WHERE id = ?', [token]);
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

export async function requireAuth(req, res, next) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Please log in first.' });
  }

  req.user = user;
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: 'You do not have permission for this action.' });
    }

    next();
  };
}
