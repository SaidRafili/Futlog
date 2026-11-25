'use client';
import Link from 'next/link';
import { notFound, useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import PostCard from '../PostCard';
import CommentSection from '../Comments';
import { sendJSON } from '@/lib/profile';
import { parseId } from '@/lib/slug';

// One post on its own page (/post/:id): where a post's share link, its timestamp and search results lead.
// Left column: the post, then its replies underneath. Right column: recommended posts.
export default function PostView() {
  const d = useData();
  const id = parseId(useParams().id) || 'x', router = useRouter();
  const [st, setSt] = useState({ phase: 'loading' });
  const who = d.me?.handle || '';

  useEffect(() => {
    if (!d.meReady) return;
    let dead = false;
    fetch('/api/posts/' + encodeURIComponent(id), { cache: 'no-store' })
      .then(async r => { const j = await r.json().catch(() => ({})); if (r.status === 404) return { phase: 'missing' }; if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return { phase: 'ready', post: j.post }; })
      .catch(e => ({ phase: 'error', message: e.message }))
      .then(s => { if (!dead) setSt(s); });
    return () => { dead = true; };
  }, [id, d.meReady, who]);

  if (d.status !== 'ready' || !d.meReady) return null;
  const back = <p className="pv-back"><Link href="/feed">← Back to the feed</Link></p>;
  if (st.phase === 'loading') return <main className="fd-wrap pv"><p className="empty">Loading…</p></main>;
  if (st.phase === 'missing') notFound();
  if (st.phase === 'error') return <main className="fd-wrap pv"><div>{back}<p className="pf-note" role="alert">Could not load this post: {st.message}</p></div></main>;
  const p = st.post;
  return (
    <main className="fd-wrap pv">
      <div className="pv-main">
        {back}
        <PostCard p={p} m={p.matchId ? d.byId(p.matchId) : null} isOpen noReplies
          onToggle={() => document.getElementById('replies')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          onEdit={async (x, body) => { const { post } = await sendJSON('/api/posts/' + x.id, 'PUT', { body }); setSt({ phase: 'ready', post }); }}
          onDelete={async x => { await sendJSON('/api/posts/' + x.id, 'DELETE', {}); router.push('/feed'); }} />
        <section className="pv-replies" id="replies" aria-labelledby="pv-replies-h">
          <h2 id="pv-replies-h">Replies <span>{p.replies}</span></h2>
          <CommentSection type="post" id={p.id} placeholder="Write a reply" max={280}
            onCount={n => setSt(s => s.post && s.post.replies !== n ? { ...s, post: { ...s.post, replies: n } } : s)} />
        </section>
      </div>
      <aside className="fd-side pv-side" aria-label="Recommended posts"><Recommended id={p.id} who={who} /></aside>
    </main>
  );
}

// A few other posts to read next: a weighted random pick of recent, liked and discussed posts, never the one you are on.
function Recommended({ id, who }) {
  const d = useData();
  const [list, setList] = useState(null);
  useEffect(() => {
    let dead = false;
    setList(null);
    fetch(`/api/posts?tab=mix&limit=6&exclude=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { posts: [] }).catch(() => ({ posts: [] }))
      .then(j => { if (!dead) setList(j.posts || []); });
    return () => { dead = true; };
  }, [id, who]);
  return (
    <div className="fd-box pv-rec">
      <h2>Recommended posts</h2>
      {list === null ? <p className="empty">Loading…</p>
        : !list.length ? <p className="empty">No other posts yet.</p>
        : <div className="pv-rec-list">{list.map(x => <PostCard key={x.id} p={x} m={x.matchId ? d.byId(x.matchId) : null} compact />)}</div>}
    </div>
  );
}
