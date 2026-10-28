'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import CommentSection from '../Comments';
import PostCard from '../PostCard';
import PostComposer from '../PostComposer';
import { Crest, MiniBadge } from '../ui';
import { COMPC, COMPN } from '@/lib/consts';
import { sendJSON } from '@/lib/profile';
import { fmt, ord, timeAgo } from '@/lib/util';

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
  const [tab, setTab] = useState('comments');
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
            <div className="ticket" style={{ '--tc': COMPC[m.comp] || '#5b4fd6' }}>
              <div className="tk-main">
                <div className="tk-head"><span>Match ticket</span><span>No. {String(m.id).padStart(7, '0')}</span></div>
                <dl className="tk-grid">
                  <div><dt>Date</dt><dd>{d.date}</dd></div>
                  <div><dt>Kick-off</dt><dd>{d.ko}</dd></div>
                  <div className="wide"><dt>Stage</dt><dd>{[m.stage, m.season].filter(Boolean).join(' · ')}</dd></div>
                  <div className="wide"><dt>Venue</dt><dd>{d.venue}</dd></div>
                </dl>
                <div className="tk-meet">{d.pair.length > 1
                  ? <><span className="red">{ord(d.n)}</span> of {d.pair.length} meetings on record</>
                  : <><span className="red">Only</span> meeting on record</>}</div>
              </div>
              <div className="tk-stub">
                {m.leagueLogo ? <img src={m.leagueLogo} alt="" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10" /><path d="M12 7l4 3-1.5 5h-5L8 10z" /></svg>}
                <span>{full}</span>
                <i aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
        <div className="mp-photo" role="img" aria-label="Match photo" style={{ '--a': h.c, '--b': a.c, backgroundImage: m.img ? `linear-gradient(to top,rgba(0,0,0,.4),transparent 50%),url('${m.img}')` : undefined }}>
          {m.img && m.imgCredit ? <small className="mp-credit">Photo: {m.imgCredit}</small> : null}
        </div>
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
            {['comments', 'articles', 'posts'].map(t => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <div hidden={tab !== 'comments'}>
            <CommentSection type="match" id={m.id} placeholder="Add a comment on this match" onCount={setCcount} />
          </div>
          <div hidden={tab !== 'articles'}><MatchArticles m={m} active={tab === 'articles'} /></div>
          <div hidden={tab !== 'posts'}><MatchPosts m={m} active={tab === 'posts'} /></div>
        </div>
      </section>
    </main>
  );
}

// Articles tagged with this match: GET /api/articles?matchId=
function MatchArticles({ m, active }) {
  const { meReady, me } = useData();
  const [list, setList] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    if (!active || !meReady || list) return;
    fetch('/api/articles?sort=top&limit=30&matchId=' + m.id, { cache: 'no-store' })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); setList(j.articles); })
      .catch(e => { setError(e.message); setList([]); });
  }, [active, meReady, m.id, list, me]);
  if (error) return <p className="st-err c-err" role="alert">Could not load articles: {error}</p>;
  if (!list) return <p className="empty">Loading…</p>;
  if (!list.length) return <p className="empty">No articles about this match yet. <Link href="/write" style={{ color: 'var(--accent)' }}>Write the first one.</Link></p>;
  return (
    <div className="mp-arts">
      {list.map(a => (
        <Link key={a.id} className="mp-art" href={`/article/${a.id}`}>
          <div className="mp-art-img" role="img" aria-label="" style={a.cover ? { backgroundImage: `url('${a.cover}')` } : undefined}>{a.cover ? null : <span>{a.category.slice(0, 1)}</span>}</div>
          <div className="mp-art-t">
            <h3>{a.title}</h3>
            <p>{a.category} · {a.readMinutes || 1} min read · by {a.author.name}</p>
            <p className="mp-art-s">♥ {a.likes} · 💬 {a.comments}{a.publishedAt ? ' · ' + timeAgo(a.publishedAt) : ''}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// Feed posts that tag this match: GET /api/posts?matchId=
function MatchPosts({ m, active }) {
  const { meReady, me, byId } = useData();
  const [posts, setPosts] = useState(null), [error, setError] = useState(''), [open, setOpen] = useState(() => new Set());
  const who = me?.handle || '';
  const load = useCallback(() => fetch('/api/posts?tab=latest&limit=50&matchId=' + m.id, { cache: 'no-store' })
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); setPosts(j.posts); setError(''); })
    .catch(e => { setError(e.message); setPosts(p => p || []); }), [m.id]);
  useEffect(() => { if (active && meReady) load(); }, [active, meReady, who, load]);
  const toggle = id => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const edit = async (p, body) => { const { post } = await sendJSON('/api/posts/' + p.id, 'PUT', { body }); setPosts(l => l.map(x => x.id === p.id ? post : x)); };
  const remove = async p => { await sendJSON('/api/posts/' + p.id, 'DELETE', {}); setPosts(l => l.filter(x => x.id !== p.id)); };
  return (
    <>
      <PostComposer defaultTag={m.id} onPosted={post => setPosts(p => post.matchId === m.id ? [post, ...(p || [])] : p)} />
      {error && <p className="st-err c-err" role="alert">Could not load posts: {error}</p>}
      {posts === null ? <p className="empty">Loading…</p> : posts.length ? posts.map(p => (
        <PostCard key={p.id} p={p} m={byId(p.matchId)} isOpen={open.has(p.id)} onToggle={() => toggle(p.id)} onEdit={edit} onDelete={remove}
          onReplies={n => setPosts(l => l.map(x => x.id === p.id ? { ...x, replies: n } : x))} />
      )) : <p className="empty">No posts about this match yet.</p>}
    </>
  );
}
