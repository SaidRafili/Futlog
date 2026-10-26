import { getSessionUser } from '@/lib/auth';
import { dbError, json, liteFor } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/auth/me -> { user: null } when signed out, otherwise the user plus the ids the header / match page need
export async function GET() {
  try {
    const u = await getSessionUser();
    return json(u ? await liteFor(u) : { user: null });
  } catch (err) { return dbError(err); }
}
