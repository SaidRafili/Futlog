'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadAll } from '@/lib/data';
import { sendJSON } from '@/lib/profile';

export const DataContext = createContext({ status: 'loading' });
export const useData = () => useContext(DataContext);

// Loads teams + fixtures (PostgreSQL) once for the whole site and shares the result, plus the signed-in user.
// Views render nothing until status === 'ready'.
export default function DataProvider({ children }) {
  const [state, setState] = useState({ status: 'loading' });
  const [following, setFollowing] = useState(() => new Set());

  useEffect(() => {
    let dead = false;
    loadAll()
      .then(d => { if (!dead) setState({ status: 'ready', ...d }); })
      .catch(error => { console.error('Futlog: could not start', error); if (!dead) setState({ status: 'error', error }); });
    return () => { dead = true; };
  }, []);

  // The signed-in user (session cookie -> /api/auth/me): profile + what they watched / liked + who they follow.
  // me === null means signed out; meReady is false until the first answer arrives.
  const [me, setMe] = useState(null);
  const [meReady, setMeReady] = useState(false);
  const [auth, setAuth] = useState({ open: false, mode: 'signin' });   // the sign-in / sign-up popup
  const openAuth = useCallback((mode = 'signin') => setAuth({ open: true, mode }), []);
  const closeAuth = useCallback(() => setAuth(a => ({ ...a, open: false })), []);
  const [marks, setMarks] = useState(() => ({ watched: new Set(), liked: new Set() }));
  const [toast, setToast] = useState('');

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const j = res.ok ? await res.json() : { user: null };
      setMe(j.user || null);
      setMarks({ watched: new Set(j.watched || []), liked: new Set(j.liked || []) });
      setFollowing(new Set(j.following || []));
    } catch { setMe(null); }          // database not reachable / tables missing: the site still works signed out
    setMeReady(true);
  }, []);
  useEffect(() => { refreshMe(); }, [refreshMe]);

  const signOut = useCallback(async () => {
    try { await sendJSON('/api/auth/logout', 'POST', {}); } catch { /* cookie may already be gone */ }
    await refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // optimistic follow: the UI flips at once, the database follows; if saving fails the button flips back
  const toggleFollow = useCallback(h => {
    if (!me) { openAuth('signin'); return; }
    let on = false;
    setFollowing(s => { const n = new Set(s); on = !n.has(h); on ? n.add(h) : n.delete(h); return n; });
    queueMicrotask(() => sendJSON('/api/follows', on ? 'POST' : 'DELETE', { handle: h }).catch(e => {
      setFollowing(s => { const n = new Set(s); on ? n.delete(h) : n.add(h); return n; });
      if (e.status === 401) openAuth('signin'); else setToast(e.message || 'Could not save that');
    }));
  }, [me, openAuth]);

  // watched / liked / on-site on a match are saved to the profile; reverted with a message if the save fails
  const setMark = useCallback((matchId, kind, on) => {
    if (!me) { openAuth('signin'); return; }
    const flip = v => setMarks(m => { const s = new Set(m[kind]); v ? s.add(matchId) : s.delete(matchId); return { ...m, [kind]: s }; });
    flip(on);
    sendJSON(`/api/users/${me.handle}/matches`, on ? 'POST' : 'DELETE', { matchId, kind }).catch(e => {
      flip(!on);
      if (e.status === 401) openAuth('signin'); else setToast(e.message || 'Could not save that');
    });
  }, [me, openAuth]);

  const value = useMemo(() => ({ ...state, following, toggleFollow, me, meReady, refreshMe, signOut, auth, openAuth, closeAuth, marks, setMark }),
    [state, following, toggleFollow, me, meReady, refreshMe, signOut, auth, openAuth, closeAuth, marks, setMark]);

  return (
    <DataContext.Provider value={value}>
      {state.status === 'error' && (
        <p style={{ margin: 0, padding: '12px 16px', background: '#7a1010', color: '#fff', font: '14px system-ui' }}>
          Could not start ({state.error.message}). Check that <code>DATABASE_URL</code> is set, the <code>teams</code> database exists, and the <code>teams</code> and <code>fixtures</code> tables are filled.
        </p>
      )}
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
    </DataContext.Provider>
  );
}
