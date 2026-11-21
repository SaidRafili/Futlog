'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import PostCard from '../PostCard';
import { Avatar, LikeButton, MiniBadge } from '../ui';
import { profileHref, timeAgo } from '@/lib/util';
import { cs } from '@/lib/data';
import { newSeed } from '@/lib/shuffle';
import { articlePath } from '@/lib/slug';

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

function HomeComment({ c }) {
  const { T, byId, label, mhref } = useData();
  const m = byId(c.targetId), h = m && T[m.h], a = m && T[m.a];
  return (
    <article className="comment">
      <div className="c-head">
        <Avatar name={c.user.name} src={c.user.avatar} className="c-avatar" />
        <div><Link className="c-name" href={profileHref(c.user.handle)}>{c.user.name}</Link><div className="c-time">{timeAgo(c.at)}</div></div>
      </div>
      <p className="c-text">“{c.body}”</p>
      <div className="c-foot">
        {m ? (
          <Link className="chip" href={mhref(m)} aria-label={label(m)}>
            <span className="mini"><MiniBadge t={h} />{m.hs}–{m.as}<MiniBadge t={a} /></span>
            <span className="t">{cs(m)}</span>
          </Link>
        ) : <span />}
        <LikeButton type="comment" id={c.id} count={c.likes} liked={c.liked} />
      </div>
    </article>
  );
}

export default function HomeView() {
  const d = useData();
  const ready = d.status === 'ready';
  const [arts, setArts] = useState(null), [newest, setNewest] = useState([]), [comments, setComments] = useState(null), [posts, setPosts] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const toggle = id => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const who = d.me?.handle || '';
  const gridRef = useRef(null);
  const cols = useGridCols(gridRef, [ready]);
  const MATCH_ROWS = 2;                                   // always whole rows, so the last row is never half empty
  const want = Math.min(ready ? d.matches.length : 0, cols * MATCH_ROWS);
  const shownMatches = ready ? d.matches.slice(0, want >= cols ? want - (want % cols) : want) : [];

  // everything below comes from PostgreSQL; re-read after sign-in so the "liked" hearts are right
  useEffect(() => {
    if (!d.meReady) return;
    // random picks: a weighted random sample (liked / discussed / fresh items come up more often), different on every reload
    const seed = newSeed();   // a fresh seed on every page load / refresh -> a different random mix each time
    getJSON(`/api/posts?tab=mix&limit=6&seed=${seed}`).then(j => setPosts(j?.posts || []));
    getJSON(`/api/articles?sort=random&limit=4&seed=${seed}`).then(j => setArts(j?.articles || []));
    getJSON(`/api/comments?type=match&top=1&random=1&limit=3&seed=${seed}`).then(j => setComments(j?.comments || []));
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
        <section id="posts">
          <div className="sec-head"><h2>Posts to explore</h2><Link href="/feed">Open the feed</Link></div>
          {posts && !posts.length
            ? <p className="empty">No posts yet. <Link href="/feed" style={{ color: 'var(--accent)' }}>Share the first one.</Link></p>
            : <div className="home-posts">{ready && posts?.map(p => (
                <PostCard compact key={p.id} p={p} m={p.matchId ? d.byId(p.matchId) : null} isOpen={open.has(p.id)} onToggle={() => toggle(p.id)}
                  onReplies={n => setPosts(l => l.map(x => x.id === p.id ? { ...x, replies: n } : x))} />
              ))}</div>}
        </section>

        <section id="matches">
          <div className="sec-head"><h2>Top matches this week</h2><Link href="/matches">See all matches</Link></div>
          <div className="match-grid match-grid-fill" ref={gridRef}>{shownMatches.map(m => <MatchCard key={m.id} m={m} />)}</div>
        </section>

        <section>
          <div className="sec-head"><h2>Match comments worth reading</h2></div>
          {comments && !comments.length
            ? <p className="empty">No match comments yet. Open a match and start the conversation.</p>
            : <div className="comments">{ready && comments?.map(c => <HomeComment key={c.id} c={c} />)}</div>}
        </section>

        <section id="articles">
          <div className="sec-head"><h2>Articles to read</h2><Link href="/write">Write an article</Link></div>
          {arts && !featured ? <p className="empty">No articles have been published yet. <Link href="/write" style={{ color: 'var(--accent)' }}>Write the first one.</Link></p> : (
            <div className="articles">
              {featured && (
                <Link className="featured" href={articlePath(featured.id, featured.title)}>
                  <div className="thumb" role="img" aria-label="Article photo" style={featured.cover ? { backgroundImage: `url('${featured.cover}')` } : undefined} />
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
