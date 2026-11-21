import { ImageResponse } from 'next/og';
import { serverMatches } from '@/lib/servermatches';
import { MON } from '@/lib/consts';
import { cs } from '@/lib/data';
import { OG, OG_HEADERS, OG_SIZE, clipText, safeImage } from '@/lib/ogcard';

export const runtime = 'nodejs';

// GET /og/match/:id  -> 1200x630 card for a match: stadium photo (or the two team colours), both crests, names and the score
export async function GET(req, { params }) {
  const id = Number((await params).id);
  let data = null;
  try { data = await serverMatches(); } catch (err) { console.error('og match: could not load matches:', err.message); }
  const m = data && Number.isSafeInteger(id) ? data.byId.get(id) : null;
  if (!m) return Response.redirect(new URL('/og', req.url), 302);       // unknown match or database down: the generic card

  const h = data.T[m.h], a = data.T[m.a];
  const [photo, hl, al] = await Promise.all([safeImage(m.img), safeImage(h.l), safeImage(a.l)]);
  const d = new Date(m.ts);
  const line = [cs(m), m.season, `${d.getUTCDate()} ${MON[d.getUTCMonth()][0]}${MON[d.getUTCMonth()].slice(1).toLowerCase()} ${d.getUTCFullYear()}`].filter(Boolean).join('  ·  ');

  const Crest = ({ t, src }) => src
    ? <img src={src} width={170} height={170} style={{ objectFit: 'contain' }} />
    : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 150, height: 150, borderRadius: 75, background: t.c, color: t.t, fontSize: 54, fontWeight: 700 }}>{t.s}</div>;
  const Team = ({ t, src }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 330 }}>
      <Crest t={t} src={src} />
      <div style={{ display: 'flex', marginTop: 22, fontSize: 38, fontWeight: 700, textAlign: 'center', justifyContent: 'center' }}>{clipText(t.short || t.n, 22)}</div>
    </div>
  );

  return new ImageResponse((
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', color: '#fff', background: `linear-gradient(135deg, ${h.c} 0%, ${a.c} 100%)` }}>
      {photo ? <img src={photo} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }} /> : null}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', background: photo ? 'rgba(8,8,25,.72)' : 'rgba(8,8,25,.55)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '50px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 30, fontWeight: 700 }}>
          <div style={{ display: 'flex', color: OG.accent, letterSpacing: 4 }}>FUTLOG</div>
          <div style={{ display: 'flex', color: '#d8d4f5', fontSize: 28 }}>{clipText(m.comp, 40)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Team t={h} src={hl} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 150, fontWeight: 700, lineHeight: 1 }}>{m.hs} – {m.as}</div>
            {m.stage ? <div style={{ display: 'flex', marginTop: 8, fontSize: 30, color: OG.accent }}>{m.stage}</div> : null}
          </div>
          <Team t={a} src={al} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', fontSize: 30, color: '#d8d4f5' }}>{line}</div>
      </div>
    </div>
  ), { ...OG_SIZE, headers: OG_HEADERS });
}
