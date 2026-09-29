'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import { norm, uniq } from '@/lib/util';

const CAP = 120;

export default function SearchView() {
  const d = useData();
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get('q') || '', league = sp.get('league') || '', season = sp.get('season') || '';

  useEffect(() => { document.title = 'Search · Futlog'; }, []);
  if (d.status !== 'ready') return null;
  const { T, matches } = d;

  // "real madrid vs bayern" -> both terms must appear in the match
  const terms = norm(q).split(/\s+(?:vs?\.?|-)\s+/).map(s => s.trim()).filter(Boolean);
  const r = matches.filter(m => {
    const hay = norm([T[m.h].n, T[m.h].short, T[m.a].n, T[m.a].short, m.comp, m.stage, m.season].join(' '));
    return terms.every(t => hay.includes(t)) && (!league || m.comp === league) && (!season || m.season === season);
  });

  const go = (l, s) => {
    const p = new URLSearchParams({ q });
    if (l) p.set('league', l);
    if (s) p.set('season', s);
    router.push('/search?' + p);
  };

  return (
    <main className="results" id="results">
      <div className="sec-head">
        <h2>Search results for: <em>{q}</em></h2>
        <div className="filters">
          <select aria-label="League" value={league} onChange={e => go(e.target.value, season)}>
            <option value="">League</option>{uniq(matches, 'comp').map(v => <option key={v}>{v}</option>)}
          </select>
          <select aria-label="Season" value={season} onChange={e => go(league, e.target.value)}>
            <option value="">Season</option>{uniq(matches, 'season').map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="match-grid">
        {r.slice(0, CAP).map(m => <MatchCard key={m.id} m={m} />)}
        {r.length > CAP && <p className="empty" style={{ gridColumn: '1/-1' }}>Showing the latest {CAP} of {r.length} matches. Add a team, league or season to narrow it down.</p>}
      </div>
      <p className="empty" hidden={r.length > 0}>No matches found for “{q}”. Try a team name like “{matches[0] ? T[matches[0].h].short : 'Belgrano'}”, or clear the filters.</p>
    </main>
  );
}
