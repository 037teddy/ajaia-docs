import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { navigate } from '../nav.js';

const ACCEPT = '.txt,.md,.docx';

function timeAgo(sqliteUtc) {
  const then = new Date(sqliteUtc.replace(' ', 'T') + 'Z');
  const s = Math.round((Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return then.toLocaleDateString();
}

function DocRow({ doc, onDelete }) {
  return (
    <li className="doc-row">
      <a href={`#/d/${doc.id}`} className="doc-link">
        <span className="doc-icon" aria-hidden>▤</span>
        <span className="doc-title">{doc.title}</span>
      </a>
      <span className="doc-meta">
        {doc.role === 'owner'
          ? (doc.share_count > 0 ? <span className="pill">Shared with {doc.share_count}</span> : <span className="pill subtle">Private</span>)
          : <span className="pill">{doc.owner_name} · {doc.role === 'editor' ? 'Can edit' : 'View only'}</span>}
        <span className="muted small">{timeAgo(doc.updated_at)}</span>
        {onDelete && (
          <button className="btn ghost small" title="Delete" onClick={() => onDelete(doc)}>Delete</button>
        )}
      </span>
    </li>
  );
}

export default function DocList() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  const load = () => api.listDocs().then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true);
    try {
      const { document } = await api.createDoc();
      navigate(`#/d/${document.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const { document } = await api.importDoc(file);
      navigate(`#/d/${document.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await api.deleteDoc(doc.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="list-page">
      <section className="actions">
        <button className="btn primary" onClick={create} disabled={busy}>+ New document</button>
        <button className="btn" onClick={() => fileInput.current.click()} disabled={busy}>Import file…</button>
        <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={onFile} />
        <span className="muted small">Import turns a <b>.txt</b>, <b>.md</b> or <b>.docx</b> file (max 2 MB) into a new editable document.</span>
      </section>
      {error && <div className="error" role="alert">{error}</div>}
      {!data ? <p className="muted">Loading…</p> : (
        <>
          <h2>My documents</h2>
          {data.owned.length === 0
            ? <p className="muted empty">No documents yet. Create one or import a file.</p>
            : <ul className="doc-list">{data.owned.map((d) => <DocRow key={d.id} doc={d} onDelete={remove} />)}</ul>}
          <h2>Shared with me</h2>
          {data.shared.length === 0
            ? <p className="muted empty">Nothing has been shared with you yet.</p>
            : <ul className="doc-list">{data.shared.map((d) => <DocRow key={d.id} doc={d} />)}</ul>}
        </>
      )}
    </main>
  );
}
