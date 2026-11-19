import { query } from '@/lib/db';
import { posInt } from '@/lib/content';
import { fail, json } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// "45+2" -> 45.02, "7" -> 7, "" -> 999 (unknown minutes go last)
const sortKey = m => { const [a, b] = String(m ?? '').split('+'); const n = parseInt(a, 10); return Number.isNaN(n) ? 999 : n + (parseInt(b, 10) || 0) / 100; };

// GET /api/matches/:id/events  -> goals and cards of one match, from the `fixture_events` table (filled by sync_espn.py)
// { events: [{ side: 'home'|'away', minute, type, player, assist }] }   Empty list when the match has none or the table does not exist yet.
export async function GET(_req, { params }) {
  const id = posInt((await params).id); if (!id) return fail(404, 'No such match');
  try {
    const { rows } = await query(
      `SELECT team_side, minute, event_type, player, assist FROM fixture_events WHERE event_id = $1::text`, [String(id)]);
    const events = rows
      .map(r => ({ side: r.team_side === 'away' ? 'away' : 'home', minute: r.minute || '', type: r.event_type || '', player: r.player || '', assist: r.assist || '' }))
      .sort((a, b) => sortKey(a.minute) - sortKey(b.minute));
    return json({ events });
  } catch (err) {
    if (err.code === '42P01') return json({ events: [] });          // fixture_events not created yet: the page falls back to goal totals
    console.error('GET /api/matches/:id/events failed:', err);
    return fail(500, 'Could not load match events');
  }
}
