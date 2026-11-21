// Server-only: makes every match / article / post page live at ONE address.
//   /match/12345                      -> permanent redirect to /match/12345-arsenal-vs-chelsea-2026
//   /match/12345-some-old-wrong-slug  -> permanent redirect to the same canonical address
// Next sends these as HTTP 308 (the permanent redirect that keeps the request method; search engines treat it like a 301
// and move the old URL's ranking to the new one). If the thing does not exist, or the database is down, nothing happens and the page
// shows its normal "not found" state instead of redirecting anywhere.
import { permanentRedirect } from 'next/navigation';
import { query } from './db';
import { serverMatches } from './servermatches';
import { articlePath, lastSegment, matchPath, parseId, postPath } from './slug';

const decode = s => { try { return decodeURIComponent(s); } catch { return String(s ?? ''); } };
const go = (raw, path) => { if (decode(Array.isArray(raw) ? raw[0] : raw) !== decode(lastSegment(path))) permanentRedirect(path); };

export async function canonicalMatch(raw) {
  const id = parseId(raw); if (!id) return;
  let path = null;
  try { const { T, byId } = await serverMatches(), m = byId.get(Number(id)); if (m) path = matchPath(m, T); } catch { /* database down */ }
  if (path) go(raw, path);
}

export async function canonicalArticle(raw) {
  const id = parseId(raw); if (!id) return;
  let path = null;
  try {
    const { rows } = await query(`SELECT title FROM articles WHERE article_id = $1 AND status = 'published'`, [id]);   // drafts are private: never redirect them
    if (rows[0]) path = articlePath(id, rows[0].title);
  } catch { /* database down */ }
  if (path) go(raw, path);
}

export async function canonicalPost(raw) {
  const id = parseId(raw); if (!id) return;
  let path = null;
  try { const { rows } = await query('SELECT body FROM posts WHERE post_id = $1', [id]); if (rows[0]) path = postPath(id, rows[0].body); } catch { /* database down */ }
  if (path) go(raw, path);
}
