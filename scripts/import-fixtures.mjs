// Usage:  npm run import:fixtures -- path/to/fixtures.csv
// Loads the CSV into the `fixtures` table of the "teams" database. Safe to re-run (upserts by eventId).
import fs from 'node:fs';
import pg from 'pg';
import { getPoolConfig, DB_NAME } from '../lib/dbconfig.mjs';

const file = process.argv[2] || 'fixtures.csv';
if (!fs.existsSync(file)) { console.error('File not found: ' + file); process.exit(1); }

const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
const col = {};
lines[0].split(',').forEach((k, i) => col[k.trim()] = i);
for (const k of ['eventId', 'seasonType', 'leagueId', 'date', 'venueId', 'attendance', 'homeTeamId', 'awayTeamId', 'homeTeamWinner', 'awayTeamWinner',
  'homeTeamScore', 'awayTeamScore', 'homeTeamShootoutScore', 'awayTeamShootoutScore', 'statusId', 'updateTime'])
  if (!(k in col)) { console.error(`CSV is missing the "${k}" column`); process.exit(1); }

const int = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const bool = v => { const s = String(v ?? '').trim().toLowerCase(); return s === 'true' ? true : s === 'false' ? false : null; };
const ts = v => { const s = String(v ?? '').trim(); return s ? s.replace(' ', 'T') + 'Z' : null; }; // CSV times are UTC

const rows = [];
for (const line of lines.slice(1)) {
  const f = line.split(',').map(x => x.trim()), g = k => f[col[k]];
  const r = [int(g('eventId')), int(g('seasonType')), int(g('leagueId')), ts(g('date')), int(g('venueId')), int(g('attendance')) ?? 0,
    int(g('homeTeamId')), int(g('awayTeamId')), bool(g('homeTeamWinner')), bool(g('awayTeamWinner')),
    int(g('homeTeamScore')) ?? 0, int(g('awayTeamScore')) ?? 0, int(g('homeTeamShootoutScore')) ?? 0, int(g('awayTeamShootoutScore')) ?? 0,
    int(g('statusId')), ts(g('updateTime'))];
  if (r[0] == null || r[2] == null || !r[3] || r[6] == null || r[7] == null || r[14] == null) continue; // skip broken rows
  rows.push(r);
}
// the same eventId twice in one INSERT would fail, keep the last one
const unique = [...new Map(rows.map(r => [r[0], r])).values()];

const client = new pg.Client(getPoolConfig());
await client.connect();
console.log(`Connected to database "${DB_NAME}". Importing ${unique.length} of ${lines.length - 1} rows...`);

const SQL = `
INSERT INTO fixtures (event_id, season_type, league_id, event_date, venue_id, attendance, home_team_id, away_team_id, home_team_winner, away_team_winner,
  home_team_score, away_team_score, home_shootout_score, away_shootout_score, status_id, update_time)
SELECT * FROM unnest($1::int[], $2::int[], $3::int[], $4::timestamptz[], $5::int[], $6::int[], $7::int[], $8::int[], $9::bool[], $10::bool[],
  $11::int[], $12::int[], $13::int[], $14::int[], $15::int[], $16::timestamptz[])
ON CONFLICT (event_id) DO UPDATE SET
  season_type = EXCLUDED.season_type, league_id = EXCLUDED.league_id, event_date = EXCLUDED.event_date, venue_id = EXCLUDED.venue_id,
  attendance = EXCLUDED.attendance, home_team_id = EXCLUDED.home_team_id, away_team_id = EXCLUDED.away_team_id,
  home_team_winner = EXCLUDED.home_team_winner, away_team_winner = EXCLUDED.away_team_winner,
  home_team_score = EXCLUDED.home_team_score, away_team_score = EXCLUDED.away_team_score,
  home_shootout_score = EXCLUDED.home_shootout_score, away_shootout_score = EXCLUDED.away_shootout_score,
  status_id = EXCLUDED.status_id, update_time = EXCLUDED.update_time`;

try {
  await client.query('BEGIN');
  for (let i = 0; i < unique.length; i += 2000) {
    const chunk = unique.slice(i, i + 2000);
    await client.query(SQL, Array.from({ length: 16 }, (_, c) => chunk.map(r => r[c])));
    process.stdout.write(`\r${Math.min(i + 2000, unique.length)} / ${unique.length}`);
  }
  await client.query('COMMIT');
  console.log('\nDone.');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('\nImport failed, nothing was changed:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
