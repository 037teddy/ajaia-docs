# Ajaia Docs

A lightweight collaborative document editor: create, format, import and share documents in the browser.

**Live demo:** _LIVE_URL_ (Render free tier, so the first request after a period of no traffic can take ~30–50 s while the instance wakes up)

## Demo accounts

All demo accounts use the password **`demo1234`**. The login page also has one-click buttons for each.

| User  | Email              | What they show |
|-------|--------------------|----------------|
| Alice | alice@ajaia.test   | Owns the seeded "Welcome to Ajaia Docs" document |
| Bob   | bob@ajaia.test     | Has **edit** access to Alice's welcome doc |
| Carol | carol@ajaia.test   | Has **view-only** access to Alice's welcome doc |

**Suggested review path:** sign in as Alice → create a document, format it, rename it → **Share** it with `bob@ajaia.test` → sign out, sign in as Bob → it appears under **Shared with me** and is editable. Sign in as Carol and open the welcome doc to see view-only mode.

## Features

- **Documents:** create, rename (click the title), edit, delete (owner only). Autosaves 0.8 s after you stop typing; `Ctrl/Cmd+S` saves immediately. A status shows *Saving… / All changes saved / Not saved: reason*.
- **Rich text (TipTap/ProseMirror):** bold, italic, underline, strikethrough, Heading 1–3, bulleted and numbered lists, quote, code block, horizontal rule, undo/redo, clear formatting. Standard keyboard shortcuts work.
- **File import:** **Import file…** on the home page turns a **`.txt`, `.md` or `.docx`** file (max 2 MB) into a new editable document, keeping headings, bold/italic and lists. Other types are rejected with a clear message. The file is converted, not stored as an attachment.
- **Sharing:** the owner shares by email with **Can edit** or **Can view**, can change the role or remove access. The home page separates **My documents** from **Shared with me**, and shows who owns each shared doc and your access level.
- **Persistence:** SQLite. Documents are stored as sanitized HTML, so formatting survives reloads.
- **Safety:** the server checks access on every request (no access → 404, so it doesn't reveal that a doc exists). Viewers can't save (403). All stored HTML is sanitized against an allow-list. Stale saves are rejected with 409 instead of silently overwriting (see [ARCHITECTURE.md](ARCHITECTURE.md)).

## Run locally

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`; developed on Node 24). No other services needed.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The API runs on :3001 and Vite proxies `/api` to it. The database is created at `data/ajaia.db` and seeded with the demo accounts on first start. Delete the `data/` folder to reset.

Production-style run (one server for both API and UI):

```bash
npm run build
npm start
```

Then open http://localhost:3001.

### Tests

```bash
npm test
```

9 API integration tests (Node's built-in test runner + supertest, in-memory SQLite) cover: login, owner create/edit/reopen with formatting preserved, the share → edit → view-only → revoke flow, the 404 for unshared users, stale-save conflict (409), HTML sanitization, title validation, and `.md`/`.txt` import plus rejection of unsupported types.

## Deployment (Render)

`render.yaml` defines a single free web service: `npm ci --include=dev && npm run build`, then `npm start`. Express serves both `/api` and the built React app.

**Persistence caveat:** Render's free tier has no persistent disk, so the SQLite file is lost when the service restarts or redeploys. On boot it re-seeds the demo users and welcome doc. Data persists across refreshes and between users while the instance is running, which is enough to review the flows. For production I'd switch `DB_PATH` to a mounted disk or move to Postgres. The data-access code is small and in one file.

## Project layout

```
server/
  index.js        boot: open DB, seed, serve API + built client
  app.js          Express app: auth, documents, sharing, import, errors
  db.js           SQLite schema
  auth.js         scrypt password hashing, bearer-token middleware
  importers.js    .txt/.md/.docx → sanitized HTML
  seed.js         demo users + shared welcome doc
  test/           API tests
client/src/
  App.jsx         session + hash routing
  components/     Login, DocList, DocEditor, Toolbar, ShareDialog
```

## Known limitations

See [ARCHITECTURE.md](ARCHITECTURE.md#what-i-deliberately-cut) for what was cut and what I'd build next.
