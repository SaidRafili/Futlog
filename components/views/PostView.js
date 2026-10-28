'use client';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import PostCard from '../PostCard';
import { sendJSON } from '@/lib/profile';

// One post on its own page (/post/:id): where a post's share link, its timestamp and search results lead. Replies are open by default.
export default function PostView() {
  const d = useData();
  const id = useParams().id, router = useRouter();
  const [st, setSt] = useState({ phase: 'loading' });
  const who = d.me?.handle || '';

  useEffect(() => {
    if (!d.meReady) return;
    let dead = false;
    fetch('/api/posts/' + encodeURIComponent(id), { cache: 'no-store' })
      .then(async r => { const j = await r.json().catch(() => ({})); if (r.status === 404) return { phase: 'missing' }; if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return { phase: 'ready', post: j.post }; })
      .catch(e => ({ phase: 'error', message: e.message }))
      .then(s => { if (!dead) { setSt(s); document.title = s.post ? `${s.post.user.name}: “${(s.post.body || 'Picture').slice(0, 60)}” · Futlog` : 'Post · Futlog'; } });
    return () => { dead = true; };
  }, [id, d.meReady, who]);

  if (d.status !== 'ready' || !d.meReady) return null;
  const back = <p className="pv-back"><Link href="/feed">← Back to the feed</Link></p>;
  if (st.phase === 'loading') return <main className="fd-wrap pv"><p className="empty">Loading…</p></main>;
  if (st.phase === 'missing') return <main className="fd-wrap pv"><div>{back}<p className="empty">This post does not exist any more. It may have been deleted.</p></div></main>;
  if (st.phase === 'error') return <main className="fd-wrap pv"><div>{back}<p className="pf-note" role="alert">Could not load this post: {st.message}</p></div></main>;
  const p = st.post;
  return (
    <main className="fd-wrap pv">
      <div>
        {back}
        <PostCard p={p} m={p.matchId ? d.byId(p.matchId) : null} isOpen onToggle={() => {}}
          onEdit={async (x, body) => { const { post } = await sendJSON('/api/posts/' + x.id, 'PUT', { body }); setSt({ phase: 'ready', post }); }}
          onDelete={async x => { await sendJSON('/api/posts/' + x.id, 'DELETE', {}); router.push('/feed'); }}
          onReplies={n => setSt(s => s.post ? { ...s, post: { ...s.post, replies: n } } : s)} />
      </div>
    </main>
  );
}
