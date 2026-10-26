'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useData } from './DataProvider';
import { avatarBg, profileHref } from '@/lib/util';

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

export function LikeButton({ n }) {
  const [on, setOn] = useState(false);
  return (
    <button className={`like${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setOn(v => !v)}>
      <svg width="15" height="15" viewBox="0 0 24 24"><path d={HEART} /></svg><span>{n + (on ? 1 : 0)}</span>
    </button>
  );
}

export function FollowButton({ h }) {
  const { following, toggleFollow } = useData();
  const on = following.has(h);
  return <button className={`follow${on ? ' on' : ''}`} style={{ marginTop: 6 }} onClick={() => toggleFollow(h)}>{on ? 'Following' : 'Follow'}</button>;
}

export function ShareButton({ icon, className }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(t);
  }, [done]);
  const copy = () => { navigator.clipboard?.writeText(window.location.href).catch(() => {}); setDone(true); };
  return <button className={className} onClick={copy}>{icon}<span>{done ? 'Link copied' : 'Share'}</span></button>;
}

// Round avatar: the uploaded picture if there is one, otherwise the first letter on a colour made from the name.
export function Avatar({ name, src, className = 'c-avatar', size }) {
  const st = size ? { width: size, height: size } : undefined;
  return src
    ? <img className={className} src={src} alt="" style={{ ...st, objectFit: 'cover' }} />
    : <span className={className} style={{ ...st, background: avatarBg(name, 45, 38) }}>{name[0]}</span>;
}

// `u` = { h, name, avatar } when the caller already has the person (profile lists); otherwise looked up from the demo data.
export function UserCard({ h, u }) {
  const { getUser, me } = useData();
  const p = u || { h, name: getUser(h).name, avatar: null };
  return (
    <div className="ucard">
      <Link className="uc-l" href={profileHref(p.h)}>
        <Avatar name={p.name} src={p.avatar} />
        <span><b>{p.name}</b><small>@{p.h}</small></span>
      </Link>
      {p.h === me?.handle ? null : <FollowButton h={p.h} />}
    </div>
  );
}

// Match/article comment (was mpComment()). `time` is the ready-to-show time text.
export function Comment({ c, time }) {
  return (
    <article className="comment">
      <div className="c-head">
        <div className="c-avatar" style={{ background: avatarBg(c.u) }}>{c.u[0].toUpperCase()}</div>
        <div><Link className="c-name" href={profileHref(c.u)}>{c.u}</Link><div className="c-time">{time}</div></div>
      </div>
      <p className="c-text">“{c.text}”</p>
      <div className="c-foot"><LikeButton n={c.likes} /></div>
    </article>
  );
}

// Composer used under matches and articles.
export function Composer({ placeholder, onPost }) {
  const [v, setV] = useState('');
  const submit = e => {
    e.preventDefault();
    const text = v.trim(); if (!text) return;
    onPost(text); setV('');
  };
  return (
    <form className="composer" onSubmit={submit}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder={placeholder} aria-label="Add a comment" maxLength={280} /><button type="submit">Post</button>
    </form>
  );
}
