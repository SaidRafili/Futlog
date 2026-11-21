// Server-only: gatekeeper for the match / article / post / profile pages, run on the server before anything is sent.
//   * the thing does not exist          -> notFound(): a real HTTP 404 and app/not-found.js (never a 200 with an "oops" message)
//   * it exists but the URL is not the official one:
//        /match/12345                      -> permanent redirect to /match/12345-arsenal-vs-chelsea-2026
//        /match/12345-some-old-wrong-slug  -> permanent redirect to the same address
//     Next sends these as HTTP 308 (the permanent redirect that keeps the request method; search engines treat it like a 301).
// If the database cannot be reached we cannot know, so nothing is decided here: the page loads and shows its own error state
// (a temporary outage must never turn real pages into 404s that search engines would drop).
import { notFound, permanentRedirect } from 'next/navigation';
import { query } from './db';
import { getSessionUser } from './auth';
import { serverMatches } from './servermatches';
import { cleanHandle } from './users';
import { articlePath, lastSegment, matchPath, parseId, postPath } from './slug';

const decode = s => { try { return decodeURIComponent(s); } catch { return String(s ?? ''); } };
const go = (raw, path) => { if (decode(Array.isArray(raw) ? raw[0] : raw) !== decode(lastSegment(path))) permanentRedirect(path); };

// runs a lookup; resolves to { ok: false } when the database / data could not be read, so the caller can tell "missing" from "unknown"
const look = async fn => { try { return { ok: true, v: await fn() }; } catch (err) { console.error('canonical lookup failed:', err.message); return { ok: false }; } };

export async function canonicalMatch(raw) {
  const id = parseId(raw); if (!id) notFound();
  const r = await look(async () => { const { T, byId } = await serverMatches(), m = byId.get(Number(id)); return m ? matchPath(m, T) : null; });
  if (!r.ok) return;
  if (!r.v) notFound();
  go(raw, r.v);
}

export async function canonicalArticle(raw) {
  const id = parseId(raw); if (!id) notFound();
  const r = await look(async () => {
    const { rows } = await query('SELECT title, status, author_id FROM articles WHERE article_id = $1', [id]);
    const a = rows[0]; if (!a) return null;
    if (a.status === 'published') return { path: articlePath(id, a.title) };
    const me = await getSessionUser();                               // a draft exists only for its author
    return me && String(me.user_id) === String(a.author_id) ? { draft: true } : null;
  });
  if (!r.ok) return;
  if (!r.v) notFound();
  if (r.v.path) go(raw, r.v.path);
}

export async function canonicalPost(raw) {
  const id = parseId(raw); if (!id) notFound();
  const r = await look(async () => { const { rows } = await query('SELECT body FROM posts WHERE post_id = $1', [id]); return rows[0] ? postPath(id, rows[0].body) : null; });
  if (!r.ok) return;
  if (!r.v) notFound();
  go(raw, r.v);
}

export async function canonicalProfile(raw) {
  const h = cleanHandle(decode(Array.isArray(raw) ? raw[0] : raw)); if (!h) notFound();
  const r = await look(async () => (await query('SELECT 1 FROM users WHERE handle = $1', [h])).rowCount > 0);
  if (!r.ok) return;
  if (!r.v) notFound();
}
