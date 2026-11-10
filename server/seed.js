import { randomUUID } from 'node:crypto';
import { hashPassword } from './auth.js';
import { tx } from './db.js';

/** Demo accounts. These are test credentials for reviewers, not secrets. */
export const DEMO_PASSWORD = 'demo1234';
export const DEMO_USERS = [
  { email: 'alice@ajaia.test', name: 'Alice Johnson' },
  { email: 'bob@ajaia.test', name: 'Bob Smith' },
  { email: 'carol@ajaia.test', name: 'Carol Lee' },
];

const WELCOME = `<h1>Welcome to Ajaia Docs</h1>
<p>This document is owned by <strong>Alice</strong> and shared with <strong>Bob</strong> as an <em>editor</em>
and with <strong>Carol</strong> as a <em>viewer</em>.</p>
<h2>Try these</h2>
<ul><li>Format text with <strong>bold</strong>, <em>italic</em> and <u>underline</u></li>
<li>Use headings and lists from the toolbar</li>
<li>Import a <code>.txt</code>, <code>.md</code> or <code>.docx</code> file from the home page</li></ul>
<ol><li>Sign in as Alice and click <strong>Share</strong></li><li>Sign in as Bob or Carol to see the shared document</li></ol>`;

/** Idempotent: creates demo users (and one shared demo document) only if the users table is empty. */
export function seed(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return false;
  tx(db, () => {
    const insertUser = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)');
    const ids = DEMO_USERS.map((u) => Number(insertUser.run(u.email, u.name, hashPassword(DEMO_PASSWORD)).lastInsertRowid));
    const docId = randomUUID();
    db.prepare('INSERT INTO documents (id, owner_id, title, content) VALUES (?, ?, ?, ?)').run(
      docId, ids[0], 'Welcome to Ajaia Docs', WELCOME.replace(/>\n</g, '><').replace(/\n/g, ' '),
    );
    const share = db.prepare('INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, ?)');
    share.run(docId, ids[1], 'editor');
    share.run(docId, ids[2], 'viewer');
  });
  return true;
}
