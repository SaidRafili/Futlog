'use client';
import Link from 'next/link';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import { LikeButton, MiniBadge } from '../ui';
import { avatarBg, profileHref } from '@/lib/util';
import { cs } from '@/lib/data';

function HomeComment({ c }) {
  const { T, byId, label } = useData();
  const m = byId(c.m), h = T[m.h], a = T[m.a];
  return (
    <article className="comment">
      <div className="c-head">
        <div className="c-avatar" style={{ background: avatarBg(c.u) }}>{c.u[0].toUpperCase()}</div>
        <div><Link className="c-name" href={profileHref(c.u)}>{c.u}</Link><div className="c-time">{c.ago} ago</div></div>
      </div>
      <p className="c-text">“{c.text}”</p>
      <div className="c-foot">
        <Link className="chip" href={`/match/${m.id}`} aria-label={label(m)}>
          <span className="mini"><MiniBadge t={h} />{m.hs}–{m.as}<MiniBadge t={a} /></span>
          <span className="t">{cs(m)}</span>
        </Link>
        <LikeButton n={c.likes} />
      </div>
    </article>
  );
}

export default function HomeView() {
  const d = useData();
  const ready = d.status === 'ready';
  return (
    <div className="page" id="home">
      <div className="ad-space" aria-hidden="true" />
      <main className="content">
        <section id="articles">
          <div className="sec-head"><h2>Top articles</h2><a href="#">All articles</a></div>
          <div className="articles">
            <Link className="featured" href="/article/1">
              <div className="thumb" role="img" aria-label="Article photo" />
              <div><h3>What is the reason behind exceptional results of players from Latin America?</h3><p>Analysis · 8 min read</p></div>
            </Link>
            <div className="article-list">
              {ready && d.demo.allArticles.filter(a => a.id !== 1).map(a => (
                <Link key={a.id} href={`/article/${a.id}`}><b>{a.t}</b><span>{a.m}</span></Link>
              ))}
            </div>
          </div>
        </section>

        <section id="matches">
          <div className="sec-head"><h2>Top matches this week</h2><Link href="/search?q=">See all matches</Link></div>
          <div className="match-grid">{ready && d.matches.slice(0, 6).map(m => <MatchCard key={m.id} m={m} />)}</div>
        </section>

        <section>
          <div className="sec-head"><h2>Most liked comments on matches</h2></div>
          <div className="comments">{ready && d.demo.comments.map((c, i) => <HomeComment key={i} c={c} />)}</div>
        </section>

        <section>
          <div className="sec-head"><h2>Recently added</h2></div>
          <ul className="updates">
            {ready && d.demo.updates.map((u, i) => (
              <li key={i}>{u.h ? <Link href={u.h}>{u.t}</Link> : <a href="#">{u.t}</a>}<time>{u.time}</time></li>
            ))}
          </ul>
        </section>
      </main>
      <div className="ad-space" aria-hidden="true" />
    </div>
  );
}
