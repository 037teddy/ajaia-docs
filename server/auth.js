import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

export function newToken() {
  return randomBytes(24).toString('base64url');
}

/** Express middleware: resolves `Authorization: Bearer <token>` to req.user or 401s. */
export function requireAuth(db) {
  const stmt = db.prepare(
    `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
  );
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const user = token ? stmt.get(token) : null;
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    req.user = user;
    req.token = token;
    next();
  };
}
