'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import CommentSection from '../Comments';
import { FollowButton, LikeButton, ShareButton } from '../ui';
import { sendJSON } from '@/lib/profile';
import { fmt, shortDate } from '@/lib/util';

const path = d => <svg viewBox="0 0 24 24"><path d={d} /></svg>;
const ARI = {
  heart: path('M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z'),
  chat: path('M4 4h16v12H9l-5 4z'),
  share: path('M4 12v8h16v-8M12 3v13M7 8l5-5 5 5'),
  save: path('M6 3h12v18l-6-4-6 4z'),
  edit: path('M4 20h4L19 9l-4-4L4 16zM14 6l4 4')
};

// Loads one article (+ whether you liked / saved it) from PostgreSQL: GET /api/articles/:id
export default function ArticleView() {
  const d = useData();
  const id = useParams().id;
  const [st, setSt] = useState({ phase: 'loading' });
  const who = d.me?.handle || '';

  useEffect(() => {
    if (!d.meReady) return;
    let dead = false;
    fetch('/api/articles/' + encodeURIComponent(id), { cache: 'no-store' })
      .then(async res => {
        const j = await res.json().catch(() => ({}));
        if (dead) return;
        if (res.status === 404) setSt({ phase: 'missing' });
        else if (!res.ok) setSt({ phase: 'error', message: j.error || 'HTTP ' + res.status });
        else setSt({ phase: 'ready', a: j.article });
      })
      .catch(e => { if (!dead) setSt({ phase: 'error', message: e.message }); });
    return () => { dead = true; };
  }, [id, d.meReady, who]);

  if (d.status !== 'ready' || st.phase === 'loading') return <main id="articlePage"><p className="empty" style={{ textAlign: 'center' }}>Loading…</p></main>;
  if (st.phase === 'missing') return <main id="articlePage"><p className="empty" style={{ textAlign: 'center' }}>This article does not exist, or it is a draft. <Link href="/" style={{ color: 'var(--accent)' }}>Back to home</Link></p></main>;
  if (st.phase === 'error') return <main id="articlePage"><p className="pf-note" role="alert">Could not load the article: {st.message}</p></main>;
  return <ArticlePage key={st.a.id} a={st.a} />;
}

function ArticlePage({ a }) {
  const { byId, me, openAuth } = useData();
  const [saved, setSaved] = useState(a.saved), [ccount, setCcount] = useState(a.comments);
  const progRef = useRef(null), commentsRef = useRef(null);
  const au = a.author;

  useEffect(() => { document.title = `${a.title} · Futlog`; }, [a]);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      if (progRef.current) progRef.current.style.width = Math.min(100, window.scrollY / ((h.scrollHeight - window.innerHeight) || 1) * 100) + '%';
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleSave = async () => {
    if (!me) { openAuth('signin'); return; }
    const was = saved; setSaved(!was);
    try { await sendJSON(`/api/articles/${a.id}/save`, was ? 'DELETE' : 'POST', {}); }
    catch (e) { setSaved(was); if (e.status === 401) openAuth('signin'); }
  };

  const matches = a.matchIds.map(byId).filter(Boolean);
  const draft = a.status !== 'published';

  return (
    <main id="articlePage">
      <div className="ar-progress" ref={progRef} />
      <div className="ar-hero" role="img" aria-label="Article cover photo" style={{ backgroundImage: a.cover ? `url('${a.cover}')` : undefined }} />
      <div className="ar-wrap">
        <article className="ar-main">
          {draft && <p className="pf-note">This is a draft. Only you can see it. <Link href={`/write/${a.id}`}>Edit and publish it</Link></p>}
          <h1>{a.title}</h1>
          <p className="ar-by"><Link href={`/profile/${au.handle}`}>{au.name}</Link> <span>· {a.category} · {a.publishedAt ? shortDate(a.publishedAt) : 'Draft'} · {a.readMinutes || 1} min read</span></p>
          <div className="ar-body">{a.body.length ? a.body.map((p, i) => <p key={i}>{p}</p>) : <p className="empty">This article has no text yet.</p>}</div>
          <section className="ar-comments">
            <div className="sec-head" ref={commentsRef}><h2>Comments ({ccount})</h2></div>
            {draft
              ? <p className="empty">Comments open when the article is published.</p>
              : <CommentSection type="article" id={a.id} placeholder="Add a comment on this article" onCount={setCcount} />}
          </section>
        </article>

        <aside className="ar-side">
          <div className="ar-author">
            <Link className="ar-av" href={`/profile/${au.handle}`} style={{ background: au.avatar ? undefined : 'var(--accent-deep)' }}>
              {au.avatar ? <img src={au.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} /> : au.name[0]}
            </Link><div className="ar-bar" />
            <div>
              <h3><Link href={`/profile/${au.handle}`}>{au.name}</Link></h3><div className="handle">@{au.handle}</div>{au.bio && <p>{au.bio}</p>}
              {a.mine ? <Link className="follow" style={{ display: 'inline-block' }} href={`/write/${a.id}`}>Edit article</Link> : <FollowButton h={au.handle} />}
            </div>
          </div>
          <div className="ar-actions">
            <LikeButton type="article" id={a.id} count={a.likes} liked={a.liked}>
              {({ on, n, toggle }) => <button className={on ? 'on' : ''} aria-pressed={on} onClick={toggle} disabled={draft}>{ARI.heart}<span>{fmt(n)}</span></button>}
            </LikeButton>
            <button onClick={() => commentsRef.current?.scrollIntoView({ behavior: 'smooth' })}>{ARI.chat}<span>{fmt(ccount)}</span></button>
            <ShareButton icon={ARI.share} />
            <button className={saved ? 'on' : ''} aria-pressed={saved} onClick={toggleSave} disabled={draft}>{ARI.save}<span>{saved ? 'Saved' : 'Save'}</span></button>
          </div>
          {matches.length > 0 && <div><h4>Matches in this article</h4><div className="ar-matches">{matches.map(m => <MatchCard key={m.id} m={m} />)}</div></div>}
        </aside>
      </div>
    </main>
  );
}
