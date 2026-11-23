'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useData } from '../DataProvider';
import { Avatar } from '../ui';
import { FINISHED, leagueName } from '@/lib/data';
import { sendJSON } from '@/lib/profile';
import { profileHref } from '@/lib/util';
import { MAX_NOTE, WEEK_OFFSET_HOURS, WEEK_ZONE, outcomeOf, prevWeekStart, weekEnd, weekStart } from '@/lib/predictions';

const PAGE = 30;
const range = (a, b) => {            // "23 – 29 Nov" (b is exclusive, so show the day before)
  const sh = WEEK_OFFSET_HOURS * 3600000;                         // show the dates as they are in the week zone
  const f = (t, o) => new Date(t + sh).toLocaleDateString('en-GB', { timeZone: 'UTC', ...o });
  const last = b - 86400000;
  return `${f(a, { day: 'numeric' })} – ${f(last, { day: 'numeric', month: 'short' })}`;
};
const dayLabel = ts => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const clock = ts => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function PredictionsView() {
  const d = useData();
  if (d.status !== 'ready' || !d.meReady) return null;
  return <PredictionsPage />;
}

function PredictionsPage() {
  const { T, fixtures, teamMap, me, openAuth } = useData();
  const [api, setApi] = useState(null), [error, setError] = useState('');
  const [mine, setMine] = useState({});
  const [league, setLeague] = useState(0), [limit, setLimit] = useState(PAGE);
  const [now, setNow] = useState(() => Date.now());
  const who = me?.handle || '';

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);   // rows close by themselves at kick-off

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/predictions', { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'HTTP ' + res.status);
      setApi(j); setMine(j.mine || {}); setError('');
    } catch (e) { setError(e.message); setApi(a => a || { split: {}, live: [], leaders: [] }); }
  }, []);
  useEffect(() => { load(); }, [load, who]);

  const ws = weekStart(now), we = weekEnd(now);
  const games = useMemo(() => fixtures
    .filter(f => f.ts >= ws && f.ts < we)
    .map(f => ({ ...f, home: T[teamMap.get(f.h)], away: T[teamMap.get(f.a)] }))
    .filter(g => g.home && g.away && g.home !== g.away)
    .sort((x, y) => x.ts - y.ts || x.id - y.id), [fixtures, T, teamMap, ws, we]);

  const leagues = useMemo(() => [...new Set(games.map(g => g.leagueId))].sort((a, b) => leagueName(a).localeCompare(leagueName(b))), [games]);
  const shown = games.filter(g => !league || g.leagueId === league);
  const isOpen = g => g.ts > now && !FINISHED.has(g.status);
  const upcoming = shown.filter(isOpen), closed = shown.filter(g => !isOpen(g));
  const list = [...upcoming, ...closed], visible = list.slice(0, limit);

  const save = async (g, body) => {                 // throws on failure; the row shows the message
    if (!me) { openAuth('signin'); throw new Error('Sign in to make a prediction'); }
    const r = await sendJSON('/api/predictions', 'PUT', { matchId: g.id, ...body });
    setMine(m => ({ ...m, [g.id]: { pick: r.pick, note: r.note } }));
    return r;
  };

  let lastDay = '', lastClosed = false;
  return (
    <main id="predictionsPage">
      <div className="pr-wrap">
        <aside className="pr-side">
          <Board title="This week" sub={`${range(ws, we)} · ${api?.played ?? 0} game${api?.played === 1 ? '' : 's'} played`} rows={api?.live} defaultOpen
            empty="No points yet. The board fills in as this week’s games finish." live />
          <Board title="Last week’s winners" sub={range(prevWeekStart(now), ws)} rows={api?.leaders}
            empty="No winners yet. The board is filled once a full week of predictions has been played." />
          <p className="pr-fine">The board resets every Monday at 00:00 {WEEK_ZONE}.</p>
        </aside>

        <section className="pr-main">
          <div className="pr-head">
            <div><h1>Predictions</h1><p>Week of {range(ws, we)}</p></div>
            {leagues.length > 1 && (
              <select aria-label="Competition" value={league} onChange={e => { setLeague(+e.target.value); setLimit(PAGE); }}>
                <option value={0}>All competitions</option>
                {leagues.map(id => <option key={id} value={id}>{leagueName(id)}</option>)}
              </select>
            )}
          </div>
          <p className="pr-how">Pick the winner, or a draw, before kick-off. You can change your pick until the game starts, and add a few words if you want to explain it.</p>
          {error && <p className="pf-note" role="alert">Could not load predictions: {error}</p>}

          {!list.length ? <p className="empty">{games.length ? 'No games in this competition this week.' : 'No games are scheduled for this week yet. Check back soon.'}</p> : visible.map(g => {
            const out = [];
            const day = dayLabel(g.ts), c = !isOpen(g);
            if (c && !lastClosed) out.push(<h2 key="closed" className="pr-day">Started or finished this week</h2>);
            else if (!c && day !== lastDay) out.push(<h2 key={'d' + day} className="pr-day">{day}</h2>);
            lastClosed = c; if (!c) lastDay = day;
            out.push(<Row key={g.id} g={g} closed={c} mine={mine[g.id]} split={api?.split[g.id]} onSave={body => save(g, body)} />);
            return out;
          })}
          {list.length > limit && <button className="pr-more-btn" onClick={() => setLimit(n => n + PAGE)}>Show {Math.min(PAGE, list.length - limit)} more games</button>}
        </section>
      </div>
    </main>
  );
}

