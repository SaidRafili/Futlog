import { query } from '@/lib/db';
import { requireUser } from '@/lib/content';
import { dbError, fail, json } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 4 * 1024 * 1024;   // Vercel functions reject request bodies over ~4.5 MB
const PER_HOUR = 30;                 // uploads per user per hour

// Look at the first bytes of the file instead of trusting the browser's file type. SVG is left out on purpose (it can carry scripts).
function sniff(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 6 && b.toString('latin1', 0, 3) === 'GIF') return 'image/gif';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// POST /api/article-images   multipart form, field "file"   (signed-in users)
// -> 201 { id, url: '/api/article-images/<id>' }
export async function POST(req) {
  const g = await requireUser(req, 'Sign in to upload images'); if (g.res) return g.res;
  let form;
  try { form = await req.formData(); } catch { return fail(400, 'Send the image as a multipart form'); }
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) return fail(400, 'Choose an image file');
  if (file.size > MAX_BYTES) return fail(413, 'The image is larger than 4 MB');
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) return fail(400, 'Use a JPG, PNG, WebP or GIF image');
  try {
    const n = (await query(`SELECT count(*)::int AS n FROM article_images WHERE user_id = $1 AND created_at > now() - interval '1 hour'`, [g.me.user_id])).rows[0].n;
    if (n >= PER_HOUR) return fail(429, 'Too many uploads. Try again in a little while.');
    const { rows } = await query(
      `INSERT INTO article_images (user_id, content_type, size_bytes, data) VALUES ($1, $2, $3, $4) RETURNING image_id`,
      [g.me.user_id, type, buf.length, buf]);
    const id = String(rows[0].image_id);
    return json({ id, url: '/api/article-images/' + id }, 201);
  } catch (err) { return dbError(err); }
}
