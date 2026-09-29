'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import { Comment, Composer, Crest, MiniBadge } from '../ui';
import { COMPC, COMPN, fillers, reviews } from '@/lib/demo';
import { agoText, avatarBg, fmt, ord } from '@/lib/util';

const IC = {
  eye: <svg viewBox="0 0 64 44"><path d="M2 22C10 8 22 2 32 2s22 6 30 20c-8 14-20 20-30 20S10 36 2 22z" fill="currentColor" /><circle cx="32" cy="22" r="11" fill="#030305" /><circle cx="32" cy="22" r="5" fill="currentColor" /></svg>,
  heart: <svg viewBox="0 0 64 60"><path d="M32 58S4 40 4 20A14 14 0 0 1 32 14a14 14 0 0 1 28 6c0 20-28 38-28 38z" fill="currentColor" /></svg>,
  chat: <svg viewBox="0 0 64 60"><path d="M6 6h52a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H30L14 58V44H6a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" fill="currentColor" /></svg>
};

export default function MatchView() {
  const d = useData();
  const router = useRouter();
  const id = +useParams().id;
  const m = d.status === 'ready' ? d.byId(id) : null;

  useEffect(() => { if (d.status === 'ready' && !m) router.replace('/'); }, [d.status, m, router]);
  if (!m) return null;
  return <MatchPage key={m.id} m={m} />;
}

