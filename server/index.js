import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { seed } from './seed.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.DB_PATH || join(root, 'data', 'ajaia.db');
const port = Number(process.env.PORT) || 3001;

const db = openDb(dbPath);
if (seed(db)) console.log('Seeded demo users and welcome document');

const app = createApp(db);

// In production the API also serves the built React app.
const dist = join(root, 'client', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(port, () => console.log(`Ajaia Docs listening on http://localhost:${port} (db: ${dbPath})`));
