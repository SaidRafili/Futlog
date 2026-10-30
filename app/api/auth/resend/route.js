import { checkOrigin, clientIp } from '@/lib/auth';
import { resendChallenge } from '@/lib/otp';
import { dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/auth/resend   body { challenge }   -> e-mails a new 6-digit code (old one stops working)
export async function POST(req) {
  const blocked = checkOrigin(req); if (blocked) return blocked;
  const b = await readBody(req);
  const challenge = String(b?.challenge ?? '');
  if (!challenge || challenge.length > 100) return fail(400, 'Start again');
  try {
    const r = await resendChallenge(challenge, clientIp(req));
    if (r.error) return fail(r.status, r.error);
    return json({ ok: true });
  } catch (err) { return dbError(err); }
}
