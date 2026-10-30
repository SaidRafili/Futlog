import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { MAX_AVATAR, MAX_BANNER, authorize, checkImage, cleanHandle, dbError, fail, findUser, imageSrc, json, liteFor, publicUser, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 1000;

// GET /api/users/:handle            -> profile, counts, every list the profile tabs need, and recent activity
// GET /api/users/:handle?lite=1     -> profile + the ids the header / match page need (no lists, no activity)
export async function GET(req, { params }) {
  const handle = cleanHandle((await params).handle);
  if (!handle) return fail(404, 'No such user');
  const lite = new URL(req.url).searchParams.get('lite') === '1';
  try {
    const u = await findUser(handle);
    if (!u) return fail(404, 'No such user');
    if (lite) return json(await liteFor(u));
    const id = u.user_id;
    const viewer = await getSessionUser(), isOwner = !!viewer && String(viewer.user_id) === String(id);

    const marks = await query(
      `SELECT kind, match_id AS id, created_at AS at FROM user_matches WHERE user_id = $1 ORDER BY created_at DESC LIMIT ${LIMIT * 3}`, [id]);
    const by = k => marks.rows.filter(r => r.kind === k).map(r => ({ id: r.id, at: r.at }));
    const following = await query(
      `SELECT u.handle, u.display_name AS name, u.avatar_url, u.updated_at FROM follows f JOIN users u ON u.user_id = f.followee_id
        WHERE f.follower_id = $1 ORDER BY f.created_at DESC LIMIT ${LIMIT}`, [id]);
    const person = r => ({ handle: r.handle, name: r.name, avatar: imageSrc(r.handle, 'avatar', r.avatar_url, r.updated_at) });


    const [followers, reviews, articles, activity, counts, saved] = await Promise.all([
      query(`SELECT u.handle, u.display_name AS name, u.avatar_url, u.updated_at FROM follows f JOIN users u ON u.user_id = f.follower_id
              WHERE f.followee_id = $1 ORDER BY f.created_at DESC LIMIT ${LIMIT}`, [id]),
      query(`SELECT review_id AS id, match_id, title, rating, created_at AS at FROM reviews WHERE user_id = $1 ORDER BY created_at DESC LIMIT ${LIMIT}`, [id]),
      // the owner also sees their drafts
      query(`SELECT article_id AS id, title, category, read_minutes, status, COALESCE(published_at, updated_at) AS at,
                    (SELECT count(*)::int FROM likes l WHERE l.target_type = 'article' AND l.target_id = article_id) AS likes
               FROM articles WHERE author_id = $1 AND (status = 'published' OR $2::boolean) ORDER BY COALESCE(published_at, updated_at) DESC LIMIT ${LIMIT}`, [id, isOwner]),
      query(`SELECT a.type, a.match_id, a.ref_id, a.title, a.rating, a.created_at AS at, t.handle AS target_handle, t.display_name AS target_name
               FROM user_activity a LEFT JOIN users t ON t.user_id = a.target_user_id
              WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT 60`, [id]),
      query(`SELECT (SELECT count(*)::int FROM follows WHERE followee_id = $1) AS followers,
                    (SELECT count(*)::int FROM follows WHERE follower_id = $1) AS following,
                    (SELECT count(*)::int FROM comments WHERE user_id = $1) AS comments,
                    (SELECT count(*)::int FROM posts WHERE user_id = $1) AS posts,
                    (SELECT count(*)::int FROM likes WHERE user_id = $1) AS likes`, [id]),
      // bookmarks are private: only the owner gets them
      isOwner
        ? query(`SELECT a.article_id AS id, a.title, a.category, a.read_minutes, s.created_at AS at, u.handle AS author_handle, u.display_name AS author_name
                   FROM article_saves s JOIN articles a ON a.article_id = s.article_id AND a.status = 'published' JOIN users u ON u.user_id = a.author_id
                  WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT ${LIMIT}`, [id])
        : Promise.resolve({ rows: [] }),
    ]);

    return json({
      user: publicUser(u),
      counts: { ...counts.rows[0], watched: by('watched').length, liked: by('liked').length, onsite: by('onsite').length, reviews: reviews.rowCount, articles: articles.rows.filter(r => r.status === 'published').length },
      watched: by('watched'), liked: by('liked'), onsite: by('onsite'),
      reviews: reviews.rows.map(r => ({ id: r.id, matchId: r.match_id, title: r.title, rating: r.rating, at: r.at })),
      followers: followers.rows.map(person), following: following.rows.map(person),
      articles: articles.rows.map(r => ({ id: r.id, title: r.title, category: r.category, readMinutes: r.read_minutes, at: r.at, status: r.status, likes: r.likes })),
      saved: saved.rows.map(r => ({ id: r.id, title: r.title, category: r.category, readMinutes: r.read_minutes, at: r.at, authorHandle: r.author_handle, authorName: r.author_name })),
      activity: activity.rows.map(r => ({ type: r.type, matchId: r.match_id, refId: r.ref_id, title: r.title, rating: r.rating, at: r.at, handle: r.target_handle, name: r.target_name })),
    });
  } catch (err) { return dbError(err); }
}

// PUT /api/users/:handle   body: { name, bio, location, favTeamId, avatar, banner, bannerHue }
// Any field left out is unchanged; avatar/banner = null removes the image. Only the signed-in owner may do this.
export async function PUT(req, { params }) {
  const handle = cleanHandle((await params).handle);
  if (!handle) return fail(404, 'No such user');
  const auth = await authorize(req, handle); if (auth.res) return auth.res;
  const b = await readBody(req);
  if (!b) return fail(400, 'Send a JSON body');

  const sets = [], vals = [];
  const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  const errors = {};

  if (b.name !== undefined) {
    const n = String(b.name ?? '').trim();
    if (!n || n.length > 100) errors.name = 'Name is required (max 100 characters)'; else set('display_name', n);
  }
  if (b.bio !== undefined) { const v = String(b.bio ?? '').trim(); v.length > 500 ? errors.bio = 'Bio is limited to 500 characters' : set('bio', v || null); }
  if (b.location !== undefined) { const v = String(b.location ?? '').trim(); v.length > 100 ? errors.location = 'Location is limited to 100 characters' : set('location', v || null); }
  if (b.favTeamId !== undefined) {
    const v = b.favTeamId === null || b.favTeamId === '' ? null : Number(b.favTeamId);
    Number.isInteger(v) || v === null ? set('favourite_team_id', v) : errors.favTeamId = 'Unknown team';
  }
  if (b.bannerHue !== undefined) {
    const v = b.bannerHue === null ? null : Number(b.bannerHue);
    v === null || (Number.isInteger(v) && v >= 0 && v < 360) ? set('banner_hue', v) : errors.bannerHue = 'Hue must be 0-359';
  }
  for (const [key, col, max] of [['avatar', 'avatar_url', MAX_AVATAR], ['banner', 'banner_url', MAX_BANNER]]) {
    const r = checkImage(b[key], max);
    if (r.error) errors[key] = `Image ${r.error}`; else if (!r.skip) set(col, r.value);
  }
  if (Object.keys(errors).length) return fail(400, 'Some fields are invalid', { fields: errors });

  try {
    if (sets.length) {
      vals.push(handle);
      try { await query(`UPDATE users SET ${sets.join(', ')} WHERE handle = $${vals.length}`, vals); }
      catch (err) { if (err.code === '23503') return fail(400, 'Some fields are invalid', { fields: { favTeamId: 'Unknown team' } }); throw err; }
    }
    const u = await findUser(handle);
    return json({ user: publicUser(u) });
  } catch (err) { return dbError(err); }
}
