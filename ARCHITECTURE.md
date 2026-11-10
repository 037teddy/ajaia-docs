# Architecture note

## Shape

```
Browser (React + TipTap)  ──fetch /api, Bearer token──▶  Express  ──▶  SQLite (node:sqlite)
         ▲                                                  │
         └──────────── static build (client/dist) ◀────────┘   one Node process, one deploy
```

- **One deployable.** Express serves both the JSON API and the built React app. One service, one URL, no CORS, and Render's free tier fits it.
- **SQLite through Node's built-in `node:sqlite`.** No native module to compile, no external database to provision, and reviewers need zero setup. Four tables: `users`, `sessions`, `documents`, `document_shares(document_id, user_id, role)`.
- **Documents are stored as HTML.** TipTap reads and writes HTML. It's human-readable in the DB, easy to export later, and imported files convert straight into it. The server sanitizes every write against the same allow-list of tags the editor supports, so stored content can't carry scripts or event handlers.

## What I prioritized and why

1. **The editing loop feels trustworthy.** Autosave with a visible status, `Ctrl+S`, a warning before leaving with unsaved changes, and a flush when navigating away. In a docs tool, losing someone's text is the worst failure, so this got more care than extra toolbar buttons.
2. **Access control enforced on the server, not just hidden in the UI.** One query decides the caller's role (`owner | editor | viewer`) for a doc. Every route goes through it. Viewers get 403 on save, and non-members get 404 so a document's existence isn't revealed. The tests cover this.
3. **Concurrent edits don't silently clobber each other.** Each document has a `version`. Saves send the version they started from, and the update is `WHERE version = ?`. If someone else saved first, the server returns 409 with the latest copy, and the UI offers "Load latest version" instead of overwriting. This is deliberately not real-time collaboration (see below), but it's the minimum to make sharing an editable doc safe.
4. **Product-relevant upload.** Importing `.txt`, `.md` or `.docx` as a new document is the most common real need (bringing existing writing in), and it reuses the editor instead of adding a separate attachments UI.

## Sharing model

- Every document has exactly one owner (`documents.owner_id`).
- The owner grants access by email with a role: `editor` (edit content and title) or `viewer` (read-only). Only the owner can share, change roles, revoke or delete.
- The home page splits **My documents** and **Shared with me**. Shared rows show the owner and your role, and the editor header shows "Alice's doc · View only".

## Auth

The assignment allows mocked auth, so I kept a small real flow: seeded users, scrypt-hashed passwords, random bearer tokens in a `sessions` table, and the token stored in `localStorage`. This keeps the sharing logic real (it's keyed on actual user ids) without building sign-up, password reset or OAuth.

## What I deliberately cut

| Cut | Why |
|-----|-----|
| Real-time co-editing (CRDT/Yjs, cursors) | The biggest single cost in a Google Docs clone, and it can't be done well in the timebox. Optimistic versioning prevents data loss instead. |
| Sign-up / password reset / OAuth | Not what's being evaluated. Seeded accounts show sharing better. |
| Attachments / storing original files | Import converts content, and keeping the originals would need blob storage. |
| Images, tables, links, comments, text color | Each adds schema, sanitizer rules and UI. The required formatting set is complete and solid instead. |
| Persistent disk in production | Not available on a free tier. Documented, and seeding makes the demo self-healing. |
| Pagination / search on the doc list | Unneeded at demo scale. |

## What I'd build next (2–4 hours)

1. **Export to Markdown/PDF** (turndown for `.md`, print stylesheet for PDF): a small change with high user value.
2. **Version history:** the `version` counter already exists, so add a `document_revisions` table written on each save and a "restore" panel.
3. **Postgres (or a Render disk)** so production data survives redeploys. Only `db.js` and the SQL dialect change.
4. **Presence indicator** ("Bob is viewing") via a lightweight heartbeat endpoint, as a step toward real-time collaboration.
5. **Frontend tests** (Playwright) for the share → open-as-other-user flow, plus a CI workflow.
