import { search } from '@/lib/search';
import { dbError, json } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/search/suggest?q=bel   -> a few people and articles for the header's drop-down (nothing for an empty query)
export async function GET(req) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (!q) return json({ people: [], articles: [] });
  try {
    const r = await search(q, { types: ['people', 'articles'], limit: 4 });
    return json({
      people: r.people.items.map(p => ({ handle: p.handle, name: p.name, avatar: p.avatar, bio: p.bio })),
      articles: r.articles.items.map(a => ({ id: a.id, title: a.title, category: a.category, author: a.author.name })),
    });
  } catch (err) { return dbError(err); }
}
