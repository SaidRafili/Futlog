'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import Photo from '../Photo';
import PostCard from '../PostCard';
import { newSeed } from '@/lib/shuffle';
import { articlePath } from '@/lib/slug';
import { timeAgo } from '@/lib/util';

// Home page posts: at least 9, 12 fills the 2, 3 and 4 column Pinterest layouts without a ragged last row
const POSTS_SHOWN = 12, POSTS_PHONE = 6;

// GET json from our API; resolves to null if it fails (the section then just shows its empty text)
const getJSON = url => fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);

// How many columns the match grid currently has, so we can render complete rows that fill the whole width
function useGridCols(ref, deps) {
  const [cols, setCols] = useState(8);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const read = () => {
      const n = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
      if (n > 0) setCols(n);
    };
    read();
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, deps);   // eslint-disable-line react-hooks/exhaustive-deps
  return cols;
}

// true on phones (<= 760px wide); false on the server and on the first paint, then it follows the screen
function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const read = () => setPhone(mq.matches);
    read(); mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return phone;
}

// One pill per league, busiest first. Clicking it opens the matches page with only that league's games (newest first).
function LeaguePills({ matches }) {
  const leagues = useMemo(() => {
    const m = new Map();
    for (const x of matches) {
      const l = m.get(x.leagueId) || { id: x.leagueId, name: x.comp, logo: x.leagueLogo, n: 0 };
      l.n++; if (!l.logo && x.leagueLogo) l.logo = x.leagueLogo; m.set(x.leagueId, l);
    }
    return [...m.values()].sort((x, y) => y.n - x.n || x.name.localeCompare(y.name)).slice(0, 12);
  }, [matches]);
  if (!leagues.length) return null;
  return (
    <nav className="lg-pills" aria-label="Leagues">
      {leagues.map(l => (
        <Link key={l.id} className="lg-pill" href={`/matches?league=${l.id}`}>
          <span className="lg-badge">{l.logo ? <img src={l.logo} alt="" width="20" height="20" loading="lazy" decoding="async" /> : l.name.slice(0, 1)}</span>
          {l.name}
        </Link>
      ))}
    </nav>
  );
}

export default function HomeView() {
  const d = useData();
  const ready = d.status === 'ready';
  const [arts, setArts] = useState(null), [newest, setNewest] = useState([]), [posts, setPosts] = useState(null);
  const who = d.me?.handle || '';
  const gridRef = useRef(null);
  const cols = useGridCols(gridRef, [ready]);
  const phone = usePhone();
  const MATCH_ROWS = phone ? 2 : 1;                       // desktop / tablet: one row; phone: 2 columns x 2 rows = 4 matches (always whole rows)
  const want = Math.min(ready ? d.matches.length : 0, cols * MATCH_ROWS);
  const shownMatches = ready ? d.matches.slice(0, want >= cols ? want - (want % cols) : want) : [];

  // everything below comes from PostgreSQL; re-read after sign-in so the "liked" hearts are right
  useEffect(() => {
    if (!d.meReady) return;
    // random picks: a weighted random sample (liked / discussed / fresh items come up more often), different on every reload
    const seed = newSeed();   // a fresh seed on every page load / refresh -> a different random mix each time
    getJSON(`/api/posts?tab=mix&limit=${POSTS_SHOWN}&seed=${seed}`).then(j => setPosts(j?.posts || []));
    getJSON(`/api/articles?sort=random&limit=4&seed=${seed}`).then(j => setArts(j?.articles || []));
    getJSON('/api/articles?sort=new&limit=3').then(j => setNewest(j?.articles || []));   // "Recently added" stays newest-first
  }, [d.meReady, who]);

  const featured = arts?.[0], rest = arts?.slice(1) || [];
  const meta = a => `${a.category} · ${a.readMinutes || 1} min read`;

  // "Recently added": newest published articles + newest finished matches, newest first
  const updates = ready ? [
    ...[...newest].filter(a => a.publishedAt).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 3)
      .map(a => ({ key: 'a' + a.id, t: `New article: ${a.title}`, href: articlePath(a.id, a.title), at: new Date(a.publishedAt).getTime() })),
    ...d.matches.slice(0, 2).map(m => ({ key: 'm' + m.id, t: `New match added: ${d.label(m)}`, href: d.mhref(m), at: m.ts })),
  ].sort((x, y) => y.at - x.at) : [];

  return (
    <div className="page" id="home">
      <div className="ad-space" aria-hidden="true" />
      <main className="content">
        {ready && <LeaguePills matches={d.matches} />}

        <section id="matches">
          <div className="sec-head"><h2>Top matches this week</h2><Link href="/matches">See all matches</Link></div>
          <div className="match-grid match-grid-home" ref={gridRef}>{shownMatches.map(m => <MatchCard key={m.id} m={m} />)}</div>
        </section>

        <section id="posts">
          <div className="sec-head"><h2>Posts to explore</h2><Link href="/feed">Open the feed</Link></div>
          {posts && !posts.length
            ? <p className="empty">No posts yet. <Link href="/feed" style={{ color: 'var(--accent)' }}>Share the first one.</Link></p>
            : <div className="pin-grid">{ready && posts?.slice(0, phone ? POSTS_PHONE : POSTS_SHOWN).map(p => (
                <PostCard pin key={p.id} p={p} m={p.matchId ? d.byId(p.matchId) : null}
                  onReplies={n => setPosts(l => l.map(x => x.id === p.id ? { ...x, replies: n } : x))} />
              ))}</div>}
        </section>

        <section id="articles">
          <div className="sec-head"><h2>Articles to read</h2><Link href="/write">Write an article</Link></div>
          {arts && !featured ? <p className="empty">No articles have been published yet. <Link href="/write" style={{ color: 'var(--accent)' }}>Write the first one.</Link></p> : (
            <div className="articles">
              {featured && (
                <Link className="featured" href={articlePath(featured.id, featured.title)}>
                  <div className="thumb"><Photo src={featured.cover} alt={featured.title} width={560} height={300} sizes="(max-width: 560px) 100vw, 280px" /></div>
                  <div><h3>{featured.title}</h3><p>{meta(featured)}</p></div>
                </Link>
              )}
              <div className="article-list">
                {rest.map(a => <Link key={a.id} href={articlePath(a.id, a.title)}><b>{a.title}</b><span>{meta(a)}</span></Link>)}
              </div>
            </div>
          )}
        </section>


        <section>
          <div className="sec-head"><h2>Recently added</h2></div>
          <ul className="updates">
            {updates.map(u => <li key={u.key}><Link href={u.href}>{u.t}</Link><time>{timeAgo(u.at)}</time></li>)}
          </ul>
        </section>
      </main>
      <div className="ad-space" aria-hidden="true" />
    </div>
  );
}
