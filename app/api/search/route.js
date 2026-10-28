import { getSessionUser } from '@/lib/auth';
import { SEARCH_TYPES, search } from '@/lib/search';
import { dbError, json } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/search?q=bellingham&types=people,articles,posts&limit=10&offset=0&counts=posts
//   types   which kinds to return (default: all three);  counts = kinds you only want the number of hits for (the tab badges)
//   -> { q, tokens, typoTolerant, people: { items, total }, articles: { items, total }, posts: { items, total } }
// Matches (fixtures) are searched in the browser, where they are already loaded.
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const list = k => (sp.get(k) || '').split(',').map(s => s.trim()).filter(t => SEARCH_TYPES.includes(t));
  try {
    const me = await getSessionUser();
    const types = sp.has('types') ? list('types') : SEARCH_TYPES;
    return json(await search(sp.get('q') || '', { types, countOnly: list('counts'), limit: sp.get('limit'), offset: sp.get('offset'), meId: me?.user_id ?? null }));
  } catch (err) { return dbError(err); }
}
