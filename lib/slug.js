// Readable URLs:  /match/12345-arsenal-vs-chelsea-2026   /article/987-why-latin-america-produces-talent   /post/55-what-a-goal-last-night
// The number at the front is the real id; the words after it are only for people and search engines and may be anything
// (a wrong or old slug is redirected to the right one by the page, see lib/canonical.js). Pure functions: safe on server and browser.
import { MON } from './consts';

const EXTRA = { 'ı': 'i', 'İ': 'i', 'ə': 'e', 'Ə': 'e', 'ß': 'ss', 'ø': 'o', 'Ø': 'o', 'đ': 'd', 'Đ': 'd', 'ł': 'l', 'Ł': 'l', 'æ': 'ae', 'œ': 'oe', 'þ': 'th' };

// "Real Madrid – Bayern!" -> "real-madrid-bayern". Accents are folded to plain letters (ç -> c, ü -> u); other scripts (Cyrillic, Greek...) are kept.
export function slugify(s, max = 60) {
  let t = String(s ?? '').replace(/https?:\/\/\S+/gi, ' ').replace(/[ıİəƏßøØđĐłŁæœþ]/g, c => EXTRA[c])
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  if (t.length > max) { const cut = t.slice(0, max), i = cut.lastIndexOf('-'); t = (i > max * 0.5 ? cut.slice(0, i) : cut).replace(/-+$/, ''); }
  return t;
}

// The id at the front of a route parameter: "12345-arsenal-vs-chelsea-2026" -> "12345", "12345" -> "12345", "abc" -> null.
export function parseId(param) {
  let s = Array.isArray(param) ? param[0] : param;
  try { s = decodeURIComponent(s); } catch { /* keep as is */ }
  const m = /^(\d{1,18})(?:-|$)/.exec(String(s ?? ''));
  return m ? m[1] : null;
}

const withSlug = (id, slug) => slug ? `${id}-${slug}` : String(id);

// match: both team slugs (the `slug` column of the teams table, else the team name) + the year played
export function matchSlug(m, T) {
  const t = x => slugify(T?.[x]?.slug || T?.[x]?.short || T?.[x]?.n || '', 40);
  const year = m.ts ? new Date(m.ts).getUTCFullYear() : '';
  return [t(m.h), 'vs', t(m.a), year].filter(Boolean).join('-');
}
export const matchPath = (m, T) => `/match/${withSlug(m.id, matchSlug(m, T))}`;
export const articlePath = (id, title) => `/article/${withSlug(id, slugify(title))}`;
export const postPath = (id, body) => `/post/${withSlug(id, slugify(body, 50))}`;

// the part after "/match/" (or "/article/", "/post/") that a canonical URL must have
export const lastSegment = path => path.slice(path.lastIndexOf('/') + 1);
