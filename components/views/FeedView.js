'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useData } from '../DataProvider';
import PostCard from '../PostCard';
import PostComposer from '../PostComposer';
import { UserCard } from '../ui';
import { sendJSON } from '@/lib/profile';

export default function FeedView() {
  const d = useData();
  useEffect(() => { document.title = 'Feed · Futlog'; }, []);
  if (d.status !== 'ready' || !d.meReady) return null;
  return <FeedPage />;
}

// Feed posts live in the `posts` table; replies are rows in `comments` (type 'post'). Posts and replies can be edited / deleted by their author.
function FeedPage() {
  const { byId, label, following, me } = useData();
  const [posts, setPosts] = useState(null), [error, setError] = useState('');
  const [tab, setTab] = useState('latest');
  const [fm, setFm] = useState(0);                       // match filter
  const [open, setOpen] = useState(() => new Set());
  const [sug, setSug] = useState([]);
  const who = me?.handle || '';

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts?tab=${tab}&limit=100`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'HTTP ' + res.status);
      setPosts(j.posts); setError('');
    } catch (e) { setError(e.message); setPosts(p => p || []); }
  }, [tab]);
  useEffect(() => { load(); }, [load, who]);

  useEffect(() => {      // "Who to follow": people from the users table that you do not follow yet
    fetch('/api/users?suggest=1&limit=5', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => setSug(j?.users || [])).catch(() => {});
  }, [who]);

  const list = (posts || []).filter(p => !fm || p.matchId === fm);
  const cnt = {}; (posts || []).forEach(p => p.matchId && (cnt[p.matchId] = (cnt[p.matchId] || 0) + 1));
  const hot = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => byId(+id)).filter(Boolean);
  const tags = useMemo(() => {        // most used #hashtags in the loaded posts
    const c = new Map();
    for (const p of posts || []) for (const t of new Set((p.body.match(/(?:^|[^\w#&])#([\p{L}\p{N}_]{2,50})/gu) || []).map(x => x.replace(/^[^#]*#/, '').toLowerCase()))) c.set(t, (c.get(t) || 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  }, [posts]);
  const toggle = id => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const posted = post => { if (tab === 'top') setTab('latest'); else setPosts(p => [post, ...(p || [])]); setFm(0); };
  const edit = async (p, body) => { const { post } = await sendJSON('/api/posts/' + p.id, 'PUT', { body }); setPosts(l => l.map(x => x.id === p.id ? post : x)); };
  const remove = async p => { await sendJSON('/api/posts/' + p.id, 'DELETE', {}); setPosts(l => l.filter(x => x.id !== p.id)); };

  return (
    <main id="feedPage">
      <div className="fd-wrap">
        <section>
          <div className="fd-head"><h1>Feed</h1>
            <div className="fd-tabs" role="tablist">
              {[['latest', 'Latest'], ['top', 'Top'], ['following', 'Following']].map(([v, l]) => (
                <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}>{l}</button>
              ))}
            </div>
          </div>
          <PostComposer onPosted={posted} />
          <div className="fd-filter" hidden={!fm}>
            {fm && byId(fm) ? <>Showing posts about <b>{label(byId(fm))}</b><button onClick={() => setFm(0)}>Clear</button></> : null}
          </div>
          {error && <p className="pf-note" role="alert">Could not load the feed: {error}</p>}
          <div>
            {posts === null ? <p className="empty">Loading…</p> : list.length ? list.map(p => (
              <PostCard key={p.id} p={p} m={p.matchId ? byId(p.matchId) : null} isOpen={open.has(p.id)} onToggle={() => toggle(p.id)} onEdit={edit} onDelete={remove}
                onReplies={n => setPosts(l => l.map(x => x.id === p.id ? { ...x, replies: n } : x))} />
            )) : <p className="empty">{tab === 'following' ? (me ? 'Follow some people and their posts will show up here.' : 'Sign in and follow some people to fill this tab.') : 'No posts yet. Be the first.'}</p>}
          </div>
        </section>
        <aside className="fd-side">
          <div className="fd-box fd-trend"><h2>Trending hashtags</h2>
            {tags.length ? tags.map(([t, n]) => (
              <Link key={t} className="hm" href={`/search?${new URLSearchParams({ q: '#' + t, type: 'posts' })}`}>#{t}<span>{n}</span></Link>
            )) : <span style={{ color: 'var(--muted)' }}>Add a #hashtag to a post and it shows up here.</span>}
          </div>
          <div className="fd-box"><h2>Hot matches</h2>
            {hot.length ? hot.map(m => (
              <button key={m.id} className={`hm ${fm === m.id ? 'on' : ''}`} onClick={() => setFm(fm === m.id ? 0 : m.id)}>{label(m)}<span>{cnt[m.id]}</span></button>
            )) : <span style={{ color: 'var(--muted)' }}>Tag a match in a post and it shows up here.</span>}
          </div>
          <div className="fd-box"><h2>Who to follow</h2>
            {sug.filter(x => !following.has(x.handle)).length
              ? sug.filter(x => !following.has(x.handle)).map(x => <UserCard key={x.handle} u={{ h: x.handle, name: x.name, avatar: x.avatar }} />)
              : <span style={{ color: 'var(--muted)' }}>No one else to follow yet.</span>}
          </div>
        </aside>
      </div>
    </main>
  );
}
