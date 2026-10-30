// Weighted random selection used for the home page, the "Mix" feed and random comment order.
// Pure functions, no imports: safe to use on the server (API routes) and in the browser.
//
// Algorithm: Efraimidis–Spirakis weighted sampling WITHOUT replacement.
//   every item gets a random key  key = -ln(u) / weight   (u uniform in (0,1))
//   sorting by key ascending gives a random order where heavy items tend to come first,
//   but any item (even with weight ~0) still has a chance. Taking the first k = a weighted sample.
// Then an "author spread" pass makes sure the same author is not shown twice in a row when avoidable.

// Small seedable PRNG (mulberry32). Same seed -> same order, so a page can be reproduced or kept stable.
export function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newSeed = () => (Math.random() * 4294967296) >>> 0;

// Seed from a query-string value; a missing/invalid value gives a fresh random seed (a different mix on every reload).
export const parseSeed = v => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < 4294967296 ? n : newSeed();
};

// How "interesting" an item is. Always > 0 so brand-new / unliked items still get shown.
//   engagement : grows slowly (log) so one viral item cannot take over the page
//   recency    : halves every `halfLifeHours`, but never drops below `floor` so good old items can come back
export function weightOf({ likes = 0, comments = 0, at, halfLifeHours = 72, floor = 0.15, now = Date.now() }) {
  const engagement = 1 + 2 * Math.log1p(Math.max(0, likes)) + 3 * Math.log1p(Math.max(0, comments));
  const ageH = at ? Math.max(0, (now - new Date(at).getTime()) / 3600000) : 0;
  const recency = Math.max(floor, Math.pow(0.5, ageH / halfLifeHours));
  return engagement * recency;
}

// Weighted random order of ALL items (heavier items tend to be earlier).
export function weightedOrder(items, weightFn, rng = Math.random) {
  return items
    .map(it => {
      const w = Math.max(1e-9, Number(weightFn(it)) || 0);
      const u = Math.min(1 - 1e-12, Math.max(1e-12, rng()));
      return { it, key: -Math.log(u) / w };
    })
    .sort((a, b) => a.key - b.key)
    .map(x => x.it);
}

// Re-orders so that neighbours have a different keyFn(item) (e.g. the author) where possible, keeping the random order otherwise.
// Among the first few eligible items it takes the one whose author has the most items left, so a prolific author is not stranded at the end.
export function spreadBy(items, keyFn) {
  const left = [...items], out = [], remaining = new Map();
  for (const x of left) remaining.set(keyFn(x), (remaining.get(keyFn(x)) || 0) + 1);
  while (left.length) {
    const last = out.length ? keyFn(out[out.length - 1]) : null;
    const cand = [];
    for (let i = 0; i < left.length && cand.length < 3; i++) if (keyFn(left[i]) !== last) cand.push(i);
    let pick = cand.length ? cand.reduce((b, i) => remaining.get(keyFn(left[i])) > remaining.get(keyFn(left[b])) ? i : b, cand[0]) : 0;
    const [it] = left.splice(pick, 1);
    remaining.set(keyFn(it), remaining.get(keyFn(it)) - 1);
    out.push(it);
  }
  return out;
}

// One call: pick `k` items from `items` as a weighted random sample and spread the authors.
//   opts: seed, k, likes(item), comments(item), at(item), author(item), halfLifeHours, floor
export function pickRandom(items, opts = {}) {
  const { seed, k = items.length, likes = x => x.likes, comments = x => x.comments ?? x.replies, at = x => x.at ?? x.publishedAt,
    author = x => x.user?.handle ?? x.author?.handle, halfLifeHours = 72, floor = 0.15 } = opts;
  const rng = seed == null ? Math.random : makeRng(seed), now = Date.now();
  const w = x => weightOf({ likes: likes(x), comments: comments(x), at: at(x), halfLifeHours, floor, now });
  const sample = weightedOrder(items, w, rng).slice(0, k);
  return author ? spreadBy(sample, author) : sample;
}
