'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useData } from './DataProvider';
import { Avatar, Composer, LikeButton } from './ui';
import { sendJSON } from '@/lib/profile';
import { profileHref, timeAgo } from '@/lib/util';

// Comments for ANY thing: type = 'match' | 'article' | 'review' | 'post', id = that thing's id.
// Saved in the `comments` table. Write, reply, edit and delete your own, like anyone's.
export default function CommentSection({ type, id, placeholder = 'Add a comment', onCount, max = 1000 }) {
  const { me, meReady } = useData();
  const [list, setList] = useState(null), [error, setError] = useState(''), [sort, setSort] = useState('new');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?type=${type}&id=${id}&sort=${sort}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'HTTP ' + res.status);
      setList(j.comments); setError('');
    } catch (e) { setError(e.message); setList(l => l || []); }
  }, [type, id, sort]);
  useEffect(() => { if (meReady) load(); }, [load, meReady, me?.handle]);   // reload when signing in/out so "liked" and "mine" are right
  useEffect(() => { if (list) onCount?.(list.length); }, [list]);            // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (text, parentId) => {
    const { comment } = await sendJSON('/api/comments', 'POST', { type, id, body: text, parentId });
    setList(l => [...(l || []), comment]);
  };
  const edit = async (c, text) => {
    const { comment } = await sendJSON('/api/comments/' + c.id, 'PUT', { body: text });
    setList(l => l.map(x => x.id === c.id ? comment : x));
  };
  const remove = async c => {
    await sendJSON('/api/comments/' + c.id, 'DELETE', {});
    setList(l => l.filter(x => x.id !== c.id && x.parentId !== c.id));
  };

  if (!list) return <p className="empty">Loading comments…</p>;
  const top = list.filter(c => c.parentId == null);
  const kids = pid => list.filter(c => c.parentId === pid).sort((a, b) => new Date(a.at) - new Date(b.at));
  // "new" shows newest first; the list from the server is already sorted, replies/new posts are appended locally
  const ordered = sort === 'top' ? [...top].sort((a, b) => b.likes - a.likes || new Date(b.at) - new Date(a.at)) : [...top].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <div className="cs">
      <Composer placeholder={placeholder} onPost={t => add(t)} max={max} />
      {error && <p className="st-err c-err" role="alert">Could not load comments: {error}</p>}
      {list.length > 1 && (
        <div className="cs-sort" role="group" aria-label="Sort comments">
          {[['new', 'Newest'], ['top', 'Most liked']].map(([k, l]) => <button key={k} className={sort === k ? 'on' : ''} aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}
        </div>
      )}
      <div className="cs-list">
        {ordered.map(c => <CommentItem key={c.id} c={c} replies={kids(c.id)} onReply={add} onEdit={edit} onDelete={remove} max={max} />)}
      </div>
      {!list.length && !error && <p className="empty">No comments yet. Be the first.</p>}
    </div>
  );
}

function CommentItem({ c, replies, onReply, onEdit, onDelete, max }) {
  const [mode, setMode] = useState(null);   // null | 'edit' | 'reply'
  return (
    <div className="cs-thread">
      <CommentCard c={c} mode={mode} setMode={setMode} onEdit={onEdit} onDelete={onDelete} onReply={onReply} max={max} canReply />
      {mode === 'reply' && (
        <div className="cs-reply-box"><Composer placeholder={`Reply to ${c.user.name}`} button="Reply" max={max} onPost={async t => { await onReply(t, c.id); setMode(null); }} /></div>
      )}
      {replies.length > 0 && (
        <div className="cs-replies">
          {replies.map(r => <ReplyItem key={r.id} c={r} parent={c} onReply={onReply} onEdit={onEdit} onDelete={onDelete} max={max} />)}
        </div>
      )}
    </div>
  );
}

function ReplyItem({ c, parent, onReply, onEdit, onDelete, max }) {
  const [mode, setMode] = useState(null);
  return (
    <>
      <CommentCard c={c} mode={mode} setMode={setMode} onEdit={onEdit} onDelete={onDelete} onReply={onReply} max={max} canReply small />
      {mode === 'reply' && <div className="cs-reply-box"><Composer placeholder={`Reply to ${c.user.name}`} button="Reply" max={max} onPost={async t => { await onReply(t, parent.id); setMode(null); }} /></div>}
    </>
  );
}

function CommentCard({ c, mode, setMode, onEdit, onDelete, canReply, small, max }) {
  const [text, setText] = useState(c.body), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [confirm, setConfirm] = useState(false);
  useEffect(() => setText(c.body), [c.body]);

  const save = async e => {
    e.preventDefault();
    const t = text.trim(); if (!t) { setErr('A comment cannot be empty'); return; }
    if (t === c.body) { setMode(null); return; }
    setBusy(true); setErr('');
    try { await onEdit(c, t); setMode(null); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const del = async () => {
    setBusy(true); setErr('');
    try { await onDelete(c); } catch (x) { setErr(x.message); setBusy(false); setConfirm(false); }
  };

  return (
    <article className={`comment${small ? ' small' : ''}`} id={'comment-' + c.id}>
      <div className="c-head">
        <Avatar name={c.user.name} src={c.user.avatar} className="c-avatar" />
        <div><Link className="c-name" href={profileHref(c.user.handle)}>{c.user.name}</Link>
          <div className="c-time">@{c.user.handle} · {timeAgo(c.at)}{c.editedAt ? ' · edited' : ''}</div></div>
      </div>
      {mode === 'edit' ? (
        <form className="c-editform" onSubmit={save}>
          <textarea value={text} onChange={e => { setText(e.target.value); setErr(''); }} maxLength={max} rows={3} aria-label="Edit your comment" autoFocus />
          <div className="c-acts"><button type="submit" className="btn primary sm" disabled={busy}>Save</button><button type="button" className="btn ghost sm" onClick={() => { setText(c.body); setMode(null); setErr(''); }}>Cancel</button></div>
        </form>
      ) : <p className="c-text">{c.body}</p>}
      {err && <p className="st-err c-err" role="alert">{err}</p>}
      <div className="c-foot">
        <LikeButton type="comment" id={c.id} count={c.likes} liked={c.liked} />
        <div className="c-acts">
          {canReply && <button className="c-act" onClick={() => setMode(mode === 'reply' ? null : 'reply')}>Reply</button>}
          {c.mine && mode !== 'edit' && <button className="c-act" onClick={() => { setMode('edit'); setConfirm(false); }}>Edit</button>}
          {c.mine && (confirm
            ? <><button className="c-act danger" onClick={del} disabled={busy}>Delete?</button><button className="c-act" onClick={() => setConfirm(false)}>No</button></>
            : <button className="c-act" onClick={() => setConfirm(true)}>Delete</button>)}
        </div>
      </div>
    </article>
  );
}
