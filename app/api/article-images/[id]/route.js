import { query } from '@/lib/db';
import { bigId } from '@/lib/content';
import { dbError, fail } from '@/lib/users';

export const runtime = 'nodejs';

// GET /api/article-images/:id   the image itself (public: article pages show it to everyone)
export async function GET(_req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such image');
  try {
    const r = (await query('SELECT content_type, data FROM article_images WHERE image_id = $1', [id])).rows[0];
    if (!r) return fail(404, 'No such image');
    return new Response(r.data, {
      headers: {
        'Content-Type': r.content_type,
        'Content-Length': String(r.data.length),
        'Cache-Control': 'public, max-age=31536000, immutable',   // an image never changes once uploaded
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) { return dbError(err); }
}
