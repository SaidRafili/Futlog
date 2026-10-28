import { query } from '@/lib/db';
import { bigId } from '@/lib/content';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/post-images/:id  -> the picture bytes. A picture never changes once saved, so browsers and CDNs may keep it for a year.
export async function GET(req, { params }) {
  const id = bigId((await params).id);
  if (!id) return new Response('Not found', { status: 404 });
  try {
    const { rows } = await query('SELECT mime, data FROM post_images WHERE image_id = $1', [id]);
    if (!rows[0]) return new Response('Not found', { status: 404 });
    return new Response(new Uint8Array(rows[0].data), {
      headers: {
        'Content-Type': rows[0].mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (err) {
    console.error('GET /api/post-images failed:', err);
    return new Response('Database error', { status: 500 });
  }
}
