'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useData } from './DataProvider';
import CommentSection from './Comments';
import { PostImages } from './PostMedia';
import { Avatar, LikeButton, MiniBadge, ShareButton } from './ui';
import { richParts } from '@/lib/richtext';
import { highlightParts } from '@/lib/fold';
import { profileHref, timeAgo } from '@/lib/util';

const ico = d => <svg width="15" height="15" viewBox="0 0 24 24"><path d={d} /></svg>;
export const ICO = {
  heart: ico('M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z'),
  chat: ico('M4 4h16v12H9l-5 4z'),
  link: ico('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'),
};

// Post text with clickable #hashtags (-> search), @mentions (-> profile) and https links. `mark` = search words to highlight.
export function PostText({ text, mark }) {
  const hl = (t, k) => mark?.length ? highlightParts(t, mark).map((x, j) => x.hit ? <mark key={k + j}>{x.t}</mark> : x.t) : t;
  return richParts(text).map((p, i) =>
    p.tag ? <Link key={i} className="p-tag" href={`/search?${new URLSearchParams({ q: '#' + p.tag, type: 'posts' })}`}>{hl(p.t, i)}</Link>
    : p.handle ? <Link key={i} className="p-tag" href={profileHref(p.handle)}>{hl(p.t, i)}</Link>
    : p.link ? <a key={i} className="p-tag" href={p.link} target="_blank" rel="noopener noreferrer nofollow ugc">{p.t}</a>
    : <span key={i}>{hl(p.t, i)}</span>);
}

export function FeedMatch({ m }) {
  const { T, label } = useData();
  const h = T[m.h], a = T[m.a];
  return (
    <Link className="p-match" href={`/match/${m.id}`} style={{ '--a': h.c, '--b': a.c }} aria-label={label(m)}>
      <span className="mini"><MiniBadge t={h} />{m.hs}–{m.as}<MiniBadge t={a} /></span>
      <span>{[m.comp, m.stage, m.season].filter(Boolean).join(' · ')}</span>
    </Link>
  );
}

// One feed post: text, pictures, tagged match, like / reply / share, and edit + delete for the author.
// Replies are comments of type 'post'. `mark` highlights search words (search results). `onEdit` / `onDelete` are async and may throw.
export default function PostCard({ p, m, isOpen, onToggle, onEdit, onDelete, onReplies, mark, compact }) {
  const [editing, setEditing] = useState(false), [v, setV] = useState(p.body), [err, setErr] = useState(''), [confirm, setConfirm] = useState(false);
  const save = async e => {
    e.preventDefault();
    const t = v.trim();
    if (!t && !p.images.length) { setErr('A post cannot be empty'); return; }
    if (t.length > 280) { setErr('Posts are limited to 280 characters'); return; }
    if (t === p.body) { setEditing(false); return; }
    try { await onEdit(p, t); setEditing(false); setErr(''); } catch (x) { setErr(x.message); }
  };
  const del = async () => { try { await onDelete(p); } catch (x) { setErr(x.message); setConfirm(false); } };
  const href = `/post/${p.id}`;
  return (
    <article className={compact ? 'post compact' : 'post'} style={{ '--hc': 'var(--accent-deep)' }}>
      <Link href={profileHref(p.user.handle)} style={{ display: 'contents' }}><Avatar name={p.user.name} src={p.user.avatar} className="p-av" /></Link>
      <div className="p-main">
        <div className="p-top"><Link href={profileHref(p.user.handle)}>{p.user.name}</Link><small>@{p.user.handle}</small><Link className="p-time" href={href}><time dateTime={new Date(p.at).toISOString()}>{timeAgo(p.at)}{p.editedAt ? ' · edited' : ''}</time></Link></div>
        {editing ? (
          <form className="c-editform" onSubmit={save}>
            <textarea value={v} onChange={e => { setV(e.target.value); setErr(''); }} rows={3} aria-label="Edit your post" autoFocus />
            <div className="c-acts"><button type="submit" className="btn primary sm">Save</button><button type="button" className="btn ghost sm" onClick={() => { setV(p.body); setEditing(false); setErr(''); }}>Cancel</button><small className={v.length > 280 ? 'over' : ''}>{280 - v.length}</small></div>
          </form>
        ) : p.body ? <p className="p-text"><PostText text={p.body} mark={mark} /></p> : null}
        {err && <p className="st-err" role="alert">{err}</p>}
        {compact ? null : <PostImages images={p.images} />}
        {m ? <FeedMatch m={m} /> : null}
        <div className="p-acts">
          <LikeButton type="post" id={p.id} count={p.likes} liked={p.liked}>
            {({ on, n, toggle }) => <button className={on ? 'on' : ''} aria-pressed={on} onClick={toggle} aria-label={on ? 'Remove like' : 'Like'}>{ICO.heart}{n}</button>}
          </LikeButton>
          {compact
            ? <Link className="p-replies" href={href} aria-label="Replies">{ICO.chat}{p.replies}</Link>
            : <button className={isOpen ? 'on' : ''} onClick={onToggle} aria-expanded={isOpen} aria-label="Replies">{ICO.chat}{p.replies}</button>}
          <ShareButton icon={ICO.link} href={href} />
          {p.mine && !editing && onEdit && <button onClick={() => setEditing(true)}>Edit</button>}
          {p.mine && onDelete && (confirm ? <><button onClick={del} style={{ color: '#ff8b94' }}>Delete?</button><button onClick={() => setConfirm(false)}>No</button></> : <button onClick={() => setConfirm(true)}>Delete</button>)}
        </div>
        {isOpen && <div className="replies"><CommentSection type="post" id={p.id} placeholder="Write a reply" max={280} onCount={onReplies} /></div>}
      </div>
    </article>
  );
}
