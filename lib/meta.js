// Server-only: <title> and <meta> for the dynamic routes, used by generateMetadata() in app/**/page.js.
// Every builder returns a complete Next metadata object and never throws: if the database is down or the row does not exist,
// the page still renders and gets a generic title (missing things are marked noindex).
import { query } from './db';
import { bigId } from './content';
import { cleanHandle } from './users';
import { serverMatches } from './servermatches';
import { cs } from './data';
import { MON } from './consts';

const SITE = 'Futlog';

const squash = s => String(s ?? '').replace(/\s+/g, ' ').trim();
// cut at a word boundary, add an ellipsis only when something was cut
export function clip(s, max) {
  s = squash(s);
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1), sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-–—]+$/, '') + '…';
}
// article text is markdown: keep the words, drop images, link targets, emphasis marks, heading and list markers
const plain = s => squash(String(s)
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/^\s*(#{1,6}|[-*+]|\d+[.)])\s+/gm, '').replace(/[*_`>]/g, ''));

// title gets the " · Futlog" suffix the whole site uses; Open Graph / Twitter text mirrors it
// image: a URL (absolute, or relative to metadataBase) or { url, width, height }; without one a branded card is generated at /og
const card = (title, sub = '') => '/og?' + new URLSearchParams({ title: clip(title, 90), ...(sub ? { sub: clip(sub, 140) } : {}) });
export function pageMeta(title, description, { noindex = false, og = {}, image } = {}) {
  const full = `${title} · ${SITE}`;
  const img = typeof image === 'string' ? { url: image } : image || { url: card(title, description), width: 1200, height: 630 };
  const images = [{ ...img, alt: img.alt || title }];
  return {
    title: full, description,
    openGraph: { title: full, description, siteName: SITE, type: 'website', images, ...og },
    twitter: { card: 'summary_large_image', title: full, description, images: [images[0].url] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

const notFound = what => pageMeta(`${what} not found`, `This ${what.toLowerCase()} does not exist on Futlog, or it is no longer available.`, { noindex: true });
const unavailable = () => ({ title: SITE });   // database not reachable: fall back to the layout's description

/* ---------- /article/:id ---------- */
export async function articleMeta(rawId) {
  const id = bigId(rawId); if (!id) return notFound('Article');
  try {
    // published articles only: a draft's title must not leak into <title> for crawlers or link previews
    const { rows } = await query(
      `SELECT a.title, a.category, a.body, a.cover_image_url, a.published_at, a.updated_at, u.display_name
         FROM articles a JOIN users u ON u.user_id = a.author_id WHERE a.article_id = $1 AND a.status = 'published'`, [id]);
    const a = rows[0]; if (!a) return notFound('Article');
    const text = plain((a.body || []).join(' '));
    const desc = text ? clip(text, 160) : `${a.category} article by ${a.display_name} on ${SITE}.`;
    // the article's own cover when it has one, otherwise a generated card with its title
    const image = a.cover_image_url ? { url: a.cover_image_url, alt: a.title } : { url: card(a.title, `${a.category} · by ${a.display_name}`), width: 1200, height: 630 };
    return pageMeta(a.title, desc, { image, og: {
      type: 'article', authors: [a.display_name], section: a.category,
      ...(a.published_at ? { publishedTime: new Date(a.published_at).toISOString() } : {}),
      ...(a.updated_at ? { modifiedTime: new Date(a.updated_at).toISOString() } : {}),
    } });
  } catch (err) { console.error('articleMeta failed:', err.message); return unavailable(); }
}

/* ---------- /match/:id ---------- */
export async function matchMeta(rawId) {
  const id = Number(rawId);
  try {
    const { T, byId } = await serverMatches();
    const m = Number.isSafeInteger(id) ? byId.get(id) : null; if (!m) return notFound('Match');
    const h = T[m.h], a = T[m.a], score = `${h.n} ${m.hs}–${m.as} ${a.n}`;
    const d = new Date(m.ts), date = `${d.getUTCDate()} ${MON[d.getUTCMonth()][0]}${MON[d.getUTCMonth()].slice(1).toLowerCase()} ${d.getUTCFullYear()}`;
    const desc = `${score} (${cs(m)} ${m.season}), played ${date}. Rate the match, read reviews and join the discussion on ${SITE}.`;
    return pageMeta(score, desc, { image: { url: `/og/match/${m.id}`, width: 1200, height: 630, alt: score } });
  } catch (err) { console.error('matchMeta failed:', err.message); return unavailable(); }
}

/* ---------- /profile/:u ---------- */
export async function profileMeta(rawHandle) {
  const h = cleanHandle(rawHandle); if (!h) return notFound('Profile');
  try {
    const { rows } = await query(
      `SELECT u.display_name, u.bio, u.location,
              (SELECT count(*)::int FROM user_matches WHERE user_id = u.user_id AND kind = 'watched') AS watched,
              (SELECT count(*)::int FROM articles WHERE author_id = u.user_id AND status = 'published') AS articles,
              (SELECT count(*)::int FROM follows WHERE followee_id = u.user_id) AS followers
         FROM users u WHERE u.handle = $1`, [h]);
    const u = rows[0]; if (!u) return notFound('Profile');
    const stats = `${u.watched} ${u.watched === 1 ? 'match' : 'matches'} watched, ${u.articles} ${u.articles === 1 ? 'article' : 'articles'}, ${u.followers} ${u.followers === 1 ? 'follower' : 'followers'}`;
    const desc = u.bio ? clip(`${u.bio} · ${stats}`, 160) : `${u.display_name} (@${h}) on ${SITE}: ${stats}.`;
    return pageMeta(`${u.display_name} (@${h})`, desc, { image: { url: card(u.display_name, `@${h} · ${stats}`), width: 1200, height: 630 }, og: { type: 'profile', username: h } });
  } catch (err) { console.error('profileMeta failed:', err.message); return unavailable(); }
}

/* ---------- /post/:id ---------- */
export async function postMeta(rawId) {
  const id = bigId(rawId); if (!id) return notFound('Post');
  try {
    const { rows } = await query(
      `SELECT p.body, u.display_name, u.handle, (SELECT count(*)::int FROM post_images i WHERE i.post_id = p.post_id) AS pics,
              (SELECT i.image_id::text FROM post_images i WHERE i.post_id = p.post_id ORDER BY i.position LIMIT 1) AS first_pic
         FROM posts p JOIN users u ON u.user_id = p.user_id WHERE p.post_id = $1`, [id]);
    const p = rows[0]; if (!p) return notFound('Post');
    const text = squash(p.body);
    const title = `${p.display_name}: “${text ? clip(text, 60) : 'Picture'}”`;
    const desc = text ? clip(`${p.display_name} (@${p.handle}) on ${SITE}: ${text}`, 160) : `A post with ${p.pics === 1 ? 'a picture' : 'pictures'} by ${p.display_name} (@${p.handle}) on ${SITE}.`;
    return pageMeta(title, desc, p.first_pic ? { image: { url: `/api/post-images/${p.first_pic}`, alt: title } } : {});
  } catch (err) { console.error('postMeta failed:', err.message); return unavailable(); }
}

/* ---------- /search?q= ---------- */
export function searchMeta(q) {
  q = clip(Array.isArray(q) ? q[0] : q, 80);
  return q
    ? pageMeta(`${q} · Search`, `Search results for “${q}” on ${SITE}: matches, people, articles and posts.`)
    : pageMeta('Search', `Search ${SITE} for football matches, people, articles and posts.`);
}
