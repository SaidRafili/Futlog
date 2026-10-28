// Server-only: the search engine behind /api/search and the header's live suggestions.
//
// How a result is ranked: every word you type ("token") must match somewhere in the thing (all words = AND).
// A word scores by how well it matches a field:  exact 100 > starts-with 80 > starts a word 60 > appears inside 35 > typo-close 25 (pg_trgm),
// multiplied by how important the field is (a person's @handle or name, an article's title ... count more than a bio or the article text).
// Accents and capital letters never matter. Ties go to the more popular / newer result.
import { query } from './db';
import { POST_SELECT, person, postOut } from './content';
import { fold, tokens as splitTokens, SQL_FROM, SQL_TO } from './fold';

const F = x => `translate(lower(${x}), '${SQL_FROM}', '${SQL_TO}')`;                           // accent-free lower case, same length as the original
const WORDS = x => `(' ' || translate(${x}, '._-/:,;()', '         '))`;                       // ' real madrid fan ' -> a word start is ' ' + token

// pg_trgm adds typo tolerance. Remember whether it exists (re-check once a minute while it does not).
let trgm = { v: false, at: 0 };
async function hasTrgm() {
  if (trgm.v || Date.now() - trgm.at < 60_000) return trgm.v;
  try { trgm = { v: (await query(`SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'`)).rowCount > 0, at: Date.now() }; }
  catch { trgm = { v: false, at: Date.now() }; }
  return trgm.v;
}

// one token against one (already folded) column -> a score expression
// fuzzy = null (no typo matching for this word) or the similarity a field needs to count as "close enough"
const fieldScore = (col, w, mode, tk, fuzzy) => mode === 'light'
  ? `(CASE WHEN strpos(${col}, ${tk}) > 0 THEN ${35 * w} ELSE 0 END)`
  : `(${w} * CASE
        WHEN ${col} = ${tk} THEN 100
        WHEN left(${col}, char_length(${tk})) = ${tk} THEN 80
        WHEN strpos(${WORDS(col)}, ' ' || ${tk}) > 0 THEN 60
        WHEN strpos(${col}, ${tk}) > 0 THEN 35
        ${fuzzy ? `WHEN word_similarity(${tk}, ${col}) >= ${fuzzy} THEN 25 * word_similarity(${tk}, ${col})` : ''}
        ELSE 0 END)`;

// What can be searched. `fields` = [folded column, weight, 'full' | 'light'];  `light` fields only count when the word appears inside them.
const SPECS = {
  people: {
    from: `users u CROSS JOIN LATERAL (SELECT ${F('u.handle')} AS h, ${F('u.display_name')} AS n, ${F(`coalesce(u.bio, '')`)} AS b, ${F(`coalesce(u.location, '')`)} AS l) f`,
    fields: [['f.h', 1.0, 'full'], ['f.n', 1.0, 'full'], ['f.b', 0.3, 'light'], ['f.l', 0.3, 'light']],
    boost: `(CASE WHEN u.is_author THEN 3 ELSE 0 END + LEAST((SELECT count(*) FROM follows x WHERE x.followee_id = u.user_id), 30) * 0.2)`,
    cols: `u.user_id, u.handle, u.display_name, u.bio, u.location, u.avatar_url, u.updated_at AS u_updated, u.is_author, u.favourite_team_id,
            (SELECT count(*)::int FROM follows x WHERE x.followee_id = u.user_id) AS followers`,
    order: 'u.created_at DESC', plain: true,
  },
  articles: {
    from: `articles a JOIN users u ON u.user_id = a.author_id CROSS JOIN LATERAL (SELECT ${F('a.title')} AS t, ${F('a.category')} AS c, ${F('u.display_name')} AS an, ${F('u.handle')} AS ah,
             array_to_string(a.body, ' ') AS raw, ${F(`array_to_string(a.body, ' ')`)} AS b) f`,
    where: `a.status = 'published'`,
    fields: [['f.t', 1.0, 'full'], ['f.c', 0.6, 'full'], ['f.an', 0.6, 'full'], ['f.ah', 0.5, 'full'], ['f.b', 0.35, 'light']],
    boost: `LEAST((SELECT count(*) FROM likes l WHERE l.target_type = 'article' AND l.target_id = a.article_id), 20) * 0.3`,
    cols: `a.article_id, a.title, a.category, a.read_minutes, a.cover_image_url, a.published_at,
           u.handle, u.display_name, u.avatar_url, u.updated_at AS u_updated,
           (SELECT count(*)::int FROM likes l WHERE l.target_type = 'article' AND l.target_id = a.article_id) AS likes,
           (SELECT count(*)::int FROM comments c WHERE c.target_type = 'article' AND c.target_id = a.article_id) AS comments`,
    snippet: tks => `${tks.length ? `CASE ${tks.map(t => `WHEN strpos(f.b, ${t}) > 0 THEN substr(f.raw, greatest(strpos(f.b, ${t}) - 70, 1), 190)`).join(' ')} ELSE left(f.raw, 190) END` : 'left(f.raw, 190)'} AS snippet`,
    order: 'a.published_at DESC', plain: true,
  },
  posts: {
    from: `posts p JOIN users u ON u.user_id = p.user_id CROSS JOIN LATERAL (SELECT ${F('p.body')} AS b, ${F('u.handle')} AS ah, ${F('u.display_name')} AS an) f`,
    fields: [['f.b', 1.0, 'full'], ['f.ah', 0.5, 'full'], ['f.an', 0.5, 'full']],
    boost: `LEAST((SELECT count(*) FROM likes l WHERE l.target_type = 'post' AND l.target_id = p.post_id), 20) * 0.3`,
    cols: 'p.post_id',
    order: 'p.created_at DESC', plain: false,           // posts keep #hashtags and @mentions in the query
  },
};

