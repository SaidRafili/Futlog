'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import { FollowButton, UserCard } from '../ui';
import { PTABS, SORTS } from '@/lib/demo';
import { avatarBg, daysAgo, hue, uniq } from '@/lib/util';

function PCard({ href, t, meta, d, a, b }) {
  return (
    <Link className="pcard" href={href}>
      <div className="pc-img" style={{ '--a': a, '--b': b }} /><h3>{t}</h3>
      <div className="pc-m"><span>{meta}</span><time>{daysAgo(d)}</time></div>
    </Link>
  );
}

export default function ProfileView() {
  const d = useData();
  const raw = useParams().u;
  let h = raw; try { h = decodeURIComponent(raw); } catch {}
  let tab = useSearchParams().get('tab');
  if (!PTABS.some(t => t[0] === tab)) tab = 'matches';
  if (d.status !== 'ready') return null;
  return <ProfilePage key={h + '|' + tab} h={h} tab={tab} />; // filters/sort reset when the profile or tab changes
}

function ProfilePage({ h, tab }) {
  const { T, matches, getUser, label, following } = useData();
  const u = getUser(h), me = h === 'saidrafili';
  const [q, setQ] = useState(''), [f, setF] = useState(''), [s, setS] = useState('new');

  useEffect(() => { document.title = `${u.name} (@${h}) · Futlog`; }, [u, h]);

  const stats = [['matches', u.watched.length, 'Matches'], ['onsite', u.onsite.length, 'On-site'], ['liked', u.liked.length, 'Liked'], ['reviews', u.reviews.length, 'Reviews']];
  const filterOpts = ['matches', 'liked', 'onsite'].includes(tab)
    ? ['League', ...uniq(matches, 'comp')].map((c, i) => [i ? c : '', c])
    : tab === 'reviews' ? [['', 'All ratings'], ['8', '8+ rating'], ['9', '9+ rating']] : null;

  // ---- list ----
  let list = null;
  if (tab === 'about') {
    const rec = u.watched.slice(0, 3);
    list = (
      <div className="pf-about"><p>{u.bio}</p>
        <dl><dt>Joined</dt><dd>{u.joined}</dd><dt>Location</dt><dd>{u.loc}</dd>
          <dt>Favourite team</dt><dd><Link href={`/search?q=${encodeURIComponent(u.fav.n)}`}>{u.fav.n}</Link></dd>
          <dt>Recently watched</dt><dd>{rec.map((m, i) => <span key={m.id}>{i > 0 && <br />}<Link href={`/match/${m.id}`}>{label(m)}</Link></span>)}</dd></dl>
        <div className="pf-chips">{PTABS.slice(0, 6).map(([k, l]) => <Link key={k} href={`/profile/${h}?tab=${k}`}>{l}</Link>)}</div>
      </div>
    );
  } else {
    let items = [], mode = 'cards';
    const dOf = m => 1 + (m.id * 37 + u.h.length * 11) % 90;
    if (['matches', 'liked', 'onsite'].includes(tab)) {
      mode = 'grid';
      items = ({ matches: u.watched, liked: u.liked, onsite: u.onsite })[tab].map(m => ({ key: m.id, d: dOf(m), x: label(m), f: m.comp, node: <MatchCard m={m} /> }));
    } else if (tab === 'reviews') {
      items = u.reviews.map((v, i) => ({ key: i, d: v.d, x: v.t + ' ' + label(v.m), f: v.r,
        node: <PCard href={`/match/${v.m.id}`} t={v.t} meta={`${T[v.m.h].n} ${v.m.hs}–${v.m.as} ${T[v.m.a].n} · ${v.r}/10`} d={v.d} a={T[v.m.h].c} b={T[v.m.a].c} /> }));
    } else if (tab === 'articles') {
      items = u.arts.map(a => ({ key: a.id, d: a.id * 6, x: a.t,
        node: <PCard href={`/article/${a.id}`} t={a.t} meta={a.m} d={a.id * 6} a={`hsl(${hue(a.t)} 50% 35%)`} b={`hsl(${hue(a.t) + 60} 50% 25%)`} /> }));
    } else { // followers | following
      mode = 'users';
      items = u[tab].map(x => ({ key: x, d: 0, x: getUser(x).name + ' ' + x, node: <UserCard h={x} /> }));
    }
    if (f) items = items.filter(i => tab === 'reviews' ? i.f >= +f : i.f === f);
    if (q) items = items.filter(i => i.x.toLowerCase().includes(q.toLowerCase()));
    items.sort(s === 'az' ? (a, b) => a.x.localeCompare(b.x) : s === 'old' ? (a, b) => b.d - a.d : (a, b) => a.d - b.d);
    list = items.length
      ? <div className={mode === 'grid' ? 'match-grid' : mode === 'users' ? 'pf-users' : 'pf-cards'}>{items.map(i => <Fragment key={i.key}>{i.node}</Fragment>)}</div>
      : <p className="empty">{q || f ? 'Nothing matches your search or filter.' : `${u.name} has nothing here yet.`}</p>;
  }

  return (
    <main id="profilePage">
      <div className="pf-cover" style={{ '--h': hue(h) }} />
      <div className="pf-wrap">
        <header className="pf-head">
          <div className="pf-av" style={{ background: avatarBg(u.name, 45, 38) }}>{u.name[0]}</div>
          <div className="pf-id"><h1>{u.name}</h1><div className="handle">@{u.h}</div>{me ? null : <FollowButton h={u.h} />}</div>
          <div className="pf-stats">{stats.map(([k, n, l]) => <Link key={k} href={`/profile/${u.h}?tab=${k}`}><b>{n}</b>{l}</Link>)}</div>
        </header>
        <div className="pf-body">
          <nav className="pf-side" aria-label="Profile sections">
            {PTABS.map(([k, l]) => <Link key={k} href={`/profile/${h}?tab=${k}`} className={k === tab ? 'on' : ''}>{l}</Link>)}
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
