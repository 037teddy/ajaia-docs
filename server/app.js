import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { requireAuth, verifyPassword, newToken } from './auth.js';
import { tx } from './db.js';
import { cleanHtml, fileToDocument, MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS } from './importers.js';

const MAX_TITLE = 200;
const MAX_CONTENT_CHARS = 500_000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validTitle(raw) {
  if (typeof raw !== 'string') throw new HttpError(400, 'Title must be a string');
  const title = raw.trim();
  if (!title) throw new HttpError(400, 'Title cannot be empty');
  if (title.length > MAX_TITLE) throw new HttpError(400, `Title must be at most ${MAX_TITLE} characters`);
  return title;
}

/** Build the Express app around an open database. Kept separate from index.js so tests can use an in-memory DB. */
export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    otherUsers: db.prepare('SELECT id, email, name FROM users WHERE id != ? ORDER BY name'),
    ownedDocs: db.prepare(
      `SELECT d.id, d.title, d.updated_at, 'owner' AS role, u.name AS owner_name, u.email AS owner_email,
              (SELECT COUNT(*) FROM document_shares s WHERE s.document_id = d.id) AS share_count
       FROM documents d JOIN users u ON u.id = d.owner_id
       WHERE d.owner_id = ? ORDER BY d.updated_at DESC`,
    ),
    sharedDocs: db.prepare(
      `SELECT d.id, d.title, d.updated_at, s.role, u.name AS owner_name, u.email AS owner_email
       FROM document_shares s
       JOIN documents d ON d.id = s.document_id
       JOIN users u ON u.id = d.owner_id
       WHERE s.user_id = ? ORDER BY d.updated_at DESC`,
    ),
    access: db.prepare(
      `SELECT d.*, u.name AS owner_name, u.email AS owner_email,
              CASE WHEN d.owner_id = :uid THEN 'owner' ELSE s.role END AS role
       FROM documents d
       JOIN users u ON u.id = d.owner_id
       LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = :uid
       WHERE d.id = :id AND (d.owner_id = :uid OR s.user_id IS NOT NULL)`,
    ),
    insertDoc: db.prepare('INSERT INTO documents (id, owner_id, title, content) VALUES (?, ?, ?, ?)'),
    updateDoc: db.prepare(
      `UPDATE documents SET title = ?, content = ?, version = version + 1, updated_at = datetime('now')
       WHERE id = ? AND version = ?`,
    ),
    deleteDoc: db.prepare('DELETE FROM documents WHERE id = ?'),
    shares: db.prepare(
      `SELECT u.id AS user_id, u.email, u.name, s.role FROM document_shares s
       JOIN users u ON u.id = s.user_id WHERE s.document_id = ? ORDER BY u.name`,
    ),
    upsertShare: db.prepare(
      `INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, ?)
       ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role`,
    ),
    deleteShare: db.prepare('DELETE FROM document_shares WHERE document_id = ? AND user_id = ?'),
  };

  /** Load a document the user can see, or throw 404 (we don't reveal whether inaccessible docs exist). */
  function loadDoc(id, user, { need } = {}) {
    const doc = q.access.get({ id, uid: user.id });
    if (!doc) throw new HttpError(404, 'Document not found');
    if (need === 'edit' && doc.role === 'viewer') throw new HttpError(403, 'You have view-only access to this document');
    if (need === 'owner' && doc.role !== 'owner') throw new HttpError(403, 'Only the owner can do that');
    return doc;
  }

  function serializeDoc(doc) {
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      version: doc.version,
      role: doc.role,
      owner: { name: doc.owner_name, email: doc.owner_email },
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    };
  }

  function createDoc(user, title, content) {
    const id = randomUUID();
    q.insertDoc.run(id, user.id, title, content);
    return serializeDoc(loadDoc(id, user));
  }

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // ---- Auth ---------------------------------------------------------------
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      throw new HttpError(400, 'Email and password are required');
    }
    const user = q.userByEmail.get(email.trim());
    if (!user || !verifyPassword(password, user.password_hash)) throw new HttpError(401, 'Invalid email or password');
    const token = newToken();
    q.insertSession.run(token, user.id);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  const auth = requireAuth(db);

  app.post('/api/auth/logout', auth, (req, res) => {
    q.deleteSession.run(req.token);
    res.status(204).end();
  });

  app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));

  app.get('/api/users', auth, (req, res) => res.json({ users: q.otherUsers.all(req.user.id) }));

  // ---- Documents ----------------------------------------------------------
  app.get('/api/documents', auth, (req, res) => {
    res.json({ owned: q.ownedDocs.all(req.user.id), shared: q.sharedDocs.all(req.user.id) });
  });

  app.post('/api/documents', auth, (req, res) => {
    const title = req.body?.title === undefined ? 'Untitled document' : validTitle(req.body.title);
    res.status(201).json({ document: createDoc(req.user, title, '') });
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  app.post('/api/documents/import', auth, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, `Attach a file (${SUPPORTED_EXTENSIONS.join(', ')})`);
      const { title, html } = await fileToDocument(req.file.originalname, req.file.buffer);
      res.status(201).json({ document: createDoc(req.user, title, html) });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/documents/:id', auth, (req, res) => {
    res.json({ document: serializeDoc(loadDoc(req.params.id, req.user)) });
  });

  app.patch('/api/documents/:id', auth, (req, res) => {
    const doc = loadDoc(req.params.id, req.user, { need: 'edit' });
    const body = req.body || {};
    if (!Number.isInteger(body.version)) throw new HttpError(400, 'version (integer) is required');
    const title = body.title === undefined ? doc.title : validTitle(body.title);
    let content = doc.content;
    if (body.content !== undefined) {
      if (typeof body.content !== 'string') throw new HttpError(400, 'content must be a string');
      if (body.content.length > MAX_CONTENT_CHARS) throw new HttpError(413, 'Document is too large');
      content = cleanHtml(body.content);
    }
    const result = q.updateDoc.run(title, content, doc.id, body.version);
    if (result.changes === 0) {
      // Someone else saved since this client loaded the doc. Send back the latest so the client can recover.
      return res.status(409).json({
        error: 'This document was changed elsewhere. Reload to get the latest version.',
        document: serializeDoc(loadDoc(doc.id, req.user)),
      });
    }
    res.json({ document: serializeDoc(loadDoc(doc.id, req.user)) });
  });

  app.delete('/api/documents/:id', auth, (req, res) => {
    const doc = loadDoc(req.params.id, req.user, { need: 'owner' });
    q.deleteDoc.run(doc.id);
    res.status(204).end();
  });

  // ---- Sharing ------------------------------------------------------------
  app.get('/api/documents/:id/shares', auth, (req, res) => {
    const doc = loadDoc(req.params.id, req.user, { need: 'owner' });
    res.json({ shares: q.shares.all(doc.id) });
  });

  app.put('/api/documents/:id/shares', auth, (req, res) => {
    const doc = loadDoc(req.params.id, req.user, { need: 'owner' });
    const { email, role } = req.body || {};
    if (typeof email !== 'string' || !email.trim()) throw new HttpError(400, 'Email is required');
    if (!['viewer', 'editor'].includes(role)) throw new HttpError(400, 'Role must be "viewer" or "editor"');
    const target = q.userByEmail.get(email.trim());
    if (!target) throw new HttpError(404, `No user with email ${email.trim()}`);
    if (target.id === req.user.id) throw new HttpError(400, 'You already own this document');
    tx(db, () => q.upsertShare.run(doc.id, target.id, role));
    res.json({ shares: q.shares.all(doc.id) });
  });

  app.delete('/api/documents/:id/shares/:userId', auth, (req, res) => {
    const doc = loadDoc(req.params.id, req.user, { need: 'owner' });
    q.deleteShare.run(doc.id, Number(req.params.userId));
    res.json({ shares: q.shares.all(doc.id) });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ---- Errors -------------------------------------------------------------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB` : err.message;
      return res.status(400).json({ error: msg });
    }
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });

  return app;
}
