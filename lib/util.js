// Small pure helpers (ported from app.js)
export const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const hue = s => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) * 37 % 360;
export const avatarBg = (s, sat = 55, l = 42) => `hsl(${hue(s)} ${sat}% ${l}%)`;
export const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
export const ord = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';
export const tAgo = n => n < 1 ? 'just now' : n < 60 ? n + 'm' : n < 1440 ? Math.floor(n / 60) + 'h' : Math.floor(n / 1440) + 'd';
export const daysAgo = d => d === 1 ? '1 day ago' : d + ' Days ago';
export const profileHref = u => '/profile/' + u;
export const uniq = (matches, k) => [...new Set(matches.map(m => m[k]))].sort();
// ISO timestamp from the database -> "5m ago", "3h ago", "2d ago", or a date after a month
export const timeAgo = at => {
  const min = Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 60000));
  if (min < 1) return 'just now';
  if (min >= 43200) return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return tAgo(min) + ' ago';
};
export const shortDate = at => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' });
