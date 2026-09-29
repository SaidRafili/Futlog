'use client';
import Link from 'next/link';
import { useData } from './DataProvider';
import { Crest } from './ui';

export default function MatchCard({ m }) {
  const { T, label } = useData();
  const h = T[m.h], a = T[m.a];
  return (
    <Link className="match" href={`/match/${m.id}`} aria-label={label(m)}>
      <div className="m-top"><span>{m.comp}{m.stage ? ' / ' + m.stage : ''}</span><span>{m.season}</span></div>
      <div className="m-photo" style={{
        '--a': h.c, '--b': a.c,
        ...(m.img ? { backgroundImage: `url('${m.img}'),linear-gradient(160deg,var(--a),var(--b))` } : {})
      }} />
      <div className="m-score">
        <span style={{ background: h.c, color: h.t }}><Crest t={h} />{m.hs}</span>
        <span style={{ background: a.c, color: a.t }}>{m.as}<Crest t={a} /></span>
      </div>
    </Link>
  );
}
