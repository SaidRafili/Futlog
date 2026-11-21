'use client';
import Link from 'next/link';
import { useData } from './DataProvider';
import { Crest } from './ui';
import Photo from './Photo';

export default function MatchCard({ m }) {
  const { T, label, mhref } = useData();
  const h = T[m.h], a = T[m.a];
  return (
    <Link className="match" href={mhref(m)} aria-label={label(m)}>
      <div className="m-top"><span>{m.leagueLogo ? <img className="m-lg" src={m.leagueLogo} alt="" width="11" height="11" loading="lazy" decoding="async" /> : null}{m.comp}{m.stage ? ' / ' + m.stage : ''}</span><span>{m.season}</span></div>
      {/* the link already has the match as its label, so the stadium photo is decoration (alt="") */}
      <div className={m.img ? 'm-photo ph' : 'm-photo'} style={{ '--a': h.c, '--b': a.c }}>
        {m.img ? <Photo src={m.img} width={180} height={140} sizes="180px" /> : null}
      </div>
      <div className="m-score">
        <span style={{ background: h.c, color: h.t }}><Crest t={h} />{m.hs}</span>
        <span style={{ background: a.c, color: a.t }}>{m.as}<Crest t={a} /></span>
      </div>
    </Link>
  );
}