// Builds { sql, countSql, args } for one type.
function build(type, toks, fuzzy, { limit, offset }) {
  const s = SPECS[type];
  const words = s.plain ? toks.map(t => t.replace(/^[#@]+/, '')).filter(Boolean) : toks;
  const args = words, ref = i => `$${i + 1}::text`;
  // typo tolerance only for words of 4+ letters (shorter words would match almost anything); longer words may differ a little more
  const need = w => { const n = w.replace(/^[#@]+/, '').length; return !fuzzy || n < 4 ? null : n <= 5 ? 0.5 : n === 6 ? 0.45 : 0.4; };
  const perToken = words.map((w, i) => `GREATEST(${s.fields.map(([c, wt, m]) => fieldScore(c, wt, m, ref(i), need(w))).join(', ')})`);
  const where = [s.where, ...perToken.map(e => `${e} > 0`)].filter(Boolean).join(' AND ') || 'TRUE';
  const score = perToken.length ? `(${perToken.join(' + ')} + ${s.boost})` : '0';
  const snippet = s.snippet ? ', ' + s.snippet(words.map((_, i) => ref(i))) : '';
  return {
    sql: `SELECT ${s.cols}${snippet}, ${score} AS score FROM ${s.from} WHERE ${where} ORDER BY score DESC, ${s.order} LIMIT ${limit} OFFSET ${offset}`,
    countSql: `SELECT count(*)::int AS n FROM ${s.from} WHERE ${where}`,
    args,
  };
}

const bounded = (v, d, lo, hi) => Math.min(Math.max(parseInt(v) || d, lo), hi);
export const SEARCH_TYPES = ['people', 'articles', 'posts'];

const outPerson = r => ({ ...person(r), bio: r.bio || '', location: r.location || '', followers: r.followers, isAuthor: r.is_author, favTeamId: r.favourite_team_id });
const outArticle = r => ({
  id: Number(r.article_id), title: r.title, category: r.category, readMinutes: r.read_minutes, cover: r.cover_image_url, publishedAt: r.published_at,
  likes: r.likes, comments: r.comments, snippet: String(r.snippet || '').replace(/\s+/g, ' ').trim(), author: person(r),
});

// search(q, { types: ['people', ...], limit, offset, meId, countOnly: ['posts', ...] })
//   -> { q, tokens, typoTolerant, people: { items, total }, articles: {...}, posts: {...} }   (only the requested types; countOnly ones have items: [])
export async function search(q, { types = SEARCH_TYPES, limit = 10, offset = 0, meId = null, countOnly = [] } = {}) {
  const toks = splitTokens(String(q ?? '').slice(0, 200)), fuzzy = await hasTrgm();
  limit = bounded(limit, 10, 1, 50); offset = bounded(offset, 0, 0, 5000);
  const out = { q: String(q ?? ''), tokens: toks, typoTolerant: fuzzy };
  await Promise.all([...new Set([...types, ...countOnly])].filter(t => SPECS[t]).map(async type => {
    const only = !types.includes(type);
    const b = build(type, toks, fuzzy, { limit: only ? 1 : limit, offset: only ? 0 : offset });
    const [total, rows] = await Promise.all([query(b.countSql, b.args), only ? { rows: [] } : query(b.sql, b.args)]);
    let items = [];
    if (type === 'people') items = rows.rows.map(outPerson);
    else if (type === 'articles') items = rows.rows.map(outArticle);
    else if (rows.rows.length) {
      const ids = rows.rows.map(r => r.post_id);
      const full = (await query(`${POST_SELECT} WHERE p.post_id = ANY($2::bigint[])`, [meId, ids])).rows;
      const by = new Map(full.map(r => [String(r.post_id), r]));
      items = ids.map(id => by.get(String(id))).filter(Boolean).map(r => postOut(r, meId));
    }
    out[type] = { items, total: total.rows[0].n };
  }));
  return out;
}
