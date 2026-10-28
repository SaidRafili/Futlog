'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useData } from './DataProvider';
import { avatarBg, profileHref } from '@/lib/util';
import { sendJSON } from '@/lib/profile';

// Team crest (was cr()): logo image if the team has one, otherwise the abbreviation.
export function Crest({ t, big }) {
  const x = big ? ' big' : '';
  return t.l
    ? <b className={`crest logo${x}`}><img src={t.l} alt={t.s} loading="lazy" /></b>
    : <b className={`crest${x}`}>{t.s}</b>;
}

// Small team badge used inside score chips (was mb()).
export function MiniBadge({ t }) {
  return t.l
    ? <i className="tlogo"><img src={t.l} alt={t.s} loading="lazy" /></i>
    : <i style={{ background: t.c, color: t.t }}>{t.s}</i>;
}

const HEART = 'M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z';

// Like button saved in the `likes` table. type = 'article' | 'comment' | 'post' | 'review'. Flips at once, undone if the save fails.
export function LikeButton({ type, id, count = 0, liked = false, className = 'like', children, onChange }) {
  const { me, openAuth } = useData();
  const [st, setSt] = useState({ on: liked, n: count });
  useEffect(() => setSt({ on: liked, n: count }), [liked, count, id]);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (!me) { openAuth('signin'); return; }
    if (busy) return;
    const was = st; setBusy(true);
    setSt({ on: !was.on, n: Math.max(0, was.n + (was.on ? -1 : 1)) });
    try {
      const r = await sendJSON('/api/likes', was.on ? 'DELETE' : 'POST', { type, id });
      setSt({ on: r.liked, n: r.count }); onChange?.(r);
    } catch (e) { setSt(was); if (e.status === 401) openAuth('signin'); }
    finally { setBusy(false); }
  };
  return children
    ? children({ on: st.on, n: st.n, toggle })
    : (
      <button className={`${className}${st.on ? ' on' : ''}`} aria-pressed={st.on} onClick={toggle} title={st.on ? 'Remove like' : 'Like'}>
        <svg width="15" height="15" viewBox="0 0 24 24"><path d={HEART} /></svg><span>{st.n}</span>
      </button>
    );
}

export function FollowButton({ h }) {
  const { following, toggleFollow } = useData();
  const on = following.has(h);
  return <button className={`follow${on ? ' on' : ''}`} style={{ marginTop: 6 }} onClick={() => toggleFollow(h)}>{on ? 'Following' : 'Follow'}</button>;
}

export function ShareButton({ icon, className, href }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(t);
  }, [done]);
  const copy = () => { navigator.clipboard?.writeText(href ? new URL(href, window.location.origin).href : window.location.href).catch(() => {}); setDone(true); };
  return <button className={className} onClick={copy}>{icon}<span>{done ? 'Link copied' : 'Share'}</span></button>;
}

// Round avatar: the uploaded picture if there is one, otherwise the first letter on a colour made from the name.
export function Avatar({ name, src, className = 'c-avatar', size }) {
  const st = size ? { width: size, height: size } : undefined;
  return src
    ? <img className={className} src={src} alt="" style={{ ...st, objectFit: 'cover' }} />
    : <span className={className} style={{ ...st, background: avatarBg(name, 45, 38) }}>{name[0]}</span>;
}

// `u` = { h, name, avatar } (a person from the database)
export function UserCard({ u }) {
  const { me } = useData();
  return (
    <div className="ucard">
      <Link className="uc-l" href={profileHref(u.h)}>
        <Avatar name={u.name} src={u.avatar} />
        <span><b>{u.name}</b><small>@{u.h}</small></span>
      </Link>
      {u.h === me?.handle ? null : <FollowButton h={u.h} />}
    </div>
  );
}

// Text box + Post button. onPost(text) may be async; the box is cleared only when it succeeds.
export function Composer({ placeholder, onPost, button = 'Post', max = 1000 }) {
  const { me, openAuth } = useData();
  const [v, setV] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault();
    const text = v.trim(); if (!text || busy) return;
    if (!me) { openAuth('signin'); return; }
    setBusy(true); setErr('');
    try { await onPost(text); setV(''); } catch (x) { setErr(x.message || 'Could not save that'); } finally { setBusy(false); }
  };
  return (
    <>
      <form className="composer" onSubmit={submit}>
        <input value={v} onChange={e => { setV(e.target.value); setErr(''); }} placeholder={me ? placeholder : 'Sign in to join the conversation'} aria-label={placeholder} maxLength={max} /><button type="submit" disabled={busy}>{button}</button>
      </form>
      {err && <p className="st-err c-err" role="alert">{err}</p>}
    </>
  );
}
