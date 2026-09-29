'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import { MiniBadge, ShareButton, UserCard } from '../ui';
import { POOL } from '@/lib/demo';
import { avatarBg, profileHref, tAgo } from '@/lib/util';

const ico = d => <svg width="15" height="15" viewBox="0 0 24 24"><path d={d} /></svg>;
const ICO = {
  heart: ico('M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z'),
  chat: ico('M4 4h16v12H9l-5 4z'),
  link: ico('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1')
};

function ReplyForm({ onReply }) {
  const [v, setV] = useState('');
  const submit = e => { e.preventDefault(); const t = v.trim(); if (!t) return; onReply(t); setV(''); };
  return (
    <form onSubmit={submit}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder="Write a reply" aria-label="Write a reply" maxLength={280} /><button>Reply</button>
    </form>
  );
}

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
  if (d.status !== 'ready') return null;
  return <FeedPage />;
}

function FeedPage() {
  const { T, matches, byId, label, getUser, feed0, following } = useData();
  const [posts, setPosts] = useState(feed0);
  const [tab, setTab] = useState('latest');
  const [fm, setFm] = useState(0);                       // match filter
  const [liked, setLiked] = useState(() => new Set());
  const [open, setOpen] = useState(() => new Set());
  const [text, setText] = useState(''), [tag, setTag] = useState('0');
  const nextId = useRef(100);

  const toggle = (set, setter, id) => setter(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const lk = p => p.likes + (liked.has(p.id) ? 1 : 0);

  const list = posts.filter(p => (!fm || p.m === fm) && (tab !== 'following' || following.has(p.u)))
    .sort(tab === 'top' ? (a, b) => lk(b) - lk(a) : (a, b) => a.min - b.min);

  const cnt = {}; posts.forEach(p => p.m && (cnt[p.m] = (cnt[p.m] || 0) + 1));
  const hot = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => byId(+id));
  const sug = POOL.filter(x => x !== 'saidrafili' && !following.has(x)).slice(0, 3);

  const submit = e => {
    e.preventDefault();
    const t = text.trim(); if (!t) return;
    setPosts(p => [{ id: ++nextId.current, u: 'you', m: +tag, min: 0, likes: 0, text: t, rep: [] }, ...p]); // TODO: send to your backend
    setText(''); setTag('0'); setTab('latest');
  };
  const reply = (id, t) => setPosts(p => p.map(x => x.id === id ? { ...x, rep: [...x.rep, { u: 'you', text: t, min: 0 }] } : x));

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
            <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Share a thought on the game…" maxLength={280} aria-label="Write a post" />
            <div className="fd-row">
              <select value={tag} onChange={e => setTag(e.target.value)} aria-label="Tag a match">
                <option value="0">Tag a match (optional)</option>
                {matches.slice(0, 100).map(m => <option key={m.id} value={m.id}>{label(m)}</option>)}
              </select>
              <button type="submit">Post</button>
            </div>
          </form>
          <div className="fd-filter" hidden={!fm}>
            {fm ? <>Showing posts about <b>{label(byId(fm))}</b><button onClick={() => setFm(0)}>Clear</button></> : null}
          </div>
          <div>
            {list.length ? list.map(p => {
              const m = p.m && byId(p.m), isOpen = open.has(p.id), un = getUser(p.u).name;
              return (
                <article key={p.id} className="post" style={{ '--hc': avatarBg(p.u, 55, 45) }}>
                  <Link className="p-av" href={profileHref(p.u)} style={{ background: avatarBg(p.u) }}>{un[0]}</Link>
                  <div>
                    <div className="p-top"><Link href={profileHref(p.u)}>{un}</Link><small>@{p.u}</small><time>{tAgo(p.min)}</time></div>
                    <p className="p-text">{p.text}</p>{m ? <FeedMatch m={m} /> : null}
                    <div className="p-acts">
                      <button className={liked.has(p.id) ? 'on' : ''} aria-pressed={liked.has(p.id)} onClick={() => toggle(liked, setLiked, p.id)}>{ICO.heart}{lk(p)}</button>
                      <button className={isOpen ? 'on' : ''} onClick={() => toggle(open, setOpen, p.id)}>{ICO.chat}{p.rep.length}</button>
                      <ShareButton icon={ICO.link} />
                    </div>
                    {isOpen && (
                      <div className="replies">
                        {p.rep.map((r, i) => <div key={i}><b><Link href={profileHref(r.u)}>{r.u}</Link></b><span>{tAgo(r.min)}</span><br />{r.text}</div>)}
                        <ReplyForm onReply={t => reply(p.id, t)} />
                      </div>
                    )}
                  </div>
                </article>
              );
            }) : <p className="empty">{tab === 'following' ? 'Follow some people and their posts will show up here.' : 'No posts yet. Be the first.'}</p>}
          </div>
        </section>
        <aside className="fd-side">
          <div className="fd-box"><h2>Hot matches</h2>
            {hot.map(m => (
              <button key={m.id} className={`hm ${fm === m.id ? 'on' : ''}`} onClick={() => setFm(fm === m.id ? 0 : m.id)}>{T[m.h].n} {m.hs}–{m.as} {T[m.a].n}<span>{cnt[m.id]}</span></button>
            ))}
          </div>
          <div className="fd-box"><h2>Who to follow</h2>
            {sug.length ? sug.map(x => <UserCard key={x} h={x} />) : <span style={{ color: 'var(--muted)' }}>You follow everyone.</span>}
          </div>
        </aside>
      </div>
    </main>
  );
}
