'use client';
import { useState } from 'react';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';

const STEP = 100;

// Every match, newest first (the data layer already sorts them). Shows 100 at a time; "Load more" adds the next 100.
export default function MatchesView() {
  const d = useData();
  const [shown, setShown] = useState(STEP);
  if (d.status !== 'ready') return null;
  const total = d.matches.length;
  return (
    <div className="page">
      <div className="ad-space" aria-hidden="true" />
      <main className="content">
        <section>
          <div className="sec-head"><h2>All matches · newest first</h2><span style={{ fontSize: 12, color: 'var(--muted)' }}>{Math.min(shown, total)} of {total}</span></div>
          {total ? <div className="match-grid">{d.matches.slice(0, shown).map(m => <MatchCard key={m.id} m={m} />)}</div> : <p className="empty">No matches yet.</p>}
          {shown < total && <div className="ml-more"><button className="btn" onClick={() => setShown(n => n + STEP)}>Load 100 more</button></div>}
        </section>
      </main>
      <div className="ad-space" aria-hidden="true" />
    </div>
  );
}
