'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '../ui';
import PredictionTabs from '../PredictionTabs';
import { profileHref } from '@/lib/util';

const MIN_FOR_ACCURACY = 5;       // accuracy only ranks people with at least this many finished predictions
const SORTS = {
  points:      { label: 'Points',     cmp: (a, b) => b.points - a.points },
  accuracy:    { label: 'Accuracy',   cmp: (a, b) => (b.settled >= MIN_FOR_ACCURACY) - (a.settled >= MIN_FOR_ACCURACY) || (b.accuracy ?? -1) - (a.accuracy ?? -1) },
  predictions: { label: 'Predicted',  cmp: (a, b) => b.predictions - a.predictions },
  streak:      { label: 'Best streak', cmp: (a, b) => b.bestStreak - a.bestStreak },
};
const PAGE = 25;
const num = n => n == null ? '–' : n.toLocaleString('en-GB');
const share = (n, t) => t ? Math.round(n / t * 100) : 0;

export default function PredictionStatsView() {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [sort, setSort] = useState('points'), [limit, setLimit] = useState(PAGE), [openId, setOpenId] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/predictions/stats', { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'HTTP ' + res.status);
      setData(j); setError('');
    } catch (e) { setError(e.message); setData(d => d || { summary: null, entries: [], total: 0 }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const base = data?.entries || [];                               // already in leaderboard order, which also breaks ties
    if (sort === 'points') return base;
    return [...base].sort((a, b) => SORTS[sort].cmp(a, b) || a.rank - b.rank);
  }, [data, sort]);
  const visible = rows.slice(0, limit);
  const mine = rows.findIndex(r => r.me);
  const s = data?.summary;

  return (
    <main id="predictionStatsPage">
      <div className="ps-wrap">
        <PredictionTabs />
        <div className="pr-head">
          <div><h1>Prediction statistics</h1><p>All-time leaderboard · every finished game that was predicted</p></div>
        </div>
        {error && <p className="pf-note" role="alert">Could not load statistics: {error}</p>}

        {!data ? <p className="empty">Loading…</p> : (
          <>
            <Summary s={s} />

            {!rows.length ? (
              <p className="empty">No predictions yet. <Link href="/predictions">Make the first one</Link> and the leaderboard starts here.</p>
            ) : (
              <section className="ps-board" aria-label="Predictor leaderboard">
                <div className="ps-toolbar">
                  <h2>Leaderboard <small>{num(data.total)} predictor{data.total === 1 ? '' : 's'}</small></h2>
                  {mine >= 0 && <span className="ps-you">You are #{mine + 1}{sort === 'points' ? '' : ` by ${SORTS[sort].label.toLowerCase()}`}</span>}
                </div>

                <div className="ps-cols" role="group" aria-label="Sort leaderboard by">
                  <span className="ps-c-rank">#</span>
                  <span className="ps-c-who">Predictor</span>
                  {Object.entries(SORTS).map(([k, v]) => (
                    <button key={k} className={`ps-c-${k}${sort === k ? ' on' : ''}`} aria-pressed={sort === k} onClick={() => { setSort(k); setLimit(PAGE); }}>{v.label}{sort === k && <i aria-hidden="true"> ↓</i>}</button>
                  ))}
                  <span className="ps-c-form">Form</span>
                  <span className="ps-c-chev" />
                </div>
                {sort === 'accuracy' && <p className="ps-note">Accuracy ranks people with at least {MIN_FOR_ACCURACY} finished predictions first, so one lucky pick can’t lead the table.</p>}

                <ol className="ps-list">
                  {visible.map((r, i) => <Row key={r.handle} r={r} pos={i + 1} open={openId === r.handle} onToggle={() => setOpenId(o => o === r.handle ? '' : r.handle)} />)}
                </ol>
                {rows.length > limit && <button className="pr-more-btn" onClick={() => setLimit(n => n + PAGE)}>Show {Math.min(PAGE, rows.length - limit)} more predictors</button>}
                <p className="pr-fine ps-fine">Points follow the scoring rule on the Predictions page and are recalculated every time. Only finished games count. Ties are broken by accuracy, then by number of finished predictions.</p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Summary({ s }) {
  if (!s) return null;
  const tiles = [
    [num(s.predictors), 'Predictors'],
    [num(s.predictions), 'Predictions made'],
    [s.accuracy == null ? '–' : s.accuracy + '%', 'Overall accuracy'],
    [num(s.matches), 'Games predicted'],
    [num(s.open), 'Still to be played'],
    [s.longestStreak?.length ? s.longestStreak.length : '–', s.longestStreak?.length ? `Longest streak · @${s.longestStreak.handle}` : 'Longest streak'],
  ];
  const tp = s.picked.home + s.picked.draw + s.picked.away, tr = s.results.home + s.results.draw + s.results.away;
  const bars = [['Home', 'home'], ['Draw', 'draw'], ['Away', 'away']];
  return (
    <section className="ps-summary" aria-label="Totals">
      <ul className="ps-tiles">{tiles.map(([v, l]) => <li key={l}><b>{v}</b><span>{l}</span></li>)}</ul>
      <div className="ps-dist">
        <Dist title="What predictors pick" total={tp} items={bars.map(([l, k]) => [l, s.picked[k], k])} />
        <Dist title="How predicted games ended" total={tr} items={bars.map(([l, k]) => [l, s.results[k], k])} />
      </div>
    </section>
  );
}

function Dist({ title, total, items }) {
  return (
    <div className="ps-dist-box">
      <h3>{title}</h3>
      <div className="ps-bar" role="img" aria-label={items.map(([l, n]) => `${l} ${share(n, total)}%`).join(', ')}>
        {items.map(([l, n, k]) => <i key={k} className={'k-' + k} style={{ flexGrow: n }} />)}
      </div>
      <p>{items.map(([l, n, k]) => <span key={k}><i className={'k-' + k} />{l} {share(n, total)}%</span>)}</p>
    </div>
  );
}

function Form({ form }) {
  return (
    <span className="ps-form" aria-label={form.length ? 'Last results: ' + form.map(x => x === 'W' ? 'correct' : 'wrong').join(', ') : 'No finished predictions yet'}>
      {form.length ? form.map((x, i) => <i key={i} className={x === 'W' ? 'w' : 'l'} title={x === 'W' ? 'Correct' : 'Wrong'} />) : <em>–</em>}
    </span>
  );
}

function Row({ r, pos, open, onToggle }) {
  const medal = pos <= 3 ? ` m${pos}` : '';
  const facts = [
    ['Correct', r.correct], ['Wrong', r.wrong], ['Waiting for result', r.pending],
    ['Current streak', r.streak], ['Best streak', r.bestStreak], ['Best week (points)', r.bestWeek],
    ['Weekly titles', r.weekTitles], ['Perfect weeks', r.perfectWeeks], ['Weeks played', r.weeksPlayed],
    ['Written predictions', r.notes],
  ];
  return (
    <li className={`ps-row${medal}${r.me ? ' me' : ''}${open ? ' open' : ''}`}>
      <div className="ps-line">
        <span className="ps-c-rank ps-rank">{pos}</span>
        <Link className="ps-c-who ps-who" href={profileHref(r.handle)} title={r.name}>
          <Avatar name={r.name} src={r.avatar} size={32} className="pr-av ps-av" />
          <span><b>{r.name}</b><small>@{r.handle}{r.me && <em> · you</em>}</small></span>
        </Link>
        <span className="ps-c-points ps-pts">{num(r.points)}</span>
        <span className="ps-c-accuracy ps-acc">
          <b>{r.accuracy == null ? '–' : r.accuracy + '%'}</b>
          <i aria-hidden="true"><u style={{ width: (r.accuracy || 0) + '%' }} /></i>
        </span>
        <span className="ps-c-predictions ps-num">{num(r.predictions)}<small>{r.correct}/{r.settled} right</small></span>
        <span className="ps-c-streak ps-num">{r.bestStreak}<small>{r.streak ? `${r.streak} now` : 'none now'}</small></span>
        <span className="ps-c-form"><Form form={r.form} /></span>
        <button className="pr-chev ps-c-chev" aria-expanded={open} aria-label={open ? `Hide details for ${r.name}` : `Show details for ${r.name}`} onClick={onToggle}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l7 7 7-7" /></svg>
        </button>
      </div>

      {open && (
        <div className="ps-more">
          <dl className="ps-facts">{facts.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{num(v)}</dd></div>)}</dl>
          <div className="ps-picks">
            <h4>Pick breakdown</h4>
            {[['Home wins', 'home'], ['Draws', 'draw'], ['Away wins', 'away']].map(([l, k]) => {
              const p = r.picks[k], rate = p.done ? Math.round(p.ok / p.done * 100) : null;
              return (
                <div key={k} className="ps-pk">
                  <span>{l}</span>
                  <i aria-hidden="true"><u className={'k-' + k} style={{ width: share(p.n, r.predictions) + '%' }} /></i>
                  <small>{p.n} picked · {rate == null ? 'no results yet' : rate + '% right'}</small>
                </div>
              );
            })}
            <div className="ps-form-line"><span>Last {r.form.length || 5}</span><Form form={r.form} /></div>
          </div>
        </div>
      )}
    </li>
  );
}
