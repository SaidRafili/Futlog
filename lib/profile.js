// Client-side helpers for the profile + settings pages: talking to /api/users and turning the API response
// into the shape ProfileView renders.

export async function fetchProfile(handle) {
  const res = await fetch('/api/users/' + encodeURIComponent(handle), { cache: 'no-store' });
  if (res.status === 404) return null;                       // no such user in the database
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'HTTP ' + res.status);
  return j;
}

export async function sendJSON(url, method, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(j.error || 'HTTP ' + res.status); e.fields = j.fields; e.status = res.status; throw e; }
  return j;
}

export const minutesAgo = at => Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 60000));
export const daysSince = at => minutesAgo(at) / 1440;
export const joinedText = at => new Date(at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// DB response -> profile object. Matches that are not in the loaded fixtures are skipped.
export function fromApi(api, { byId, T }) {
  const days = { matches: {}, liked: {}, onsite: {} };
  const pick = (list, key) => list.map(x => { const m = byId(x.id); if (m) days[key][m.id] = daysSince(x.at); return m; }).filter(Boolean);
  const reviews = api.reviews.map(r => ({ t: r.title, m: byId(r.matchId), r: r.rating, d: daysSince(r.at) })).filter(r => r.m);
  const user = api.user;
  return {
    h: user.handle, name: user.name, bio: user.bio, loc: user.location || '—', joined: joinedText(user.joined),
    fav: user.favTeamId != null ? T[user.favTeamId] || null : null, avatar: user.avatar, banner: user.banner, hue: user.bannerHue,
    watched: pick(api.watched, 'matches'), liked: pick(api.liked, 'liked'), onsite: pick(api.onsite, 'onsite'), reviews, days,
    followers: api.followers.map(p => ({ h: p.handle, name: p.name, avatar: p.avatar })),
    following: api.following.map(p => ({ h: p.handle, name: p.name, avatar: p.avatar })),
    arts: api.articles.map(a => ({ id: a.id, t: a.title, m: `${a.category}${a.readMinutes ? ` · ${a.readMinutes} min read` : ''}${a.status === 'draft' ? ' · Draft' : ''}`, d: daysSince(a.at), draft: a.status === 'draft' })),
    saved: (api.saved || []).map(a => ({ id: a.id, t: a.title, m: `${a.category} · by ${a.authorName}`, d: daysSince(a.at) })),
    activity: api.activity.map(a => ({ ...a, match: a.matchId != null ? byId(a.matchId) : null, min: minutesAgo(a.at) }))
      .filter(a => a.matchId == null || a.match),
    counts: { followers: api.counts.followers, following: api.counts.following },
  };
}

// Resize + centre-crop an image file in the browser and return a JPEG data URL small enough to store in the database.
export async function prepareImage(file, w, h, maxChars) {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That image is over 15 MB.');
  const bmp = await createImageBitmap(file).catch(() => { throw new Error('Could not read that image.'); });
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const s = Math.max(w / bmp.width, h / bmp.height), dw = bmp.width * s, dh = bmp.height * s;
  ctx.fillStyle = '#0b0b19'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
  bmp.close?.();
  for (const q of [0.88, 0.78, 0.68, 0.55, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= maxChars) return url;
  }
  throw new Error('That image is too detailed to store. Try a smaller one.');
}

export const AVATAR = { w: 256, h: 256, max: 200_000 };
export const BANNER = { w: 1600, h: 400, max: 800_000 };

// A picture for a feed post: scaled down in the browser (longest side `max` px, aspect ratio kept, no cropping) and saved as a JPEG data URL
// small enough for the server (see MAX_IMAGE_BYTES in lib/content.js). Returns { data, w, h }.
export async function preparePostImage(file, { max = 1600, maxChars = 560_000 } = {}) {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP picture.');
  if (file.size > 25 * 1024 * 1024) throw new Error('That picture is over 25 MB.');
  const bmp = await createImageBitmap(file).catch(() => { throw new Error('Could not read that picture.'); });
  try {
    let scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    for (let round = 0; round < 4; round++, scale *= 0.8) {
      const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0b0b19'; ctx.fillRect(0, 0, w, h);          // transparent PNGs get the site colour behind them
      ctx.drawImage(bmp, 0, 0, w, h);
      for (const q of [0.86, 0.74, 0.62, 0.5]) {
        const data = canvas.toDataURL('image/jpeg', q);
        if (data.length <= maxChars) return { data, w, h };
      }
    }
  } finally { bmp.close?.(); }
  throw new Error('That picture is too detailed to upload. Try a smaller one.');
}
