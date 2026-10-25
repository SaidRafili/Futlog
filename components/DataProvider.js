'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadAll } from '@/lib/data';
import { ME_HANDLE } from '@/lib/util';
import { sendJSON } from '@/lib/profile';

export const DataContext = createContext({ status: 'loading' });
export const useData = () => useContext(DataContext);

// Loads teams + fixtures (PostgreSQL) once for the whole site and shares the result.
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

  // The signed-in (demo) user: profile row + what they have watched / liked + who they follow, all from PostgreSQL.
  // If the profile tables are not set up yet this stays null and the site keeps working with local-only state.
  const [me, setMe] = useState(null);
  const [marks, setMarks] = useState(() => ({ watched: new Set(), liked: new Set() }));
  const [toast, setToast] = useState('');

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${ME_HANDLE}?lite=1`, { cache: 'no-store' });
      if (!res.ok) { setMe(null); return; }
      const j = await res.json();
      setMe(j.user);
      setMarks({ watched: new Set(j.watched), liked: new Set(j.liked) });
      setFollowing(new Set(j.following));
    } catch { /* no database profile: keep working locally */ }
  }, []);
  useEffect(() => { refreshMe(); }, [refreshMe]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // optimistic follow: the UI flips at once, the database follows. Demo users that are not in the users table just stay local.
  const toggleFollow = useCallback(h => {
    let on = false;
    setFollowing(s => { const n = new Set(s); on = !n.has(h); on ? n.add(h) : n.delete(h); return n; });
    queueMicrotask(() => sendJSON('/api/follows', on ? 'POST' : 'DELETE', { handle: h }).catch(() => { /* not a database user: local only */ }));
  }, []);

  // watched / liked / on-site on a match are saved to the profile; reverted with a message if the save fails
  const setMark = useCallback((matchId, kind, on) => {
    const flip = v => setMarks(m => { const s = new Set(m[kind]); v ? s.add(matchId) : s.delete(matchId); return { ...m, [kind]: s }; });
    flip(on);
    sendJSON(`/api/users/${ME_HANDLE}/matches`, on ? 'POST' : 'DELETE', { matchId, kind }).catch(e => {
      flip(!on);
      setToast(e.message || 'Could not save that');
    });
  }, []);

  const value = useMemo(() => ({ ...state, following, toggleFollow, me, refreshMe, marks, setMark }), [state, following, toggleFollow, me, refreshMe, marks, setMark]);

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
