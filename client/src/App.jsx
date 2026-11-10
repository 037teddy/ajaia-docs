import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import Login from './components/Login.jsx';
import DocList from './components/DocList.jsx';
import DocEditor from './components/DocEditor.jsx';
import { navigate } from './nav.js';

/** Tiny hash router: '#/' is the document list, '#/d/<id>' is the editor. */
function useRoute() {
  const parse = () => {
    const m = /^#\/d\/([\w-]+)/.exec(window.location.hash);
    return m ? { page: 'doc', id: m[1] } : { page: 'list' };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}


export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const route = useRoute();

  useEffect(() => {
    if (!getToken()) return;
    api.me().then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const onSignedOut = () => setUser(null);
    window.addEventListener('ajaia:signed-out', onSignedOut);
    return () => window.removeEventListener('ajaia:signed-out', onSignedOut);
  }, []);

  async function signOut() {
    try { await api.logout(); } catch { /* token may already be invalid */ }
    setToken(null);
    setUser(null);
    navigate('#/');
  }

  if (checking) return <div className="center muted">Loading…</div>;
  if (!user) return <Login onSignedIn={(u) => setUser(u)} />;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="logo" aria-hidden>▤</span> Ajaia Docs
        </a>
        <div className="topbar-right">
          <span className="avatar" title={user.email}>{user.name[0]}</span>
          <span className="user-name">{user.name}</span>
          <button className="btn ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>
      {route.page === 'doc'
        ? <DocEditor key={route.id} id={route.id} user={user} />
        : <DocList user={user} />}
    </div>
  );
}
