import { siteUrl } from './siteurl';

// Server-only helpers for the generated share images (/og and /og/match/:id), drawn with next/og (ImageResponse).
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_HEADERS = { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' };
export const OG = { bg: '#0b0b19', panel: '#030305', accent: '#a78bfa', deep: '#5b4fd6', muted: '#8f8cb0' };

export const clipText = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

// A remote picture as a data URI, or null. next/og can only draw PNG / JPEG / GIF / SVG and throws on anything else
// (or on a slow / broken link), so a bad crest or stadium photo must never take the whole card down.
export async function safeImage(url, { max = 3_000_000, ms = 3500 } = {}) {
  url = String(url || '');
  if (/^\/(?!\/)/.test(url)) url = new URL(url, siteUrl()).href;      // our own /venues/... copy (http is fine on localhost)
  else if (!/^https:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!res.ok || !/^image\/(png|jpe?g|gif|svg\+xml)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > max) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch { return null; }
}
