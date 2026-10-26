import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { person } from '@/lib/content';
import { dbError, json } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/users?suggest=1&limit=5  -> people you do not follow yet ("Who to follow"): authors first, then the newest members
export async function GET(req) {
  const limit = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get('limit')) || 5, 1), 20);
  try {
    const me = await getSessionUser(), meId = me?.user_id ?? null;
    const { rows } = await query(
      `SELECT u.handle, u.display_name, u.avatar_url, u.updated_at AS u_updated FROM users u
        WHERE ($1::bigint IS NULL OR (u.user_id <> $1 AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.user_id)))
        ORDER BY u.is_author DESC, u.created_at DESC LIMIT ${limit}`, [meId]);
    return json({ users: rows.map(r => person(r)) });
  } catch (err) { return dbError(err); }
}
