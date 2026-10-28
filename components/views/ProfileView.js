'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import PostCard from '../PostCard';
import { Avatar, FollowButton, UserCard } from '../ui';
import { PTABS, SORTS } from '@/lib/consts';
import { fetchProfile, fromApi } from '@/lib/profile';
import { timeAgo } from '@/lib/util';
import { daysAgo, hue, tAgo, uniq } from '@/lib/util';

function PCard({ href, t, meta, d, a, b }) {
  return (
    <Link className="pcard" href={href}>
      <div className="pc-img" style={{ '--a': a, '--b': b }} /><h3>{t}</h3>
      <div className="pc-m"><span>{meta}</span><time>{daysAgo(Math.max(1, Math.round(d)))}</time></div>
    </Link>
  );
}

export default function ProfileView() {
  const d = useData();
  const raw = useParams().u;
  let h = raw; try { h = decodeURIComponent(raw); } catch {}
  let tab = useSearchParams().get('tab');
  if (!PTABS.some(t => t[0] === tab)) tab = 'activity';
  if (d.status !== 'ready') return null;
  return <ProfileLoader key={h} h={h} tab={tab} />;
}

// Loads the profile from PostgreSQL (/api/users/:handle). A handle that is not in the users table gets a "no such user" page.
function ProfileLoader({ h, tab }) {
  const { T, byId, me } = useData();
  const [st, setSt] = useState({ phase: 'loading' });

  useEffect(() => {
    let dead = false;
    fetchProfile(h)
      .then(api => { if (!dead) setSt(api ? { phase: 'ready', u: fromApi(api, { byId, T }) } : { phase: 'missing' }); })
      .catch(e => { if (!dead) setSt({ phase: 'error', error: e.message }); });
    return () => { dead = true; };
    // re-fetch after the settings page saved (me changes) so the own profile is never stale
  }, [h, byId, T, me]);

  if (st.phase === 'loading') return <main id="profilePage"><div className="pf-cover" style={{ '--h': hue(h) }} /></main>;
  if (st.phase === 'missing') return <main id="profilePage"><div className="pf-cover" style={{ '--h': hue(h) }} /><div className="pf-wrap"><p className="empty">There is no user called @{h}. <Link href="/" style={{ color: 'var(--accent)' }}>Back to home</Link></p></div></main>;
  if (st.phase === 'error') return <main id="profilePage"><div className="pf-cover" style={{ '--h': hue(h) }} /><div className="pf-wrap"><p className="pf-note" role="alert">Could not load this profile: {st.error}</p></div></main>;
  return <ProfilePage key={h + '|' + tab} h={h} tab={tab} u={st.u} />; // filters/sort reset when the profile or tab changes
}

const LIKED_TABS = ['likedposts', 'likedcomments', 'likedarticles'];
const LOCK = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>;

const ACT = {
  watched: ['Watched', 'eye'], liked: ['Liked', 'heart'], review: ['Reviewed', 'star'], comment: ['Commented', 'chat'], follow: ['Started following', 'user'], article: ['Published', 'doc'],
};
const ICON = {
  eye: <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
  heart: <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" />,
  pin: <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />,
  star: <path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z" />,
  user: <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-9 9c0-5 4-7 9-7s9 2 9 7z" />,
  doc: <path d="M6 2h9l5 5v15H6zm8 1.5V8h4.5" />,
  chat: <path d="M4 4h16v12H9l-5 4z" />,
};

function ActivityRow({ a, label }) {
  const [verb, icon] = ACT[a.type] || ['', 'eye'];
  let what = null;
  if (a.match) what = <Link href={`/match/${a.match.id}`}>{label(a.match)}</Link>;
  if (a.type === 'follow') what = <Link href={`/profile/${a.handle}`}>{a.name || a.handle}</Link>;
  if (a.type === 'article') what = <Link href={`/article/${a.refId}`}>{a.title}</Link>;
  return (
    <li>
      <span className={`act-ic t-${a.type}`}><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">{ICON[icon]}</svg></span>
      <div><span className="act-v">{verb}</span> {what}
        {a.type === 'review' && <div className="act-q">“{a.title}” <b>{a.rating}/10</b></div>}
        {a.type === 'comment' && <div className="act-q">“{a.title}”</div>}</div>
      <time>{a.min < 1 ? 'just now' : tAgo(a.min) + ' ago'}</time>
    </li>
  );
}

