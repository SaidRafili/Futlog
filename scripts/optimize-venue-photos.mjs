// Usage:  npm run venues:optimize                 download + shrink every venue photo that still points to another website
//         npm run venues:optimize -- --dry        only list what would be done
//         npm run venues:optimize -- --only 2267  one venue (venueid)
//
// Why: the photos in `venues.photourl` are full-size files on other sites (some 3840px wide, 1 to 5 MB each) shown in ~180px cards.
// For every venue this script downloads the picture ONCE and writes, into public/venues/:
//     <id>-<hash>.jpg          1280px JPEG   (the address stored in the database, used by share cards and as a fallback)
//     <id>-<hash>-360.webp     small card, 1x/2x screens        (WebP is ~30% smaller than JPEG at the same quality)
//     <id>-<hash>-720.webp     bigger cards / phones in portrait
//     <id>-<hash>-1280.webp    match page hero
// then sets venues.photourl to '/venues/<id>-<hash>.jpg'. lib/photo.js turns that into a srcset, so every screen loads the smallest
// file that still looks sharp. The hash is of the file's content, so the files are cached for a year (next.config.js) and a new photo
// gets a new address. The original address is kept in public/venues/manifest.json (and nothing is touched if a download fails).
// Needs:  npm install   (sharp is a devDependency)
//
// LICENCE: Wikimedia Commons pictures may be copied if the credit stays (venues.photocredit, shown on the match page).
// stadiumdb.com pictures are NOT freely licensed: only copy them if you have permission, otherwise replace them with Commons
// photos (npm run venues:photos -- --force --only <id>) before running this.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { getPoolConfig } from '../lib/dbconfig.mjs';

const UA = 'Futlog/1.0 (stadium photo optimiser; set your contact e-mail here)';
const OUT = new URL('../public/venues/', import.meta.url);
const WIDTHS = [360, 720, 1280];
const MAX_BYTES = 40_000_000, TIMEOUT_MS = 30_000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Pure: image bytes -> { hash, files: { [file name]: Buffer } } for one venue. Throws if the bytes are not a usable picture.
export async function makeVariants(buf, id) {
  const img = sharp(buf, { failOn: 'error', limitInputPixels: 120_000_000 }).rotate();     // rotate(): respect the camera's orientation tag
  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height || meta.width < 200) throw new Error('picture is missing or too small');
  const hero = await img.clone().resize({ width: 1280, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  const hash = crypto.createHash('sha1').update(hero).digest('hex').slice(0, 8);
  const base = `${id}-${hash}`, files = { [`${base}.jpg`]: hero };
  for (const w of WIDTHS) files[`${base}-${w}.webp`] = await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }).toBuffer();
  return { hash, base, files, width: meta.width, height: meta.height };
}

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = +res.headers.get('content-length') || 0;
  if (len > MAX_BYTES) throw new Error(`file is ${(len / 1e6).toFixed(0)} MB`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('file is too large');
  return buf;
}

const kb = n => `${Math.round(n / 1024)} KB`;

async function main() {
  const args = process.argv.slice(2), dry = args.includes('--dry');
  const only = args.includes('--only') ? +args[args.indexOf('--only') + 1] : null;
  await fs.mkdir(OUT, { recursive: true });
  const manifestFile = new URL('manifest.json', OUT);
  const manifest = await fs.readFile(manifestFile, 'utf8').then(JSON.parse).catch(() => ({}));
  const pool = new pg.Pool(getPoolConfig());
  let done = 0, failed = 0, before = 0, after = 0;
  try {
    const { rows } = await pool.query(`SELECT venueid, fullname, photourl FROM venues WHERE photourl <> '' ORDER BY venueid`);
    for (const v of rows) {
      if (only && v.venueid !== only) continue;
      if (!/^https:\/\//i.test(v.photourl)) { console.log(`skip   ${v.fullname} (already ${v.photourl})`); continue; }
      try {
        const buf = await download(v.photourl);
        const out = await makeVariants(buf, v.venueid);
        const size = Object.values(out.files).reduce((n, b) => n + b.length, 0), shown = out.files[`${out.base}-720.webp`].length;
        console.log(`${dry ? 'would ' : 'saved '} ${v.fullname}: ${kb(buf.length)} (${out.width}px) -> ${kb(out.files[`${out.base}-360.webp`].length)} card / ${kb(shown)} / ${kb(out.files[`${out.base}-1280.webp`].length)} hero`);
        before += buf.length; after += out.files[`${out.base}-360.webp`].length; done++;
        if (!dry) {
          for (const [name, data] of Object.entries(out.files)) await fs.writeFile(new URL(name, OUT), data);
          manifest[v.venueid] = { source: v.photourl, file: `${out.base}.jpg`, bytes: size };
          await pool.query(`UPDATE venues SET photourl = $1 WHERE venueid = $2`, [`/venues/${out.base}.jpg`, v.venueid]);
          await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
        }
      } catch (e) { failed++; console.log(`FAILED ${v.fullname}: ${e.message} (left as it was)`); }
      await sleep(300);                                  // be polite to the image hosts
    }
  } finally { await pool.end(); }
  console.log(`\n${done} done, ${failed} failed. Card image size: ${kb(before)} originals -> ${kb(after)} (${before ? Math.round(100 - after / before * 100) : 0}% smaller).`);
  if (!dry && done) console.log('Commit public/venues/ and deploy. Venue data is read from the database, so no code change is needed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
