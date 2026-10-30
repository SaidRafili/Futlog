// Server-only helpers for articles, comments, likes, feed posts and reviews. Every row belongs to a user in the `users` table.
import { pool, query } from './db';
import { checkOrigin, getSessionUser } from './auth';
import { fail, imageSrc } from './users';

export const TARGETS = ['match', 'article', 'review', 'post'];            // things that can be commented on
export const LIKE_TARGETS = ['article', 'comment', 'review', 'post'];     // things that can be liked
export const MAX_COMMENT = 1000, MAX_POST = 280, MAX_BODY = 60_000;
export const MAX_POST_IMAGES = 4, MAX_IMAGE_BYTES = 450_000;      // per picture, after the browser has resized it

/* ---------- guards ---------- */
// Same-site request + signed in. Returns { me } or { res }.
export async function requireUser(req, message = 'Sign in to do that') {
  const blocked = checkOrigin(req); if (blocked) return { res: blocked };
  const me = await getSessionUser();
  if (!me) return { res: fail(401, message) };
  return { me };
}

export const posInt = v => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null; };
const BIG = v => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null; };
export const bigId = BIG;

export async function withTx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}

export const person = (r, p = '') => ({
  handle: r[p + 'handle'], name: r[p + 'display_name'], avatar: imageSrc(r[p + 'handle'], 'avatar', r[p + 'avatar_url'], r[p + 'u_updated']),
});

/* ---------- comments ---------- */
// $1 in every query that uses COMMENT_SELECT must be the signed-in user's id (or null).
export const COMMENT_SELECT = `
  SELECT c.comment_id, c.target_type, c.target_id, c.parent_id, c.body, c.edited_at, c.created_at, c.user_id,
         u.handle, u.display_name, u.avatar_url, u.updated_at AS u_updated,
         (SELECT count(*)::int FROM likes l WHERE l.target_type = 'comment' AND l.target_id = c.comment_id) AS likes,
         EXISTS (SELECT 1 FROM likes l WHERE l.target_type = 'comment' AND l.target_id = c.comment_id AND l.user_id = $1::bigint) AS liked
    FROM comments c JOIN users u ON u.user_id = c.user_id`;

export const commentOut = (r, meId) => ({
  id: Number(r.comment_id), type: r.target_type, targetId: Number(r.target_id), parentId: r.parent_id == null ? null : Number(r.parent_id),
  body: r.body, at: r.created_at, editedAt: r.edited_at, likes: r.likes, liked: r.liked, mine: meId != null && String(r.user_id) === String(meId),
  user: person(r),
});

// Adds `targetTitle` (the article's title) to comments written on articles, so a list can say WHICH article. null for other comments.
export async function withTargetTitles(list) {
  const ids = [...new Set(list.filter(c => c.type === 'article').map(c => c.targetId))];
  const titles = new Map();
  if (ids.length) {
    const { rows } = await query(`SELECT article_id, title FROM articles WHERE status = 'published' AND article_id = ANY($1::bigint[])`, [ids]);
    for (const r of rows) titles.set(Number(r.article_id), r.title);
  }
  return list.map(c => ({ ...c, targetTitle: c.type === 'article' ? titles.get(c.targetId) ?? null : null }));
}

export async function loadComment(id, meId) {
  const { rows } = await query(`${COMMENT_SELECT} WHERE c.comment_id = $2`, [meId, id]);
  return rows[0] ? commentOut(rows[0], meId) : null;
}

// Does the thing a comment is attached to exist (and may this user see it)?
export async function targetExists(type, id, meId) {
  if (type === 'match') return id <= 2147483647;       // fixtures live outside the FK world, like user_matches
  if (type === 'article') return (await query(`SELECT 1 FROM articles WHERE article_id = $1 AND (status = 'published' OR author_id = $2::bigint)`, [id, meId])).rowCount > 0;
  const table = { review: ['reviews', 'review_id'], post: ['posts', 'post_id'], comment: ['comments', 'comment_id'] }[type];
  return table ? (await query(`SELECT 1 FROM ${table[0]} WHERE ${table[1]} = $1`, [id])).rowCount > 0 : false;
}

/* ---------- articles ---------- */
export const ARTICLE_SELECT = `
  SELECT a.article_id, a.title, a.category, a.read_minutes, a.cover_image_url, a.status, a.published_at, a.created_at, a.updated_at, a.body,
         u.handle, u.display_name, u.avatar_url, u.updated_at AS u_updated, u.bio AS author_bio, a.author_id,
         (SELECT count(*)::int FROM likes l WHERE l.target_type = 'article' AND l.target_id = a.article_id) AS likes,
         (SELECT count(*)::int FROM comments c WHERE c.target_type = 'article' AND c.target_id = a.article_id) AS comments,
         EXISTS (SELECT 1 FROM likes l WHERE l.target_type = 'article' AND l.target_id = a.article_id AND l.user_id = $1::bigint) AS liked,
         EXISTS (SELECT 1 FROM article_saves s WHERE s.article_id = a.article_id AND s.user_id = $1::bigint) AS saved
    FROM articles a JOIN users u ON u.user_id = a.author_id`;

export const articleOut = (r, meId, full = false) => ({
  id: Number(r.article_id), title: r.title, category: r.category, readMinutes: r.read_minutes, cover: r.cover_image_url, status: r.status,
  publishedAt: r.published_at, updatedAt: r.updated_at, likes: r.likes, comments: r.comments, liked: r.liked, saved: r.saved,
  mine: meId != null && String(r.author_id) === String(meId),
  author: { ...person(r), bio: r.author_bio || '' },
  ...(full ? { body: r.body || [] } : {}),
});

