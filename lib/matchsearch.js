// Search over the matches and teams that are already loaded in the browser (the fixtures table is not searched on the server).
// Same rules as the server: accents and capitals do not matter, every word must match, and better matches come first.
import { fold, tokens } from './fold';

const SIDES = /\s+(?:vs?\.?|[-–—])\s+/i;
const teamText = t => fold([t.n, t.short, t.s, t.loc].filter(Boolean).join(' '));

// Does every word appear in this text? 0 = no, otherwise a score: 3 = the text starts with the first word, 2 = a word starts with each, 1 = just inside
function covers(text, toks) {
  if (!toks.length) return 1;
  let s = 3;
  for (const t of toks) {
    if (!text.includes(t)) return 0;
    if (!text.startsWith(toks[0])) s = Math.min(s, text.includes(' ' + t) ? 2 : 1);
  }
  return s;
}

export function searchMatches(matches, T, q, { league = '', season = '' } = {}) {
  const sides = String(q || '').split(SIDES).map(x => tokens(x)).filter(s => s.length);
  const all = tokens(q);
  const out = [];
  for (const m of matches) {
    if ((league && m.comp !== league) || (season && m.season !== season)) continue;
    const h = teamText(T[m.h]), a = teamText(T[m.a]);
    let score;
    if (sides.length >= 2) {                                   // "real madrid vs bayern": one word group per team, either way round
      const [x, y] = sides, direct = Math.min(covers(h, x), covers(a, y)), flip = Math.min(covers(h, y), covers(a, x));
      score = Math.max(direct, flip);
      if (score) score += 2;
    } else if (!all.length) score = 1;
    else {
      const other = fold([m.comp, m.stage, m.season].join(' '));
      const one = Math.max(covers(h, all), covers(a, all));    // all words are inside a single team's name: best
      score = one ? one + 1 : covers(h + ' ' + a + ' ' + other, all) ? 1 : 0;
    }
    if (score) out.push([score, m]);
  }
  return out.sort((p, q2) => q2[0] - p[0] || q2[1].ts - p[1].ts).map(x => x[1]);     // matches arrive newest first, sort() keeps that for equal scores
}

export function searchTeams(TL, q, max = 5) {
  const toks = tokens(q);
  if (!toks.length) return [];
  return TL.map(t => [covers(teamText(t), toks), t]).filter(x => x[0]).sort((a, b) => b[0] - a[0] || a[1].n.localeCompare(b[1].n)).slice(0, max).map(x => x[1]);
}
