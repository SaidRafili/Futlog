// Server-only: the same teams + fixtures + lookups the browser loads (lib/data.js), built once on the server so that
// generateMetadata() can put real team names and scores into <title> and <meta>. Never import this from a 'use client' file.
//
// It calls the route handlers directly instead of duplicating their SQL, so the column sniffing in /api/fixtures and the
// fixture-team -> team matching in lib/data.js stay the single source of truth. The result is cached for a few minutes.
import { GET as getTeams } from '@/app/api/teams/route';
import { GET as getFixtures } from '@/app/api/fixtures/route';
import { GET as getLookups } from '@/app/api/lookups/route';
import { applyLookups, buildMatches, parseFixtures, parseTeams } from './data';

const TTL = 10 * 60 * 1000;
const g = globalThis;

async function build() {
  const [tr, fr, lr] = await Promise.all([getTeams(), getFixtures(), getLookups().catch(() => null)]);
  if (!tr.ok) throw new Error('could not read teams');
  if (!fr.ok) throw new Error('could not read fixtures');
  applyLookups(lr && lr.ok ? await lr.json().catch(() => null) : null);
  const { T, TL } = parseTeams(await tr.json());
  const matches = buildMatches(parseFixtures(await fr.json()), T, TL);
  return { T, byId: new Map(matches.map(m => [m.id, m])) };
}

// -> { T, byId: Map(matchId -> match) }. Concurrent callers share one build; a failed build is retried on the next call.
export function serverMatches() {
  const c = g.__futlogServerMatches;
  if (c && Date.now() - c.at < TTL) return c.promise;
  const promise = build();
  g.__futlogServerMatches = { at: Date.now(), promise };
  promise.catch(() => { if (g.__futlogServerMatches?.promise === promise) g.__futlogServerMatches = null; });
  return promise;
}
