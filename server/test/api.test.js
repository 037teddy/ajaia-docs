import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { openDb } from '../db.js';
import { createApp } from '../app.js';
import { seed, DEMO_PASSWORD } from '../seed.js';

let app;
const tokens = {};

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  assert.equal(res.status, 200);
  return res.body.token;
}

const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

before(async () => {
  const db = openDb(':memory:');
  seed(db);
  app = createApp(db);
  tokens.alice = await login('alice@ajaia.test');
  tokens.bob = await login('bob@ajaia.test');
  tokens.carol = await login('carol@ajaia.test');
});

describe('auth', () => {
  test('rejects wrong password and missing token', async () => {
    const bad = await request(app).post('/api/auth/login').send({ email: 'alice@ajaia.test', password: 'nope' });
    assert.equal(bad.status, 401);
    const anon = await request(app).get('/api/documents');
    assert.equal(anon.status, 401);
  });
});

describe('documents and sharing', () => {
  test('owner creates, edits and reopens a document with formatting preserved', async () => {
    const created = await request(app).post('/api/documents').set(as('alice')).send({ title: 'Plan' });
    assert.equal(created.status, 201);
    const { id, version } = created.body.document;

    const html = '<h2>Goals</h2><p><strong>Bold</strong> and <u>under</u></p><ul><li>one</li></ul>';
    const saved = await request(app).patch(`/api/documents/${id}`).set(as('alice')).send({ content: html, version });
    assert.equal(saved.status, 200);

    const reopened = await request(app).get(`/api/documents/${id}`).set(as('alice'));
    assert.equal(reopened.body.document.content, html);
    assert.equal(reopened.body.document.role, 'owner');
  });

  test('sharing grants access with the right role, and non-shared users cannot see the doc', async () => {
    const { body } = await request(app).post('/api/documents').set(as('alice')).send({ title: 'Secret' });
    const doc = body.document;

    // Before sharing, Bob gets 404 (existence is not leaked).
    assert.equal((await request(app).get(`/api/documents/${doc.id}`).set(as('bob'))).status, 404);

    // Only the owner may share.
    const notOwner = await request(app).put(`/api/documents/${doc.id}/shares`).set(as('bob')).send({ email: 'carol@ajaia.test', role: 'viewer' });
    assert.equal(notOwner.status, 404);

    await request(app).put(`/api/documents/${doc.id}/shares`).set(as('alice')).send({ email: 'bob@ajaia.test', role: 'editor' }).expect(200);
    await request(app).put(`/api/documents/${doc.id}/shares`).set(as('alice')).send({ email: 'carol@ajaia.test', role: 'viewer' }).expect(200);

    // Shared docs show up in the "shared" list, not "owned".
    const bobList = await request(app).get('/api/documents').set(as('bob'));
    assert.ok(bobList.body.shared.some((d) => d.id === doc.id && d.role === 'editor'));
    assert.ok(!bobList.body.owned.some((d) => d.id === doc.id));

    // Editor can save; viewer cannot; neither can delete.
    const edit = await request(app).patch(`/api/documents/${doc.id}`).set(as('bob')).send({ content: '<p>hi</p>', version: doc.version });
    assert.equal(edit.status, 200);
    const view = await request(app).patch(`/api/documents/${doc.id}`).set(as('carol')).send({ content: '<p>x</p>', version: edit.body.document.version });
    assert.equal(view.status, 403);
    assert.equal((await request(app).delete(`/api/documents/${doc.id}`).set(as('bob'))).status, 403);

    // Revoking removes access.
    const bobId = (await request(app).get('/api/me').set(as('bob'))).body.user.id;
    await request(app).delete(`/api/documents/${doc.id}/shares/${bobId}`).set(as('alice')).expect(200);
    assert.equal((await request(app).get(`/api/documents/${doc.id}`).set(as('bob'))).status, 404);
  });

  test('stale saves are rejected with 409 instead of silently overwriting', async () => {
    const { body } = await request(app).post('/api/documents').set(as('alice')).send({});
    const { id, version } = body.document;
    await request(app).patch(`/api/documents/${id}`).set(as('alice')).send({ content: '<p>first</p>', version }).expect(200);
    const stale = await request(app).patch(`/api/documents/${id}`).set(as('alice')).send({ content: '<p>second</p>', version });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.document.content, '<p>first</p>');
  });

  test('stored HTML is sanitized', async () => {
    const { body } = await request(app).post('/api/documents').set(as('alice')).send({});
    const res = await request(app).patch(`/api/documents/${body.document.id}`).set(as('alice'))
      .send({ content: '<p onclick="x()">ok</p><script>alert(1)</script><img src=x onerror=alert(1)>', version: body.document.version });
    assert.equal(res.body.document.content, '<p>ok</p>');
  });

  test('validates titles', async () => {
    const empty = await request(app).post('/api/documents').set(as('alice')).send({ title: '   ' });
    assert.equal(empty.status, 400);
    const long = await request(app).post('/api/documents').set(as('alice')).send({ title: 'x'.repeat(201) });
    assert.equal(long.status, 400);
  });
});

describe('file import', () => {
  test('imports markdown as a new formatted document', async () => {
    const res = await request(app).post('/api/documents/import').set(as('alice'))
      .attach('file', Buffer.from('# Notes\n\nSome **bold** text\n\n- a\n- b\n'), 'meeting-notes.md');
    assert.equal(res.status, 201);
    assert.equal(res.body.document.title, 'meeting-notes');
    assert.match(res.body.document.content, /<h1>Notes<\/h1>/);
    assert.match(res.body.document.content, /<strong>bold<\/strong>/);
    assert.match(res.body.document.content, /<ul>/);
  });

  test('imports plain text and escapes HTML', async () => {
    const res = await request(app).post('/api/documents/import').set(as('alice'))
      .attach('file', Buffer.from('line <b>1</b>\n\nline 2'), 'a.txt');
    assert.equal(res.status, 201);
    assert.equal(res.body.document.content, '<p>line &lt;b&gt;1&lt;/b&gt;</p><p>line 2</p>');
  });

  test('rejects unsupported file types', async () => {
    const res = await request(app).post('/api/documents/import').set(as('alice'))
      .attach('file', Buffer.from('%PDF'), 'report.pdf');
    assert.equal(res.status, 415);
    assert.match(res.body.error, /Supported/);
  });
});