// One article with its body and matches. Drafts are only visible to their author.
export async function loadArticle(id, meId) {
  const { rows } = await query(`${ARTICLE_SELECT} WHERE a.article_id = $2 AND (a.status = 'published' OR a.author_id = $1::bigint)`, [meId, id]);
  if (!rows[0]) return null;
  const ms = await query('SELECT match_id FROM article_matches WHERE article_id = $1 ORDER BY match_id', [id]);
  return { ...articleOut(rows[0], meId, true), matchIds: ms.rows.map(x => x.match_id) };
}

// Validates the article form. Returns { value } (clean fields, only the ones that were sent) or { errors }.
export function checkArticle(b, { partial = false } = {}) {
  const v = {}, errors = {};
  if (!partial || b.title !== undefined) {
    const t = String(b.title ?? '').trim();
    if (t.length < 3 || t.length > 300) errors.title = 'Title must be 3–300 characters'; else v.title = t;
  }
  if (!partial || b.category !== undefined) {
    const c = String(b.category ?? '').trim();
    if (c.length < 2 || c.length > 50) errors.category = 'Choose a category (2–50 characters)'; else v.category = c;
  }
  if (b.body !== undefined || !partial) {
    const paras = (Array.isArray(b.body) ? b.body : String(b.body ?? '').split(/\n\s*\n/)).map(p => String(p).trim()).filter(Boolean);
    if (paras.join('').length > MAX_BODY) errors.body = 'The article is too long';
    else { v.body = paras; v.words = paras.join(' ').split(/\s+/).filter(Boolean).length; }
  }
  if (b.cover !== undefined) {
    const c = b.cover === null ? '' : String(b.cover).trim();
    if (c && !/^https:\/\/[^\s]+$/.test(c)) errors.cover = 'Cover must be an https:// image link'; else if (c.length > 500) errors.cover = 'Link is too long'; else v.cover = c || null;
  }
  if (b.matchIds !== undefined) {
    const ids = Array.isArray(b.matchIds) ? [...new Set(b.matchIds.map(posInt))] : null;
    if (!ids || ids.includes(null) || ids.length > 8) errors.matchIds = 'Pick up to 8 matches'; else v.matchIds = ids;
  }
  if (b.status !== undefined) {
    if (!['draft', 'published'].includes(b.status)) errors.status = 'Status must be draft or published'; else v.status = b.status;
  }
  if (v.status === 'published' && v.body && !v.body.length) errors.body = 'Write something before publishing';
  return Object.keys(errors).length ? { errors } : { value: v };
}

export const readMinutes = words => Math.max(1, Math.ceil((words || 0) / 200));

/* ---------- feed posts ---------- */
export const POST_SELECT = `
  SELECT p.post_id, p.user_id, p.body, p.match_id, p.edited_at, p.created_at,
         u.handle, u.display_name, u.avatar_url, u.updated_at AS u_updated,
         (SELECT count(*)::int FROM likes l WHERE l.target_type = 'post' AND l.target_id = p.post_id) AS likes,
         (SELECT count(*)::int FROM comments c WHERE c.target_type = 'post' AND c.target_id = p.post_id) AS replies,
         EXISTS (SELECT 1 FROM likes l WHERE l.target_type = 'post' AND l.target_id = p.post_id AND l.user_id = $1::bigint) AS liked,
         (SELECT COALESCE(json_agg(json_build_object('id', i.image_id::text, 'w', i.width, 'h', i.height, 'alt', i.alt) ORDER BY i.position), '[]'::json)
            FROM post_images i WHERE i.post_id = p.post_id) AS images
    FROM posts p JOIN users u ON u.user_id = p.user_id`;

export const postOut = (r, meId) => ({
  id: Number(r.post_id), body: r.body, matchId: r.match_id, at: r.created_at, editedAt: r.edited_at, likes: r.likes, replies: r.replies, liked: r.liked,
  images: (r.images || []).map(i => ({ id: i.id, url: `/api/post-images/${i.id}`, w: i.w, h: i.h, alt: i.alt || '' })),
  mine: meId != null && String(r.user_id) === String(meId), user: person(r),
});

export async function loadPost(id, meId) {
  const { rows } = await query(`${POST_SELECT} WHERE p.post_id = $2`, [meId, id]);
  return rows[0] ? postOut(rows[0], meId) : null;
}

const IMG_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const hasMagic = (mime, buf) =>
  mime === 'image/jpeg' ? buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  : mime === 'image/png' ? buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  : buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';

// Validates the pictures sent with a new post: [{ data: 'data:image/jpeg;base64,...', w, h, alt }].
// Returns { images: [{ mime, bytes, w, h, alt }] } or { error }.
export function checkPostImages(list) {
  if (list === undefined || list === null) return { images: [] };
  if (!Array.isArray(list)) return { error: 'images must be a list' };
  if (list.length > MAX_POST_IMAGES) return { error: `You can attach up to ${MAX_POST_IMAGES} pictures` };
  const images = [];
  for (const x of list) {
    const m = IMG_RE.exec(String(x?.data ?? ''));
    if (!m) return { error: 'Pictures must be JPEG, PNG or WebP files' };
    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length > MAX_IMAGE_BYTES) return { error: 'A picture is too large. Try a smaller one' };
    if (!hasMagic(m[1], bytes)) return { error: 'That file is not a valid picture' };
    const dim = v => Number.isInteger(v) && v >= 1 && v <= 8192 ? v : null;
    images.push({ mime: m[1], bytes, w: dim(x.w), h: dim(x.h), alt: String(x.alt ?? '').trim().slice(0, 200) || null });
  }
  return { images };
}
