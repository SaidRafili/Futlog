// Usage:  npm run venues:photos                 fill photos for venues that have none
//         npm run venues:photos -- --dry        only print what would be saved
//         npm run venues:photos -- --force      replace photos that are already set
//         npm run venues:photos -- --only 2267  one venue (venueid)
//
// For every row in `venues` it searches Wikipedia for the stadium, takes the lead image of the article
// (a Wikimedia Commons file) and saves its URL plus an attribution line in venues.photourl / photocredit.
// The credit is shown on the match page (Commons licences require it). CHECK THE OUTPUT: a search can
// pick the wrong article; fix a venue by hand with  UPDATE venues SET photourl='...', photocredit='...' WHERE venueid=2267;
// or put your own picture in public/venues/2267.jpg and set photourl='/venues/2267.jpg'.
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { getPoolConfig } from '../lib/dbconfig.mjs';

const UA = 'Futlog/1.0 (stadium photo importer; set your contact e-mail here)';   // Wikimedia asks for a descriptive User-Agent
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = h => String(h || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

async function api(host, params) {
  const url = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ format: 'json', ...params })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${host} returned HTTP ${res.status}`);
  return res.json();
}

// -> { url, credit, page } or null
export async function findPhoto(name) {
  const j = await api('en.wikipedia.org', {
    action: 'query', generator: 'search', gsrsearch: `${name} football stadium`, gsrlimit: '3',
    prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: '1280'
  });
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
  const hit = pages.find(p => p.thumbnail?.source && p.pageimage);
  if (!hit) return null;
  let credit = 'Wikimedia Commons';
  try {
    const c = await api('commons.wikimedia.org', { action: 'query', titles: 'File:' + hit.pageimage, prop: 'imageinfo', iiprop: 'extmetadata' });
    const meta = Object.values(c.query?.pages || {})[0]?.imageinfo?.[0]?.extmetadata || {};
    const who = strip(meta.Artist?.value), lic = strip(meta.LicenseShortName?.value);
    credit = [who, 'Wikimedia Commons', lic].filter(Boolean).join(' / ').replace(' / Wikimedia Commons / ', ' / Wikimedia Commons, ');
  } catch { /* keep the generic credit */ }
  return { url: hit.thumbnail.source, credit: credit.slice(0, 250), page: hit.title };
}

async function main() {
  const args = process.argv.slice(2), dry = args.includes('--dry'), force = args.includes('--force');
  const only = args.includes('--only') ? +args[args.indexOf('--only') + 1] : null;
  const pool = new pg.Pool(getPoolConfig());
  try {
    const { rows } = await pool.query(`SELECT venueid, fullname, photourl FROM venues ORDER BY venueid`);
    for (const v of rows) {
      if (only && v.venueid !== only) continue;
      if (v.photourl && !force && !only) { console.log(`skip   ${v.fullname} (already has a photo)`); continue; }
      let p = null;
      try { p = await findPhoto(v.fullname); } catch (e) { console.log(`ERROR  ${v.fullname}: ${e.message}`); }
      if (!p) { console.log(`none   ${v.fullname}`); await sleep(400); continue; }
      console.log(`${dry ? 'would ' : 'saved '} ${v.fullname}  <-  "${p.page}"\n         ${p.url}\n         ${p.credit}`);
      if (!dry) await pool.query(`UPDATE venues SET photourl = $1, photocredit = $2 WHERE venueid = $3`, [p.url, p.credit, v.venueid]);
      await sleep(400);
    }
  } finally { await pool.end(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
