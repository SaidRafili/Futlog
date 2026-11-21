import { ImageResponse } from 'next/og';
import { OG, OG_HEADERS, OG_SIZE, clipText } from '@/lib/ogcard';

export const runtime = 'nodejs';

// GET /og?title=...&sub=...   -> a 1200x630 branded share card (used for the home page, profiles, searches and articles without a cover)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const title = clipText(sp.get('title') || 'Futlog', 90), sub = clipText(sp.get('sub') || 'Log, rate and revisit the football matches you watch.', 140);
  const big = title.length > 48 ? 56 : title.length > 28 ? 70 : 88;
  return new ImageResponse((
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 70, color: '#fff',
      background: `linear-gradient(135deg, ${OG.bg} 0%, #1b1647 100%)` }}>
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 34, fontWeight: 700, color: OG.accent, letterSpacing: 4 }}>
        <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, background: OG.accent, marginRight: 16 }} />FUTLOG
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: big, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
        <div style={{ display: 'flex', marginTop: 26, fontSize: 32, color: OG.muted, lineHeight: 1.3 }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', height: 8, width: 220, background: OG.accent }} />
    </div>
  ), { ...OG_SIZE, headers: OG_HEADERS });
}
