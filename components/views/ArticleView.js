'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import { Comment, Composer, ShareButton } from '../ui';
import { AUTH, fillers } from '@/lib/demo';
import { agoText, avatarBg, fmt } from '@/lib/util';

const path = d => <svg viewBox="0 0 24 24"><path d={d} /></svg>;
const ARI = {
  heart: path('M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z'),
  chat: path('M4 4h16v12H9l-5 4z'),
  share: path('M4 12v8h16v-8M12 3v13M7 8l5-5 5 5'),
  save: path('M6 3h12v18l-6-4-6 4z')
};

export default function ArticleView() {
  const d = useData();
  const router = useRouter();
  const id = +useParams().id;
  const a = d.status === 'ready' ? d.demo.allArticles.find(x => x.id === id) : null;

  useEffect(() => { if (d.status === 'ready' && !a) router.replace('/'); }, [d.status, a, router]);
  if (!a) return null;
  return <ArticlePage key={a.id} a={a} />;
}

function ArticlePage({ a }) {
  const { byId, following, toggleFollow } = useData();
  const au = AUTH[a.au];
  const [s, setS] = useState({ liked: false, saved: false, posted: [] });
  const progRef = useRef(null);
  const commentsRef = useRef(null);
  const f = following.has(au.h);

  useEffect(() => { document.title = `${a.t} · Futlog`; }, [a]);

  // reading-progress bar
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      if (progRef.current) progRef.current.style.width = Math.min(100, window.scrollY / ((h.scrollHeight - window.innerHeight) || 1) * 100) + '%';
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [cat, read] = a.m.split(' · ');
  const date = new Date(Date.UTC(2026, 5, 28 - a.id * 3)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' });
  const post = text => setS(x => ({ ...x, posted: [{ id: Date.now(), u: 'you', ago: 'just now', likes: 0, text }, ...x.posted] })); // TODO: send to your backend
  const comments = [...s.posted.map(c => ({ ...c, key: 'p' + c.id })), ...fillers.map((c, i) => ({ ...c, key: 'f' + i }))];

  return (
    <main id="articlePage">
      <div className="ar-progress" ref={progRef} />
      <div className="ar-hero" role="img" aria-label="Article cover photo" style={{ backgroundImage: a.img ? `url('${a.img}')` : undefined }} />
      <div className="ar-wrap">
        <article className="ar-main">
          <h1>{a.t}</h1>
          <p className="ar-by"><Link href={`/profile/${au.h}`}>{au.n}</Link> <span>· {cat} · {date} · {read}</span></p>
          <div className="ar-body">{a.body.map((p, i) => <p key={i}>{p}</p>)}</div>
          <section className="ar-comments">
            <div className="sec-head" ref={commentsRef}><h2>Comments</h2></div>
            <Composer placeholder="Add a comment on this article" onPost={post} />
            <div className="mp-comments">{comments.map(c => <Comment key={c.key} c={c} time={agoText(c.ago)} />)}</div>
          </section>
        </article>

        <aside className="ar-side">
          <div className="ar-author">
            <Link className="ar-av" href={`/profile/${au.h}`} style={{ background: avatarBg(au.n, 45, 38) }}>{au.n[0]}</Link><div className="ar-bar" />
            <div>
              <h3><Link href={`/profile/${au.h}`}>{au.n}</Link></h3><div className="handle">@{au.h}</div><p>{au.bio}</p>
              <button className={`follow ${f ? 'on' : ''}`} aria-pressed={f} onClick={() => toggleFollow(au.h)}>{f ? 'Following' : 'Follow'}</button>
            </div>
          </div>
          <div className="ar-actions">
            <button className={s.liked ? 'on' : ''} aria-pressed={s.liked} onClick={() => setS(x => ({ ...x, liked: !x.liked }))}>{ARI.heart}<span>{fmt(900 + a.id * 310 + (s.liked ? 1 : 0))}</span></button>
            <button onClick={() => commentsRef.current?.scrollIntoView({ behavior: 'smooth' })}>{ARI.chat}<span>{fmt(20 + a.id * 7 + s.posted.length)}</span></button>
            <ShareButton icon={ARI.share} />
            <button className={s.saved ? 'on' : ''} aria-pressed={s.saved} onClick={() => setS(x => ({ ...x, saved: !x.saved }))}>{ARI.save}<span>{s.saved ? 'Saved' : 'Save'}</span></button>
          </div>
          <div><h4>Matches in this article</h4><div className="ar-matches">{a.ms.map(i => <MatchCard key={i} m={byId(i)} />)}</div></div>
        </aside>
      </div>
    </main>
  );
}
