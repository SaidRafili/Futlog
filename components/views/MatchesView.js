'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import { fold } from '@/lib/fold';

const STEP = 100;

// Filters live in the address (?league=39&season=2026%2F27&team=arsenal&result=home&sort=old), so a filtered list can be shared / bookmarked
// and the league buttons on the home page can link straight to one league. Default order is newest first.
const KEYS = ['league', 'season', 'team', 'result', 'sort'];
const RESULTS = [['', 'Any result'], ['home', 'Home win'], ['draw', 'Draw'], ['away', 'Away win']];

export default function MatchesView() {
  const d = useData();
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const f = Object.fromEntries(KEYS.map(k => [k, sp.get(k) || '']));
  const [team, setTeam] = useState(f.team);                    // typed text is kept here so typing stays smooth; it is copied to the address
  useEffect(() => setTeam(f.team), [f.team]);                  // back / forward / "Clear" change the address -> follow it
  const [shown, setShown] = useState(STEP);
  const qs = KEYS.map(k => f[k]).join('|');
  useEffect(() => setShown(STEP), [qs]);                       // a new filter starts again at the first 100

  const set = (patch, replace = true) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    if ('league' in patch && !('season' in patch)) n.delete('season');           // seasons differ per league
    const q = n.toString();
    router[replace ? 'replace' : 'push'](q ? `${path}?${q}` : path, { scroll: false });
  };

  const ready = d.status === 'ready';
  const all = ready ? d.matches : [];

  const leagues = useMemo(() => {
    const m = new Map();
    for (const x of all) { const l = m.get(x.leagueId) || { id: String(x.leagueId), name: x.comp, n: 0 }; l.n++; m.set(x.leagueId, l); }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);
  const seasons = useMemo(() => {                              // seasons of the chosen league (or of every league), newest first
    const s = new Set();
    for (const x of all) if (!f.league || String(x.leagueId) === f.league) s.add(x.season);
    return [...s].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [all, f.league]);

  const list = useMemo(() => {
    const q = fold(team.trim());
    const out = all.filter(m => {
      if (f.league && String(m.leagueId) !== f.league) return false;
      if (f.season && m.season !== f.season) return false;
      if (f.result === 'home' && !(m.hs > m.as)) return false;
      if (f.result === 'draw' && m.hs !== m.as) return false;
      if (f.result === 'away' && !(m.as > m.hs)) return false;
      if (q) { const h = d.T[m.h], a = d.T[m.a]; if (!fold(`${h.n} ${h.short} ${a.n} ${a.short}`).includes(q)) return false; }
      return true;
    });
    return f.sort === 'old' ? [...out].reverse() : out;        // `all` is already newest first
  }, [all, d.T, f.league, f.season, f.result, f.sort, team]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null;
  const total = list.length, active = !!(f.league || f.season || f.result || team.trim() || f.sort);
  const lg = leagues.find(l => l.id === f.league);
  const title = `${lg ? lg.name : 'All matches'} · ${f.sort === 'old' ? 'oldest' : 'newest'} first`;
  const clear = () => { setTeam(''); router.replace(path, { scroll: false }); };

  return (
    <div className="page">
      <div className="ad-space" aria-hidden="true" />
      <main className="content">
        <section>
          <div className="sec-head"><h2>{title}</h2><span style={{ fontSize: 12, color: 'var(--muted)' }}>{Math.min(shown, total)} of {total}{active ? ` (${all.length} in total)` : ''}</span></div>

          <form className="mf" role="search" aria-label="Filter matches" onSubmit={e => e.preventDefault()}>
            <label>League
              <select value={f.league} onChange={e => set({ league: e.target.value })}>
                <option value="">All leagues</option>
                {leagues.map(l => <option key={l.id} value={l.id}>{l.name} ({l.n})</option>)}
              </select>
            </label>
            <label>Season
              <select value={f.season} onChange={e => set({ season: e.target.value })}>
                <option value="">All seasons</option>
                {seasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Result
              <select value={f.result} onChange={e => set({ result: e.target.value })}>
                {RESULTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            <label>Team
              <input type="search" value={team} placeholder="Any team" onChange={e => { setTeam(e.target.value); set({ team: e.target.value }); }} />
            </label>
            <label>Order
              <select value={f.sort} onChange={e => set({ sort: e.target.value })}>
                <option value="">Newest first</option>
                <option value="old">Oldest first</option>
              </select>
            </label>
            {active && <button type="button" className="btn ghost sm mf-clear" onClick={clear}>Clear filters</button>}
          </form>

          {total ? <div className="match-grid">{list.slice(0, shown).map(m => <MatchCard key={m.id} m={m} />)}</div> : <p className="empty">{active ? 'No matches fit these filters.' : 'No matches yet.'}</p>}
          {shown < total && <div className="ml-more"><button className="btn" onClick={() => setShown(n => n + STEP)}>Load 100 more</button></div>}
        </section>
      </main>
      <div className="ad-space" aria-hidden="true" />
    </div>
  );
}
