// Search helpers shared by the browser and the server.
// fold() lower-cases and strips accents ("Bellíngham" -> "bellingham") WITHOUT changing the length of the text, so a position found in the
// folded text is the same position in the original (that is how matches get highlighted). SQL_FROM / SQL_TO is the same mapping for
// Postgres' translate(), so "Müller" typed as "muller" matches in the database too.
const EXTRA = { 'đ': 'd', 'ð': 'd', 'ł': 'l', 'ø': 'o', 'ı': 'i', 'ß': 's', 'æ': 'a', 'œ': 'o', 'þ': 't', 'ħ': 'h' };

const one = c => {
  const l = c.toLowerCase();
  if (EXTRA[l]) return EXTRA[l];
  const d = l.normalize('NFD')[0];
  return d.length === 1 ? d : l[0];
};

export const SQL_FROM = 'àáâãäåāăąçćčďèéêëēėęěğìíîïīįłñńňòóôõöōőřśşšșťțùúûüūůűųýÿźżžđðøıßæœþħ';
export const SQL_TO = [...SQL_FROM].map(one).join('');

export function fold(s) {
  let out = '';
  for (const c of String(s ?? '')) out += c.length === 1 ? one(c) : c;   // astral characters (emoji) are kept as they are
  return out;
}

// "Real  Madrid, 2023" -> ['real', 'madrid', '2023'];  '#UCL' keeps its #, '@bob' is kept as '@bob'
export function tokens(q, max = 6) {
  return [...new Set(fold(q).split(/[^\p{L}\p{N}#@._]+/u).map(t => t.replace(/^[._]+|[._]+$/g, '')).filter(t => t.length > 0 && t !== '#' && t !== '@'))].slice(0, max);
}

// Splits `text` into [{ t, hit }] pieces so the matched words can be wrapped in <mark>.
export function highlightParts(text, toks) {
  const s = String(text ?? ''), f = fold(s), hits = [];
  for (const t of toks) {
    const w = t.replace(/^[#@]/, '');
    if (w.length < 1) continue;
    let i = 0; while ((i = f.indexOf(w, i)) !== -1) { hits.push([i, i + w.length]); i += w.length; }
  }
  hits.sort((a, b) => a[0] - b[0]);
  const parts = []; let pos = 0;
  for (const [a, b] of hits) {
    if (b <= pos) continue;
    const from = Math.max(a, pos);
    if (from > pos) parts.push({ t: s.slice(pos, from), hit: false });
    parts.push({ t: s.slice(from, b), hit: true }); pos = b;
  }
  if (pos < s.length) parts.push({ t: s.slice(pos), hit: false });
  return parts;
}
