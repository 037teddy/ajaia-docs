# AI workflow note

> DRAFT: Teddy, edit this into your own words before submitting. It records what actually happened in the build session.

## Tools used

- **Claude Code (desktop app)** as a pair programmer: scaffolding, writing the first drafts of the server and React components, running tests and builds, and driving a browser to click through the app.
- Library docs (TipTap, mammoth, Node `node:sqlite`) to confirm APIs.

## Where AI materially sped things up

- **Scaffolding and boilerplate:** Express routes, the SQLite schema, the React components and the CSS were drafted in minutes, which left the timebox for product decisions and verification.
- **Test writing:** the API integration tests (sharing roles, 409 conflicts, sanitization, import) were drafted together with the routes, so the access rules had coverage from the start.
- **Browser verification:** the agent signed in as each demo user in a browser and checked the owned/shared lists, the share dialog, persistence after reload, and view-only mode.

## What I changed or rejected

- **Dependency choice:** rejected `better-sqlite3` (a native build on Windows and on the deploy host) in favor of Node's built-in `node:sqlite`. Pinned TipTap to v2 because v3 changes how toolbar active states re-render.
- **Express 4 async errors:** the first draft of the import route threw inside an `async` handler, which Express 4 doesn't catch, so a bad upload would hang the request. Wrapped it to pass errors to `next`.
- **Version conflict at install:** the latest `@vitejs/plugin-react` needs Vite 8. Pinned plugin v4 instead of forcing peer deps.
- **Share dialog re-fetch loop:** the effect depended on an inline `onClose` prop that changes on every editor re-render (every autosave status change), so it would refetch constantly. Moved it to a ref.
- **Seed data bug, caught in browser testing:** stripping newlines from the seed HTML glued words together ("editorand"). Fixed the whitespace handling.
- **Circular import** between `App.jsx` and `DocList.jsx` (for `navigate`): moved it into a tiny `nav.js`.
- **Scope pushback:** kept real-time collaboration out of scope and added optimistic version checks instead, a deliberate judgment call rather than letting the AI chase a bigger feature.

## How I verified correctness and quality

- **Automated:** `npm test`, 9 API tests on an in-memory DB covering auth, all three roles, revoke, 404-vs-403 behavior, stale-save 409, XSS sanitization, validation, and import.
- **Manual in a real browser:** signed in as Alice/Bob/Carol and checked owned vs shared lists, autosave status, formatting surviving a hard reload, the share dialog (add/change role/remove), and that the viewer's editor is not editable and has no toolbar.
- **Import:** checked `.md` and `.txt` in tests, and checked `.docx` by generating a real Word file and converting it (bold preserved, filename becomes the title).
- **Production build:** `npm run build` + `npm start` serving the built app, the same path Render runs.
