import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function ShareDialog({ docId, onClose }) {
  const [shares, setShares] = useState(null);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    Promise.all([api.listShares(docId), api.users()])
      .then(([s, u]) => { setShares(s.shares); setUsers(u.users); })
      .catch((e) => setError(e.message));
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docId]);

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      const { shares } = await fn();
      setShares(shares);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e) {
    e.preventDefault();
    if (await run(() => api.share(docId, email, role))) setEmail('');
  }

  const sharedIds = new Set((shares || []).map((s) => s.user_id));
  const suggestions = users.filter((u) => !sharedIds.has(u.id));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">Share document</h2>
        <form className="share-form" onSubmit={add}>
          <input
            ref={inputRef}
            type="email"
            placeholder="Add people by email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            list="share-users"
            required
          />
          <datalist id="share-users">
            {suggestions.map((u) => <option key={u.id} value={u.email}>{u.name}</option>)}
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Access level">
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button className="btn primary" disabled={busy}>Share</button>
        </form>
        {suggestions.length > 0 && (
          <p className="muted small">Demo users: {suggestions.map((u) => u.email).join(', ')}</p>
        )}
        {error && <div className="error" role="alert">{error}</div>}

        <h3>People with access</h3>
        {!shares ? <p className="muted">Loading…</p> : shares.length === 0 ? (
          <p className="muted">Only you can see this document.</p>
        ) : (
          <ul className="share-list">
            {shares.map((s) => (
              <li key={s.user_id}>
                <span className="avatar small">{s.name[0]}</span>
                <span className="share-who">{s.name}<br /><span className="muted small">{s.email}</span></span>
                <select value={s.role} disabled={busy} aria-label={`Access for ${s.name}`}
                  onChange={(e) => run(() => api.share(docId, s.email, e.target.value))}>
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button className="btn ghost small" disabled={busy} onClick={() => run(() => api.unshare(docId, s.user_id))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
