'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadAll } from '@/lib/data';

export const DataContext = createContext({ status: 'loading' });
export const useData = () => useContext(DataContext);

// Loads teams (PostgreSQL) + fixtures.csv once for the whole site and shares the result.
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

  const toggleFollow = useCallback(h => setFollowing(s => {
    const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n;
  }), []);

  const value = useMemo(() => ({ ...state, following, toggleFollow }), [state, following, toggleFollow]);

  return (
    <DataContext.Provider value={value}>
      {state.status === 'error' && (
        <p style={{ margin: 0, padding: '12px 16px', background: '#7a1010', color: '#fff', font: '14px system-ui' }}>
          Could not start ({state.error.message}). Check that PostgreSQL is running, <code>DATABASE_URL</code> is set in <code>.env.local</code>, and <code>fixtures.csv</code> is in the <code>public/</code> folder.
        </p>
      )}
      {children}
    </DataContext.Provider>
  );
}