// A collapsible leaderboard. rows === undefined means still loading.
function Board({ title, sub, rows, empty, defaultOpen = false, live = false }) {
  return (
    <details className="pr-box pr-board" open={defaultOpen}>
      <summary>
        <span className="pr-sum"><h2>{title}{live && <i className="pr-live" aria-label="Updating live">Live</i>}</h2><small>{sub}</small></span>
        <svg className="pr-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg>
      </summary>
      {rows === undefined ? <p className="pr-none">Loading…</p> : rows.length ? (
        <ol className="pr-leaders">
          {rows.map(l => (
            <li key={l.handle}>
              <span className="pr-rank">{l.rank}</span>
              <Link href={profileHref(l.handle)} title={l.name}><Avatar name={l.name} src={l.avatar} size={24} className="pr-av" /><span>{l.handle}</span></Link>
              <b>{l.points}</b>
            </li>
          ))}
        </ol>
      ) : <p className="pr-none">{empty}</p>}
    </details>
  );
}

function Team({ t }) {
  return t.l
    ? <i className="pr-badge"><img src={t.l} alt="" width="22" height="22" loading="lazy" decoding="async" /></i>
    : <i className="pr-badge" style={{ background: t.c, color: t.t }}>{t.s.slice(0, 3)}</i>;
}

// One game: team badges, the three outcome buttons, and a drawer for the written prediction.
function Row({ g, closed, mine, split, onSave }) {
  const { home, away } = g;
  const [open, setOpen] = useState(false), [err, setErr] = useState('');
  const [text, setText] = useState(mine?.note || ''), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => setText(mine?.note || ''), [mine?.note]);

  const done = FINISHED.has(g.status), result = done ? outcomeOf(g.hs, g.as) : null;
  const pick = async v => {
    if (closed || busy || v === mine?.pick) return;
    setBusy(true); setErr('');
    try { await onSave({ pick: v }); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const saveNote = async e => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setErr(''); setSaved(false);
    try { await onSave({ note: text }); setSaved(true); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  const total = split ? split.home + split.draw + split.away : 0;
  const pct = k => total ? Math.round(split[k] / total * 100) : 0;
  const opts = [['home', home.short, home.n], ['draw', 'Draw', 'Draw'], ['away', away.short, away.n]];
  const showSplit = total > 0 && (mine?.pick || closed);

  return (
    <article className={`pr-row${closed ? ' closed' : ''}${open ? ' open' : ''}`} style={{ '--a': home.c, '--b': away.c }}>
      <div className="pr-top">
        <div className="pr-match">
          <span className="pr-vs" aria-hidden="true"><Team t={home} /><b>vs</b><Team t={away} /></span>
          <span className="pr-names">
            <b>{home.short} <em>v</em> {away.short}</b>
            <small>{leagueName(g.leagueId)} · {done ? <>Final {g.hs}–{g.as}</> : closed ? 'In play' : clock(g.ts)}</small>
          </span>
        </div>
        <div className="pr-picks" role="radiogroup" aria-label={`Your prediction for ${home.n} against ${away.n}`}>
          {opts.map(([v, label, full]) => {
            const on = mine?.pick === v;
            return (
              <button key={v} role="radio" aria-checked={on} disabled={closed} title={full}
                className={`pr-pick${on ? ' on' : ''}${done && result === v ? ' won' : ''}${done && on && result !== v ? ' lost' : ''}`} onClick={() => pick(v)}>
                {label}
              </button>
            );
          })}
        </div>
        <button className="pr-chev" aria-expanded={open} aria-label={open ? 'Hide written prediction' : 'Write a prediction'} onClick={() => setOpen(o => !o)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l7 7 7-7" /></svg>
        </button>
      </div>

      {showSplit && (
        <div className="pr-split" title={`${home.short} ${pct('home')}% · Draw ${pct('draw')}% · ${away.short} ${pct('away')}% (${total} prediction${total === 1 ? '' : 's'})`}>
          <i style={{ flexGrow: split.home }} /><i style={{ flexGrow: split.draw }} /><i style={{ flexGrow: split.away }} />
        </div>
      )}
      {err && <p className="st-err pr-err" role="alert">{err}</p>}

      {open && (
        <form className="pr-note" onSubmit={saveNote}>
          <label htmlFor={`n${g.id}`}>Your written prediction <span>(optional)</span></label>
          <textarea id={`n${g.id}`} value={text} maxLength={MAX_NOTE} rows={3} disabled={closed || !mine?.pick}
            placeholder={closed ? 'Predictions are closed for this game.' : mine?.pick ? 'Why do you think so? A scoreline, a key player, a hunch…' : 'Pick an outcome first.'}
            onChange={e => { setText(e.target.value); setSaved(false); }} />
          <div className="pr-note-foot">
            <small>{saved ? 'Saved' : `${text.length}/${MAX_NOTE}`}</small>
            <button type="submit" disabled={closed || !mine?.pick || busy || text.trim() === (mine?.note || '')}>Save</button>
          </div>
        </form>
      )}
    </article>
  );
}