function MatchPage({ m }) {
  const { T, demo, detail } = useData();
  const h = T[m.h], a = T[m.a], d = detail(m);
  const [s, setS] = useState({ watched: false, liked: false, rating: 0, posted: [] });
  const [tab, setTab] = useState('reviews');
  const tabsRef = useRef(null);

  useEffect(() => { document.title = `${h.n} ${m.hs}–${m.as} ${a.n} · Futlog`; }, [h, a, m]);

  const full = COMPN[m.comp] || m.comp;
  const shown = s.rating || Math.round(d.avg);
  const avg = s.rating ? (d.avg * d.rcount + s.rating) / (d.rcount + 1) : d.avg;
  const rate = v => setS(x => ({ ...x, rating: x.rating === v ? 0 : v }));
  const post = text => setS(x => ({ ...x, posted: [{ id: Date.now(), u: 'you', ago: 'just now', likes: 0, text }, ...x.posted] })); // TODO: send to your backend

  const comments = [
    ...s.posted.map(c => ({ ...c, key: 'p' + c.id })),
    ...demo.comments.filter(c => c.m === m.id).map((c, i) => ({ ...c, key: 'd' + i })),
    ...fillers.map((c, i) => ({ ...c, key: 'f' + i }))
  ];
  const goals = [[m.h, m.hs], [m.a, m.as]].filter(x => x[1]);

  return (
    <main id="matchPage">
      <section className="mp-hero">
        <div className="mp-left">
          <div className="board">
            <div className="tblock" style={{ background: h.c, color: h.t }}><Crest t={h} big />{h.n}</div>
            <div className="score"><time>{d.date}</time><b>{m.hs} - {m.as}</b></div>
            <div className="tblock" style={{ background: a.c, color: a.t }}><Crest t={a} big />{a.n}</div>
          </div>
          <div className="cred">
            <div className="mp-title"><h2>Match credentials</h2></div>
            <div className="cred-card">
              <div className="cred-strip" style={{ background: COMPC[m.comp] || '#222' }}>{m.comp}</div>
              <div className="cred-body">
                <div>{m.stage ? m.stage + ' / ' : ''}{m.season}
                  <small>{d.pair.length > 1
                    ? <><span className="red">{ord(d.n)}</span> of {d.pair.length} meetings on record</>
                    : <><span className="red">Only</span> meeting on record</>}</small>
                </div>
                <div>{d.venue}</div>
              </div>
              <div className="emblem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10" /><path d="M12 7l4 3-1.5 5h-5L8 10z" /></svg>{full}</div>
            </div>
          </div>
        </div>
        <div className="mp-photo" role="img" aria-label="Match photo" style={{ '--a': h.c, '--b': a.c, backgroundImage: m.img ? `url('${m.img}')` : undefined }} />
      </section>

      <section className="mp-body">
        <aside className="mp-side">
          <div className="stats">
            <div className="actions">
              <button className={s.watched ? 'on' : ''} aria-pressed={s.watched} aria-label="Watched" title="Mark as watched" style={{ color: 'var(--accent)' }} onClick={() => setS(x => ({ ...x, watched: !x.watched }))}>{IC.eye}<span>{fmt(d.views + (s.watched ? 1 : 0))}</span></button><i className="div" />
              <button className={s.liked ? 'on' : ''} aria-pressed={s.liked} aria-label="Like" title="Like this match" style={{ color: '#ef2b3a' }} onClick={() => setS(x => ({ ...x, liked: !x.liked }))}>{IC.heart}<span>{fmt(d.likes + (s.liked ? 1 : 0))}</span></button><i className="div" />
              <button className="on" aria-label="Go to comments" title="Go to comments" style={{ color: 'var(--accent)' }}
                onClick={() => { setTab('comments'); tabsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>{IC.chat}<span>{fmt(d.ccount + s.posted.length)}</span></button>
            </div>
            <div className="rate">
              <div className="rate-bars" role="group" aria-label="Rate this match">
                {Array.from({ length: 10 }, (_, k) => 10 - k).map(i => (
                  <button key={i} className={`seg ${i <= shown ? 'on' : ''} ${s.rating ? 'mine' : ''}`} style={{ height: 8 + i * 2.6 }} aria-label={`Rate ${i} out of 10`} onClick={() => rate(i)} />
                ))}
              </div>
              <div className="rate-text"><b>{avg.toFixed(1)}</b>average · {fmt(d.rcount + (s.rating ? 1 : 0))} ratings<br />{s.rating ? `You rated ${s.rating}/10 · tap it again to remove` : 'Tap a bar to rate this match'}</div>
            </div>
          </div>
          <div className="notch" />
          <div className="more">
            <div className="mp-title"><h2>More info</h2></div>
            <dl><dt>Kick-off</dt><dd>{d.ko}</dd><dt>Attendance</dt><dd>{d.att}</dd><dt>Competition</dt><dd>{full}</dd></dl>
            {/* the fixtures data has scores but no scorers / minutes, so show goals per team instead of a timeline */}
            <ol className="goals">
              {m.hs + m.as
                ? goals.map(([t, n]) => <li key={t}><b>{n}</b><MiniBadge t={T[t]} />{n > 1 ? 'goals' : 'goal'}</li>)
                : <li>No goals</li>}
              {m.ph + m.pa ? <li><b>Pens</b>{m.ph}–{m.pa}</li> : null}
            </ol>
          </div>
        </aside>

        <div className="mp-main">
          <div className="tabs" ref={tabsRef} role="tablist">
            {['comments', 'reviews'].map(t => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <div hidden={tab !== 'comments'}>
            <Composer placeholder="Add a comment on this match" onPost={post} />
            <div className="mp-comments">{comments.map(c => <Comment key={c.key} c={c} time={agoText(c.ago)} />)}</div>
          </div>
          <div hidden={tab !== 'reviews'}>
            <div className="reviews">
              {reviews.map((r, i) => {
                const col = r.r >= 9 ? '#6ee7a0' : r.r === 8 ? '#ffd84a' : '#ff9f6b';
                return (
                  <Link key={i} className="review" href={`/match/${m.id}`} style={{ '--stripe': col, '--a': i % 2 ? a.c : h.c, '--b': i % 2 ? h.c : a.c }}><i />
                    <div className="r-body"><h3>{r.t}</h3><div className="r-by"><span className="r-avatar" style={{ background: avatarBg(r.u) }} />{r.u}<b>{r.r}/10</b></div><time>{r.ago}</time></div>
                    <div className="r-thumb" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
