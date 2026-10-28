'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import PostCard from '../PostCard';
import { Avatar, LikeButton, MiniBadge } from '../ui';
import { profileHref, timeAgo } from '@/lib/util';
import { cs } from '@/lib/data';

// GET json from our API; resolves to null if it fails (the section then just shows its empty text)
const getJSON = url => fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);

function HomeComment({ c }) {
  const { T, byId, label } = useData();
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
          <Link className="chip" href={`/match/${m.id}`} aria-label={label(m)}>
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
  const [arts, setArts] = useState(null), [comments, setComments] = useState(null), [posts, setPosts] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const toggle = id => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const who = d.me?.handle || '';

  // everything below comes from PostgreSQL; re-read after sign-in so the "liked" hearts are right
  useEffect(() => {
    if (!d.meReady) return;
    getJSON('/api/posts?tab=latest&limit=4').then(j => setPosts(j?.posts || []));
    getJSON('/api/articles?sort=top&limit=4').then(j => setArts(j?.articles || []));
    getJSON('/api/comments?type=match&top=1&limit=3').then(j => setComments(j?.comments || []));
  }, [d.meReady, who]);

  const featured = arts?.[0], rest = arts?.slice(1) || [];
  const meta = a => `${a.category} · ${a.readMinutes || 1} min read`;

  // "Recently added": newest published articles + newest finished matches, newest first
  const updates = ready && arts ? [
    ...[...arts].filter(a => a.publishedAt).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 3)
      .map(a => ({ key: 'a' + a.id, t: `New article: ${a.title}`, href: `/article/${a.id}`, at: new Date(a.publishedAt).getTime() })),
    ...d.matches.slice(0, 2).map(m => ({ key: 'm' + m.id, t: `New match added: ${d.label(m)}`, href: `/match/${m.id}`, at: m.ts })),
  ].sort((x, y) => y.at - x.at) : [];

  return (
    <div className="page" id="home">
      <div className="ad-space" aria-hidden="true" />
      <main className="content">
        <section id="posts">
          <div className="sec-head"><h2>Latest posts</h2><Link href="/feed">Open the feed</Link></div>
          {posts && !posts.length
            ? <p className="empty">No posts yet. <Link href="/feed" style={{ color: 'var(--accent)' }}>Share the first one.</Link></p>
            : <div className="home-posts">{ready && posts?.map(p => (
                <PostCard key={p.id} p={p} m={p.matchId ? d.byId(p.matchId) : null} isOpen={open.has(p.id)} onToggle={() => toggle(p.id)}
                  onReplies={n => setPosts(l => l.map(x => x.id === p.id ? { ...x, replies: n } : x))} />
              ))}</div>}
        </section>

        <section id="matches">
          <div className="sec-head"><h2>Top matches this week</h2><Link href="/search?q=&type=matches">See all matches</Link></div>
          <div className="match-grid">{ready && d.matches.slice(0, 6).map(m => <MatchCard key={m.id} m={m} />)}</div>
        </section>

        <section>
          <div className="sec-head"><h2>Most liked comments on matches</h2></div>
          {comments && !comments.length
            ? <p className="empty">No match comments yet. Open a match and start the conversation.</p>
            : <div className="comments">{ready && comments?.map(c => <HomeComment key={c.id} c={c} />)}</div>}
        </section>

        <section id="articles">
          <div className="sec-head"><h2>Top articles</h2><Link href="/write">Write an article</Link></div>
          {arts && !featured ? <p className="empty">No articles have been published yet. <Link href="/write" style={{ color: 'var(--accent)' }}>Write the first one.</Link></p> : (
            <div className="articles">
              {featured && (
                <Link className="featured" href={`/article/${featured.id}`}>
                  <div className="thumb" role="img" aria-label="Article photo" style={featured.cover ? { backgroundImage: `url('${featured.cover}')` } : undefined} />
                  <div><h3>{featured.title}</h3><p>{meta(featured)}</p></div>
                </Link>
              )}
              <div className="article-list">
                {rest.map(a => <Link key={a.id} href={`/article/${a.id}`}><b>{a.title}</b><span>{meta(a)}</span></Link>)}
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
