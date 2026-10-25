// Usage:  npm run db:seed
// Gives the demo user (saidrafili) some activity so the profile page has something to show:
// watched / liked / on-site matches taken from your newest fixtures, three reviews and a few follows.
// Needs: schema.sql applied, seed_demo_authors.sql applied (creates the users) and the fixtures table loaded.
import pg from 'pg';
import { getPoolConfig } from '../lib/dbconfig.mjs';

const ME = process.env.ME_HANDLE || 'saidrafili';
const pool = new pg.Pool(getPoolConfig());
const q = (t, p) => pool.query(t, p);

try {
  // the fixtures table's column names vary a little between setups (eventId / event_id ...), so look them up
  const cols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_name = 'fixtures'`)).rows.map(r => r.column_name);
  const find = (...names) => cols.find(c => names.includes(c.toLowerCase().replace(/_/g, '')));
  const idCol = find('eventid'), dateCol = find('date', 'eventdate'), statusCol = find('statusid');
  if (!idCol || !dateCol) throw new Error('fixtures table needs an eventId and a date column');
  const where = statusCol ? `WHERE "${statusCol}"::int IN (28,45,46,47)` : '';
  const ids = (await q(`SELECT "${idCol}"::int AS id FROM fixtures ${where} ORDER BY "${dateCol}"::timestamptz DESC LIMIT 40`)).rows.map(r => r.id);
  if (ids.length < 10) throw new Error('fewer than 10 finished fixtures found: load fixtures first (npm run import:fixtures)');

  const me = (await q(`SELECT user_id FROM users WHERE handle = $1`, [ME])).rows[0];
  if (!me) throw new Error(`user "${ME}" not found: run scripts/seed_demo_authors.sql first (or save the settings page once)`);

  const add = (kind, list) => q(
    `INSERT INTO user_matches (user_id, match_id, kind, created_at)
     SELECT $1, m, $2, now() - (g * interval '1 day' * 2) - (random() * interval '20 hours')
       FROM unnest($3::int[]) WITH ORDINALITY AS t(m, g) ON CONFLICT DO NOTHING`, [me.user_id, kind, list]);
  await add('watched', ids.slice(0, 24));
  await add('liked', [ids[0], ids[2], ids[3], ids[7], ids[11]]);
  await add('onsite', [ids[4], ids[9]]);

  if (!(await q(`SELECT 1 FROM reviews WHERE user_id = $1 LIMIT 1`, [me.user_id])).rowCount) {
    const reviews = [['The second half was the best 45 minutes of the season', 9, ids[0]], ['Tactical breakdown: how the midfield decided it', 8, ids[2]], ['The atmosphere nobody could have scripted', 9, ids[4]]];
    for (const [i, [title, rating, match]] of reviews.entries())
      await q(`INSERT INTO reviews (user_id, match_id, title, rating, created_at) VALUES ($1,$2,$3,$4, now() - $5 * interval '3 days')`, [me.user_id, match, title, rating, i + 1]);
  }
  await q(`INSERT INTO follows (follower_id, followee_id, created_at)
           SELECT $1, user_id, now() - interval '5 days' FROM users WHERE handle <> $2 AND is_author ON CONFLICT DO NOTHING`, [me.user_id, ME]);
  await q(`INSERT INTO follows (follower_id, followee_id, created_at)
           SELECT user_id, $1, now() - interval '3 days' FROM users WHERE handle <> $2 AND is_author ON CONFLICT DO NOTHING`, [me.user_id, ME]);
  console.log(`Seeded demo activity for @${ME}`);
} catch (e) { console.error('Failed: ' + e.message); process.exitCode = 1; }
finally { await pool.end(); }
