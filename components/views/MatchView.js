'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import CommentSection from '../Comments';
import { Avatar, Crest, LikeButton, MiniBadge } from '../ui';
import { COMPC, COMPN } from '@/lib/consts';
import { sendJSON } from '@/lib/profile';
import { fmt, ord, profileHref, timeAgo } from '@/lib/util';

const IC = {
  eye: <svg viewBox="0 0 64 44"><path d="M2 22C10 8 22 2 32 2s22 6 30 20c-8 14-20 20-30 20S10 36 2 22z" fill="currentColor" /><circle cx="32" cy="22" r="11" fill="#030305" /><circle cx="32" cy="22" r="5" fill="currentColor" /></svg>,
  heart: <svg viewBox="0 0 64 60"><path d="M32 58S4 40 4 20A14 14 0 0 1 32 14a14 14 0 0 1 28 6c0 20-28 38-28 38z" fill="currentColor" /></svg>,
  chat: <svg viewBox="0 0 64 60"><path d="M6 6h52a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H30L14 58V44H6a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" fill="currentColor" /></svg>
};

export default function MatchView() {
  const d = useData();
  const router = useRouter();
  const id = +useParams().id;
  const m = d.status === 'ready' ? d.byId(id) : null;

  useEffect(() => { if (d.status === 'ready' && !m) router.replace('/'); }, [d.status, m, router]);
  if (!m) return null;
  return <MatchPage key={m.id} m={m} />;
}

