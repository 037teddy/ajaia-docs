import { useState } from 'react';
import { api, setToken } from '../api.js';

const DEMO = [
  { email: 'alice@ajaia.test', name: 'Alice' },
  { email: 'bob@ajaia.test', name: 'Bob' },
  { email: 'carol@ajaia.test', name: 'Carol' },
];
const DEMO_PASSWORD = 'demo1234';

export default function Login({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(e, creds = { email, password }) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api.login(creds.email, creds.password);
      setToken(token);
      onSignedIn(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={signIn}>
        <h1><span className="logo" aria-hidden>▤</span> Ajaia Docs</h1>
        <p className="muted">Sign in to create, edit and share documents.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>

        <div className="demo">
          <div className="muted small">Demo accounts (password <code>{DEMO_PASSWORD}</code>). Click one to sign in:</div>
          <div className="demo-users">
            {DEMO.map((u) => (
              <button type="button" key={u.email} className="btn" disabled={busy}
                onClick={() => signIn(null, { email: u.email, password: DEMO_PASSWORD })}>
                {u.name}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
