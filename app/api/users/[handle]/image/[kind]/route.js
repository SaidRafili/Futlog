import { query } from '@/lib/db';
import { cleanHandle, fail } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/users/:handle/image/avatar | banner  -> the uploaded image as a real image file (cached for a year; the ?v= in the URL changes on every save)
export async function GET(_req, { params }) {
  const { handle: raw, kind } = await params;
  const handle = cleanHandle(raw);
  const col = kind === 'avatar' ? 'avatar_url' : kind === 'banner' ? 'banner_url' : null;
  if (!handle || !col) return fail(404, 'Not found');
  try {
    const { rows } = await query(`SELECT ${col} AS v FROM users WHERE handle = $1`, [handle]);
    const v = rows[0]?.v;
    if (!v) return fail(404, 'Not found');
    if (v.startsWith('https://')) return Response.redirect(v, 302);
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(v);
    if (!m) return fail(404, 'Not found');
    return new Response(Buffer.from(m[2], 'base64'), { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch (err) { console.error('image route failed:', err); return fail(500, 'Database error'); }
}