function MatchPage({ m }) {
  const { T, detail, marks, setMark, me, meReady, openAuth } = useData();
  const h = T[m.h], a = T[m.a], d = detail(m);
  const watched = marks.watched.has(m.id), liked = marks.liked.has(m.id); // saved to the profile in PostgreSQL
  const [tab, setTab] = useState('reviews');
  const tabsRef = useRef(null);
  const who = me?.handle || '';

  // counts, average rating and your own rating: GET /api/matches/:id (nothing here is made up)
  const [stats, setStats] = useState(null);
  const [ccount, setCcount] = useState(null);
  const base = useRef({ watched: false, liked: false });
  useEffect(() => {
    if (!meReady) return;
    let dead = false;
    fetch('/api/matches/' + m.id, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
      if (dead || !j) return;
      base.current = { watched: marks.watched.has(m.id), liked: marks.liked.has(m.id) };   // what the counts already include
      setStats(j);
    }).catch(() => {});
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id, meReady, who]);

  useEffect(() => { document.title = `${h.n} ${m.hs}–${m.as} ${a.n} · Futlog`; }, [h, a, m]);

  const full = COMPN[m.comp] || m.comp;
  const mine = stats?.mine || 0, avg = stats?.avg || 0;
  const shown = mine || Math.round(avg);
  const rate = async v => {
    if (!me) { openAuth('signin'); return; }
    try { setStats(await sendJSON('/api/matches/' + m.id, mine === v ? 'DELETE' : 'PUT', { rating: v })); } catch (e) { if (e.status === 401) openAuth('signin'); }
  };
  const views = (stats?.watched || 0) - (base.current.watched ? 1 : 0) + (watched ? 1 : 0);
  const likes = (stats?.liked || 0) - (base.current.liked ? 1 : 0) + (liked ? 1 : 0);

  const goals = [[m.h, m.hs], [m.a, m.as]].filter(x => x[1]);

  return (
    <main id="matchPage">
      <section className="mp-hero">
        <div className="mp-left">
          <div className="board">
            <div className="tblock" style={{ background: h.c, color: h.t }}><Crest t={h} big />{h.n}</div>
            <div className="score"><time>{d.date}</time><b>{m.hs} - {m.as}</b></div>
            <div className="tblock" style={{ background: a.c, color: a.t }}><Crest t={a} big />{a.n}</div>
          </div>
          <div className="cred">
            <div className="mp-title"><h2>Match credentials</h2></div>
            <div className="cred-card">
              <div className="cred-strip" style={{ background: COMPC[m.comp] || '#222' }}>{m.comp}</div>
              <div className="cred-body">
                <div>{m.stage ? m.stage + ' / ' : ''}{m.season}
                  <small>{d.pair.length > 1
                    ? <><span className="red">{ord(d.n)}</span> of {d.pair.length} meetings on record</>
                    : <><span className="red">Only</span> meeting on record</>}</small>
                </div>
                <div>{d.venue}</div>
              </div>
              <div className="emblem">{m.leagueLogo ? <img src={m.leagueLogo} alt="" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10" /><path d="M12 7l4 3-1.5 5h-5L8 10z" /></svg>}{full}</div>
            </div>
          </div>
        </div>
        <div className="mp-photo" role="img" aria-label="Match photo" style={{ '--a': h.c, '--b': a.c, backgroundImage: m.img ? `url('${m.img}')` : undefined }} />
      </section>

      <section className="mp-body">
        <aside className="mp-side">
          <div className="stats">
            <div className="actions">
              <button className={watched ? 'on' : ''} aria-pressed={watched} aria-label="Watched" title="Mark as watched" style={{ color: 'var(--accent)' }} onClick={() => setMark(m.id, 'watched', !watched)}>{IC.eye}<span>{fmt(Math.max(0, views))}</span></button><i className="div" />
              <button className={liked ? 'on' : ''} aria-pressed={liked} aria-label="Like" title="Like this match" style={{ color: '#ef2b3a' }} onClick={() => setMark(m.id, 'liked', !liked)}>{IC.heart}<span>{fmt(Math.max(0, likes))}</span></button><i className="div" />
              <button className="on" aria-label="Go to comments" title="Go to comments" style={{ color: 'var(--accent)' }}
                onClick={() => { setTab('comments'); tabsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>{IC.chat}<span>{fmt(ccount ?? stats?.comments ?? 0)}</span></button>
            </div>
            <div className="rate">
              <div className="rate-bars" role="group" aria-label="Rate this match">
                {Array.from({ length: 10 }, (_, k) => 10 - k).map(i => (
                  <button key={i} className={`seg ${i <= shown ? 'on' : ''} ${mine ? 'mine' : ''}`} style={{ height: 8 + i * 2.6 }} aria-label={`Rate ${i} out of 10`} onClick={() => rate(i)} />
                ))}
              </div>
              <div className="rate-text"><b>{stats?.ratings ? avg.toFixed(1) : '–'}</b>average · {fmt(stats?.ratings || 0)} {stats?.ratings === 1 ? 'rating' : 'ratings'}<br />{mine ? `You rated ${mine}/10 · tap it again to remove` : me ? 'Tap a bar to rate this match' : 'Sign in and tap a bar to rate this match'}</div>
            </div>
          </div>
          <div className="notch" />
          <div className="more">
            <div className="mp-title"><h2>More info</h2></div>
            <dl><dt>Kick-off</dt><dd>{d.ko}</dd><dt>Attendance</dt><dd>{d.att}</dd><dt>Competition</dt><dd>{full}</dd></dl>
            {/* the fixtures data has scores but no scorers / minutes, so show goals per team instead of a timeline */}
            <ol className="goals">
              {m.hs + m.as
                ? goals.map(([t, n]) => <li key={t}><b>{n}</b><MiniBadge t={T[t]} />{n > 1 ? 'goals' : 'goal'}</li>)
                : <li>No goals</li>}
              {m.ph + m.pa ? <li><b>Pens</b>{m.ph}–{m.pa}</li> : null}
            </ol>
          </div>
        </aside>

        <div className="mp-main">
          <div className="tabs" ref={tabsRef} role="tablist">
            {['comments', 'reviews'].map(t => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <div hidden={tab !== 'comments'}>
            <CommentSection type="match" id={m.id} placeholder="Add a comment on this match" onCount={setCcount} />
          </div>
          <div hidden={tab !== 'reviews'}><Reviews m={m} h={h} a={a} /></div>
        </div>
      </section>
    </main>
  );
}

// Reviews of this match (table `reviews`): GET/POST/DELETE /api/reviews. One review per person.
function Reviews({ m, h, a }) {
  const { me, meReady, openAuth } = useData();
  const [list, setList] = useState(null), [error, setError] = useState('');
  const [f, setF] = useState({ title: '', body: '', rating: 8 }), [busy, setBusy] = useState(false), [fe, setFe] = useState({}), [msg, setMsg] = useState('');
  const who = me?.handle || '';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reviews?matchId=' + m.id, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'HTTP ' + res.status);
      setList(j.reviews); setError('');
    } catch (e) { setError(e.message); setList(l => l || []); }
  }, [m.id]);
  useEffect(() => { if (meReady) load(); }, [load, meReady, who]);

  const submit = async e => {
    e.preventDefault();
    if (!me) { openAuth('signin'); return; }
    setBusy(true); setFe({}); setMsg('');
    try {
      const { review } = await sendJSON('/api/reviews', 'POST', { matchId: m.id, ...f, rating: +f.rating });
      setList(l => [review, ...(l || [])]); setF({ title: '', body: '', rating: 8 });
    } catch (x) { setFe(x.fields || {}); setMsg(x.fields ? '' : x.message); }
    finally { setBusy(false); }
  };
  const remove = async r => {
    try { await sendJSON('/api/reviews', 'DELETE', { id: r.id }); setList(l => l.filter(x => x.id !== r.id)); } catch (x) { setMsg(x.message); }
  };

  const hasMine = list?.some(r => r.mine);
  return (
    <>
      {!hasMine && (
        <form className="rv-form" onSubmit={submit} noValidate>
          <input value={f.title} onChange={e => setF(x => ({ ...x, title: e.target.value }))} placeholder={me ? 'Review title' : 'Sign in to write a review'} maxLength={200} aria-label="Review title" aria-invalid={!!fe.title} />
          <textarea value={f.body} onChange={e => setF(x => ({ ...x, body: e.target.value }))} placeholder="What did you think? (optional)" rows={3} maxLength={5000} aria-label="Review text" />
          <div className="rv-row">
            <label>Rating <select value={f.rating} onChange={e => setF(x => ({ ...x, rating: e.target.value }))}>{Array.from({ length: 10 }, (_, k) => 10 - k).map(n => <option key={n} value={n}>{n}/10</option>)}</select></label>
            <button type="submit" disabled={busy}>Post review</button>
          </div>
          {(fe.title || fe.body || fe.rating || msg) && <p className="st-err c-err" role="alert">{fe.title || fe.body || fe.rating || msg}</p>}
        </form>
      )}
      {error && <p className="st-err c-err" role="alert">Could not load reviews: {error}</p>}
      {list && !list.length && !error && <p className="empty">No reviews yet. Be the first to review this match.</p>}
      <div className="reviews">
        {list?.map((r, i) => {
          const col = r.rating >= 9 ? '#6ee7a0' : r.rating === 8 ? '#ffd84a' : '#ff9f6b';
          return (
            <article key={r.id} className="review" style={{ '--stripe': col, '--a': i % 2 ? a.c : h.c, '--b': i % 2 ? h.c : a.c }}><i />
              <div className="r-body">
                <h3>{r.title}</h3>
                <div className="r-by"><Avatar name={r.user.name} src={r.user.avatar} className="r-avatar" size={20} /><Link href={profileHref(r.user.handle)}>{r.user.name}</Link><b>{r.rating}/10</b></div>
                {r.body && <p className="r-text">{r.body}</p>}
                <div className="r-foot"><time>{timeAgo(r.at)}</time><LikeButton type="review" id={r.id} count={r.likes} liked={r.liked} />
                  {r.mine && <button className="c-act" onClick={() => remove(r)}>Delete</button>}</div>
              </div>
              <div className="r-thumb" />
            </article>
          );
        })}
      </div>
    </>
  );
}
