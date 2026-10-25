// Server-only helpers shared by the /api/users and /api/follows routes.
import { query } from './db';
import { ME_HANDLE } from './util';

export const HANDLE_RE = /^[a-z0-9._]{3,30}$/;
export const KINDS = ['watched', 'liked', 'onsite'];
export const MAX_AVATAR = 200_000;   // characters of the data: URL (a 256px JPEG is ~30-60k)
export const MAX_BANNER = 800_000;   // 1600x400 JPEG is ~100-300k

export const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export const fail = (status, error, extra) => json({ error, ...extra }, status);

export function cleanHandle(raw) {
  const h = String(raw ?? '').trim().toLowerCase();
  return HANDLE_RE.test(h) ? h : null;
}

// No auth yet: only the one demo user may write. Swap this for a session check when sign-in exists.
export const isMe = handle => handle === ME_HANDLE;

export async function readBody(req) {
  try { const b = await req.json(); return b && typeof b === 'object' ? b : null; } catch { return null; }
}

export function dbError(err) {
  console.error('profile API failed:', err);
  // 42P01 = table missing, 42703 = column missing: the schema has not been (re)applied
  if (err.code === '42P01' || err.code === '42703')
    return fail(500, 'The profile tables are missing. Run `npm run db:schema` (scripts/schema.sql) and try again.', { code: err.code });
  return fail(500, 'Database error', { detail: err.message, code: err.code || null });
}

// How the browser should load an avatar/banner: uploaded images are served by our own image route, URLs are used as they are.
export function imageSrc(handle, kind, value, updatedAt) {
  if (!value) return null;
  if (value.startsWith('data:')) return `/api/users/${encodeURIComponent(handle)}/image/${kind}?v=${new Date(updatedAt).getTime()}`;
  return value;
}

export function publicUser(r) {
  return {
    handle: r.handle, name: r.display_name, bio: r.bio || '', location: r.location || '',
    avatar: imageSrc(r.handle, 'avatar', r.avatar_url, r.updated_at),
    banner: imageSrc(r.handle, 'banner', r.banner_url, r.updated_at),
    bannerHue: r.banner_hue, favTeamId: r.favourite_team_id, isAuthor: r.is_author, joined: r.created_at,
  };
}

export async function findUser(handle) {
  const { rows } = await query('SELECT * FROM users WHERE handle = $1', [handle]);
  return rows[0] || null;
}

// undefined -> leave unchanged, null/'' -> remove, otherwise must be an https URL or an uploaded image (data: URL)
export function checkImage(v, max) {
  if (v === undefined) return { skip: true };
  if (v === null || v === '') return { value: null };
  if (typeof v !== 'string') return { error: 'must be text' };
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v)) return v.length <= max ? { value: v } : { error: 'image is too large' };
  if (/^https:\/\/[^\s]+$/.test(v) && v.length <= 500) return { value: v };
  return { error: 'must be a JPEG/PNG/WebP upload or an https:// link' };
}
