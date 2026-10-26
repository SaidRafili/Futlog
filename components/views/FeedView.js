'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import CommentSection from '../Comments';
import { Avatar, LikeButton, MiniBadge, ShareButton, UserCard } from '../ui';
import { sendJSON } from '@/lib/profile';
import { profileHref, timeAgo } from '@/lib/util';

const ico = d => <svg width="15" height="15" viewBox="0 0 24 24"><path d={d} /></svg>;
const ICO = {
  heart: ico('M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z'),
  chat: ico('M4 4h16v12H9l-5 4z'),
  link: ico('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1')
};

function FeedMatch({ m }) {
  const { T, label } = useData();
  const h = T[m.h], a = T[m.a];
  return (
    <Link className="p-match" href={`/match/${m.id}`} style={{ '--a': h.c, '--b': a.c }} aria-label={label(m)}>
      <span className="mini"><MiniBadge t={h} />{m.hs}–{m.as}<MiniBadge t={a} /></span>
      <span>{[m.comp, m.stage, m.season].filter(Boolean).join(' · ')}</span>
    </Link>
  );
}

export default function FeedView() {
  const d = useData();
  useEffect(() => { document.title = 'Feed · Futlog'; }, []);
  if (d.status !== 'ready' || !d.meReady) return null;
  return <FeedPage />;
}

// Feed posts live in the `posts` table; replies are rows in `comments` (type 'post'). Posts and replies can be edited / deleted by their author.
function FeedPage() {
  const { matches, byId, label, following, me, openAuth } = useData();
  const [posts, setPosts] = useState(null), [error, setError] = useState('');
  const [tab, setTab] = useState('latest');
  const [fm, setFm] = useState(0);                       // match filter
  const [open, setOpen] = useState(() => new Set());
  const [text, setText] = useState(''), [tag, setTag] = useState('0'), [busy, setBusy] = useState(false), [perr, setPerr] = useState('');
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
  const toggle = id => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = async e => {
    e.preventDefault();
    const t = text.trim(); if (!t || busy) return;
    if (!me) { openAuth('signin'); return; }
    setBusy(true); setPerr('');
    try {
      const { post } = await sendJSON('/api/posts', 'POST', { body: t, matchId: +tag || undefined });
      setText(''); setTag('0');
      if (tab === 'top') setTab('latest'); else setPosts(p => [post, ...(p || [])]);
    } catch (x) { setPerr(x.message); } finally { setBusy(false); }
  };
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
          <form className="fd-comp" onSubmit={submit}>
            <input type="text" value={text} onChange={e => { setText(e.target.value); setPerr(''); }} placeholder={me ? 'Share a thought on the game…' : 'Sign in to share a thought on the game…'} maxLength={280} aria-label="Write a post" />
            <div className="fd-row">
              <select value={tag} onChange={e => setTag(e.target.value)} aria-label="Tag a match">
                <option value="0">Tag a match (optional)</option>
                {matches.slice(0, 100).map(m => <option key={m.id} value={m.id}>{label(m)}</option>)}
              </select>
              <button type="submit" disabled={busy}>Post</button>
            </div>
            {perr && <p className="st-err" role="alert">{perr}</p>}
          </form>
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

function PostCard({ p, m, isOpen, onToggle, onEdit, onDelete, onReplies }) {
  const [editing, setEditing] = useState(false), [v, setV] = useState(p.body), [err, setErr] = useState(''), [confirm, setConfirm] = useState(false);
  const save = async e => {
    e.preventDefault();
    const t = v.trim(); if (!t) { setErr('A post cannot be empty'); return; }
    if (t === p.body) { setEditing(false); return; }
    try { await onEdit(p, t); setEditing(false); setErr(''); } catch (x) { setErr(x.message); }
  };
  const del = async () => { try { await onDelete(p); } catch (x) { setErr(x.message); setConfirm(false); } };
  return (
    <article className="post" style={{ '--hc': 'var(--accent-deep)' }}>
      <Link href={profileHref(p.user.handle)} style={{ display: 'contents' }}><Avatar name={p.user.name} src={p.user.avatar} className="p-av" /></Link>
      <div>
        <div className="p-top"><Link href={profileHref(p.user.handle)}>{p.user.name}</Link><small>@{p.user.handle}</small><time>{timeAgo(p.at)}{p.editedAt ? ' · edited' : ''}</time></div>
        {editing ? (
          <form className="c-editform" onSubmit={save}>
            <textarea value={v} onChange={e => { setV(e.target.value); setErr(''); }} maxLength={280} rows={3} aria-label="Edit your post" autoFocus />
            <div className="c-acts"><button type="submit" className="btn primary sm">Save</button><button type="button" className="btn ghost sm" onClick={() => { setV(p.body); setEditing(false); setErr(''); }}>Cancel</button></div>
          </form>
        ) : <p className="p-text">{p.body}</p>}
        {err && <p className="st-err" role="alert">{err}</p>}
        {m ? <FeedMatch m={m} /> : null}
        <div className="p-acts">
          <LikeButton type="post" id={p.id} count={p.likes} liked={p.liked}>
            {({ on, n, toggle }) => <button className={on ? 'on' : ''} aria-pressed={on} onClick={toggle}>{ICO.heart}{n}</button>}
          </LikeButton>
          <button className={isOpen ? 'on' : ''} onClick={onToggle}>{ICO.chat}{p.replies}</button>
          <ShareButton icon={ICO.link} />
          {p.mine && !editing && <button onClick={() => setEditing(true)}>Edit</button>}
          {p.mine && (confirm ? <><button onClick={del} style={{ color: '#ff8b94' }}>Delete?</button><button onClick={() => setConfirm(false)}>No</button></> : <button onClick={() => setConfirm(true)}>Delete</button>)}
        </div>
        {isOpen && <div className="replies"><CommentSection type="post" id={p.id} placeholder="Write a reply" max={280} onCount={onReplies} /></div>}
      </div>
    </article>
  );
}
