import { checkOrigin, destroySession } from '@/lib/auth';
import { dbError, json } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  const blocked = checkOrigin(req); if (blocked) return blocked;
  try { await destroySession(); return json({ ok: true }); } catch (err) { return dbError(err); }
}