// What the user liked on posts / comments / articles (fetched when that sub-tab is opened).
function LikedContent({ h, tab, name, q, s }) {
  const { byId, label } = useData();
  const type = { likedposts: 'post', likedcomments: 'comment', likedarticles: 'article' }[tab];
  const [st, setSt] = useState({ phase: 'loading' }), [open, setOpen] = useState(() => new Set());
  useEffect(() => {
    let dead = false;
    fetch(`/api/users/${encodeURIComponent(h)}/likes?type=${type}`, { cache: 'no-store' })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; })
      .then(j => { if (!dead) setSt({ phase: 'ready', items: j.posts || j.comments || j.articles || [] }); })
      .catch(e => { if (!dead) setSt({ phase: 'error', message: e.message }); });
    return () => { dead = true; };
  }, [h, type]);
  if (st.phase === 'loading') return <p className="empty">Loading…</p>;
  if (st.phase === 'error') return <p className="pf-note" role="alert">Could not load this: {st.message}</p>;
  const text = x => (x.body || x.title || '').toLowerCase();
  let items = st.items.filter(x => !q || text(x).includes(q.toLowerCase()));
  if (s === 'az') items = [...items].sort((a, b) => text(a).localeCompare(text(b)));
  else if (s === 'old') items = [...items].reverse();
  if (!items.length) return <p className="empty">{q ? 'Nothing matches your search.' : `${name} has not liked any ${type}s yet.`}</p>;
  if (type === 'post') return items.map(p => (
    <PostCard key={p.id} p={p} m={p.matchId ? byId(p.matchId) : null} isOpen={open.has(p.id)}
      onToggle={() => setOpen(o => { const n = new Set(o); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} />
  ));
  if (type === 'comment') return <div className="pf-lc">{items.map(c => {
    const m = c.type === 'match' ? byId(c.targetId) : null;
    const href = c.type === 'article' ? `/article/${c.targetId}` : c.type === 'post' ? `/post/${c.targetId}` : m ? `/match/${m.id}` : null;
    const on = c.type === 'match' ? (m ? `on ${label(m)}` : 'on a match') : c.type === 'article' ? 'on an article' : c.type === 'post' ? 'on a post' : 'on a review';
    return (
      <article key={c.id} className="comment">
        <div className="c-head">
          <Avatar name={c.user.name} src={c.user.avatar} className="c-avatar" />
          <div><Link className="c-name" href={`/profile/${c.user.handle}`}>{c.user.name}</Link><div className="c-time">{timeAgo(c.at)}</div></div>
        </div>
        <p className="c-text">“{c.body}”</p>
        <div className="c-foot">{href ? <Link className="chip" href={href}><span className="t">{on}</span></Link> : <span className="t">{on}</span>}<span className="c-time">♥ {c.likes}</span></div>
      </article>
    );
  })}</div>;
  return <div className="pf-cards">{items.map(a => (
    <PCard key={a.id} href={`/article/${a.id}`} t={a.title} meta={`${a.category} · by ${a.author.name}`} d={Math.max(1, (Date.now() - new Date(a.publishedAt || a.updatedAt)) / 864e5)} a={`hsl(${hue(a.title)} 50% 35%)`} b={`hsl(${hue(a.title) + 60} 50% 25%)`} />
  ))}</div>;
}

function ProfilePage({ h, tab, u }) {
  const { T, matches, label } = useData();
  const { me: session } = useData();
  const me = !!session && h === session.handle;
  const [q, setQ] = useState(''), [f, setF] = useState(''), [s, setS] = useState('new');

  useEffect(() => { document.title = `${u.name} (@${h}) · Futlog`; }, [u, h]);

  const stats = [['matches', u.watched.length, 'Watched'], ['liked', u.liked.length, 'Liked'], ['reviews', u.reviews.length, 'Reviews']];
  const likedSub = LIKED_TABS.includes(tab);
  const lockedOut = tab === 'saved' && !me;
  const filterOpts = ['matches', 'liked'].includes(tab)
    ? ['League', ...uniq(matches, 'comp')].map((c, i) => [i ? c : '', c])
    : tab === 'reviews' ? [['', 'All ratings'], ['8', '8+ rating'], ['9', '9+ rating']] : null;

  // ---- list ----
  let list = null;
  if (likedSub) {
    list = <LikedContent key={tab} h={h} tab={tab} name={u.name} q={q} s={s} />;
  } else if (lockedOut) {
    list = <p className="empty">Saved articles are private.</p>;
  } else {
    let items = [], mode = 'cards';
    const daysOf = (key, m) => u.days[key][m.id] ?? 1;
    if (tab === 'activity') {
      mode = 'activity';
      items = u.activity.filter(a => a.type !== 'onsite').map((a, i) => ({ key: i, d: a.min / 1440, x: `${ACT[a.type]?.[0] || ''} ${a.match ? label(a.match) : a.name || a.title || ''}`, node: <ActivityRow a={a} label={label} /> }));
    } else if (['matches', 'liked'].includes(tab)) {
      mode = 'grid';
      items = ({ matches: u.watched, liked: u.liked })[tab].map(m => ({ key: m.id, d: daysOf(tab, m), x: label(m), f: m.comp, node: <MatchCard m={m} /> }));
    } else if (tab === 'reviews') {
      items = u.reviews.map((v, i) => ({ key: i, d: v.d, x: v.t + ' ' + label(v.m), f: v.r,
        node: <PCard href={`/match/${v.m.id}`} t={v.t} meta={`${T[v.m.h].n} ${v.m.hs}–${v.m.as} ${T[v.m.a].n} · ${v.r}/10`} d={v.d} a={T[v.m.h].c} b={T[v.m.a].c} /> }));
    } else if (tab === 'articles' || tab === 'saved') {
      items = (tab === 'saved' ? u.saved : u.arts).map(a => ({ key: a.id, d: a.d, x: a.t,
        node: <div className="pc-wrap"><PCard href={`/article/${a.id}`} t={a.t} meta={a.m} d={a.d} a={`hsl(${hue(a.t)} 50% 35%)`} b={`hsl(${hue(a.t) + 60} 50% 25%)`} />
          {me && tab === 'articles' && <Link className="pc-edit" href={`/write/${a.id}`}>Edit</Link>}</div> }));
    } else { // followers | following
      mode = 'users';
      items = u[tab].map(x => ({ key: x.h, d: 0, x: x.name + ' ' + x.h, node: <UserCard u={x} /> }));
    }
    if (f) items = items.filter(i => tab === 'reviews' ? i.f >= +f : i.f === f);
    if (q) items = items.filter(i => i.x.toLowerCase().includes(q.toLowerCase()));
    items.sort(s === 'az' ? (a, b) => a.x.localeCompare(b.x) : s === 'old' ? (a, b) => b.d - a.d : (a, b) => a.d - b.d);
    list = items.length
      ? <div className={mode === 'grid' ? 'match-grid' : mode === 'users' ? 'pf-users' : mode === 'activity' ? '' : 'pf-cards'}>
          {mode === 'activity' ? <ul className="pf-act">{items.map(i => <Fragment key={i.key}>{i.node}</Fragment>)}</ul> : items.map(i => <Fragment key={i.key}>{i.node}</Fragment>)}
        </div>
      : <p className="empty">{q || f ? 'Nothing matches your search or filter.' : tab === 'activity' ? `${u.name} has no activity yet.` : tab === 'saved' ? 'You have not saved any articles yet. Use the Save button on an article.' : tab === 'articles' && me ? 'You have not written an article yet. Use "Write article" above.' : `${u.name} has nothing here yet.`}</p>;
  }

  const cover = u.banner
    ? { backgroundImage: `url("${u.banner}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { '--h': u.hue ?? hue(h) };

  return (
    <main id="profilePage">
      <div className={`pf-cover${u.banner ? ' img' : ''}`} style={cover} />
      <div className="pf-wrap">
        <header className="pf-head">
          <Avatar name={u.name} src={u.avatar} className="pf-av" />
          <div className="pf-id"><h1>{u.name}</h1><div className="handle">@{u.h}</div>
            <div className="pf-follow">
              <Link href={`/profile/${u.h}?tab=followers`}><b>{u.followers.length}</b> Followers</Link>
              <Link href={`/profile/${u.h}?tab=following`}><b>{u.following.length}</b> Following</Link>
            </div>
            {u.bio ? <p className="pf-bio">{u.bio}</p> : null}
            <ul className="pf-meta">
              {u.loc && u.loc !== '—' ? <li><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ICON.pin}</svg>{u.loc}</li> : null}
              <li>Joined {u.joined}</li>
              {u.fav ? <li>Supports <Link href={`/search?q=${encodeURIComponent(u.fav.n)}`}>{u.fav.n}</Link></li> : null}
            </ul>
            <div className="pf-btns">{me ? <><Link className="follow pf-edit" href="/settings">Edit profile</Link> <Link className="follow pf-edit" href="/write">Write article</Link></> : <FollowButton h={u.h} />}</div></div>
          <div className="pf-stats">{stats.map(([k, n, l]) => <Link key={k} href={`/profile/${u.h}?tab=${k}`}><b>{n}</b>{l}</Link>)}</div>
        </header>
        <div className="pf-body">
          <nav className="pf-side" aria-label="Profile sections">
            <Link href={`/profile/${h}?tab=activity`} className={tab === 'activity' ? 'on' : ''}>Activity</Link>
            <Link href={`/profile/${h}?tab=matches`} className={tab === 'matches' ? 'on' : ''}>Watched</Link>
            <Link href={`/profile/${h}?tab=liked`} className={tab === 'liked' ? 'on' : ''}>Liked</Link>
            <div className="pf-sub" role="group" aria-label="Post likes">
              <div className="pf-sub-h">Post likes <small>posts, comments &amp; articles you liked</small></div>
              {[['likedposts', 'Posts'], ['likedcomments', 'Comments'], ['likedarticles', 'Articles']].map(([k, l]) => (
                <Link key={k} href={`/profile/${h}?tab=${k}`} className={k === tab ? 'on' : ''}>{l}</Link>
              ))}
            </div>
            {me && <Link href={`/profile/${h}?tab=saved`} className={`pf-saved${tab === 'saved' ? ' on' : ''}`}><span>Saved</span><em>{LOCK}Only you</em></Link>}
            <div className="pf-sep" />
            <Link href={`/profile/${h}?tab=reviews`} className={tab === 'reviews' ? 'on' : ''}>Reviews</Link>
            <Link href={`/profile/${h}?tab=articles`} className={tab === 'articles' ? 'on' : ''}>Written articles</Link>
          </nav>
          <section>
            <div className="pf-tools">
              <input type="search" placeholder="Search" aria-label="Search this page" value={q} onChange={e => setQ(e.target.value)} /><span className="sp" />
              {tab !== 'about' && filterOpts && (
                <select aria-label="Filter" value={f} onChange={e => setF(e.target.value)}>{filterOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              )}
              <button onClick={() => setS(SORTS[(SORTS.findIndex(x => x[0] === s) + 1) % 3][0])}>Sort by: {SORTS.find(x => x[0] === s)[1]} ⇅</button>
            </div>
            <div>{list}</div>
          </section>
        </div>
      </div>
    </main>
  );
}
