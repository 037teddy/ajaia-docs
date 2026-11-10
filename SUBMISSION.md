# Submission: Ajaia Docs (Teddy Mbayaki)

| Item | Where |
|------|-------|
| Live product URL | _LIVE_URL_ |
| Walkthrough video | see `VIDEO_URL.txt` |
| Source code | this folder (`server/`, `client/`, `package.json`) |
| Setup & run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| Automated tests | `server/test/api.test.js` (`npm test`) |
| Deploy config | `render.yaml` |

## Test accounts

Password for all: **`demo1234`**: `alice@ajaia.test` (owner), `bob@ajaia.test` (editor on the welcome doc), `carol@ajaia.test` (viewer on the welcome doc). The login page also has one-click buttons.

## Status

**Working end to end:** sign in/out; create, rename, edit, autosave, reopen, delete; rich text (bold, italic, underline, strike, H1–H3, bulleted/numbered lists, quote, code block, rule, undo/redo); import of `.txt`/`.md`/`.docx` as a new document; sharing by email with editor/viewer roles, role change and revoke; owned vs shared views; server-side access control; conflict detection on stale saves; SQLite persistence.

**Incomplete / limitations:**
- No real-time co-editing. Two people editing at once get a conflict prompt, not a merge.
- The free Render instance has no persistent disk, so data resets on redeploy/restart (demo data is re-seeded automatically).
- No sign-up flow (seeded accounts only).

**Next 2–4 hours:** Markdown/PDF export, version history (a revisions table on top of the existing version counter), Postgres or a persistent disk, a presence indicator, and Playwright end-to-end tests plus CI.
