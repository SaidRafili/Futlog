// Responsive sizes for photos. Pure functions, safe on the server and in the browser.
//
// A poster card shows a stadium photo at ~180px, a hero at ~1000px, so one big file for both wastes most of the bytes. Three kinds of address:
//   1. Wikimedia thumbnails (upload.wikimedia.org or thumb.wikimedia.org ".../thumb/a/ab/File.jpg/3840px-File.jpg", with or without a
//      "?utm_source=..." tail): the same picture is served at a fixed set of widths by changing the "3840px-" part of the name.
//   2. Wikimedia originals (".../commons/a/ab/File.jpg"): can be turned into a thumbnail address the same way.
//   3. Our own optimised copies "/venues/<name>.jpg" made by `npm run venues:optimize`: next to the .jpg sit <name>-360.webp, -720.webp, -1280.webp.
// Any other address (stadiumdb.com, article covers...) cannot be resized by URL and is used as it is. Run `npm run venues:optimize` for those.
const HOST = '(?:upload|thumb)\\.wikimedia\\.org';
const THUMB = new RegExp(`^(https://${HOST}/wikipedia/[a-z-]+/thumb/[0-9a-f]/[0-9a-f]{2}/[^/]+/)(\\d+)px-([^/?#]+)(?:[?#].*)?$`, 'i');
const ORIG = new RegExp(`^https://${HOST}/wikipedia/([a-z-]+)/([0-9a-f]/[0-9a-f]{2})/([^/?#]+\\.(?:jpe?g|png))(?:[?#].*)?$`, 'i');
const LOCAL = /^(\/venues\/[\w.-]+?)\.jpg$/i;
const WIKI_STEPS = [330, 500, 960, 1280, 1920];   // widths Wikimedia accepts (other widths are refused)
export const LOCAL_STEPS = [360, 720, 1280];      // widths written by scripts/optimize-venue-photos.mjs

// want = the width in CSS pixels the picture is shown at. -> { src, srcSet } (srcSet only when the URL can be resized)
export function photoSet(url, want = 640) {
  url = String(url || '');
  let at, steps;
  const t = THUMB.exec(url), o = t ? null : ORIG.exec(url), l = t || o ? null : LOCAL.exec(url);
  if (t) {
    const [, base, cur, name] = t;
    steps = WIKI_STEPS.filter(s => s <= +cur); at = s => `${base}${s}px-${name}`;
  } else if (o) {
    const [, proj, dir, name] = o;                 // original size unknown: stay at 1280 or below (the <img> falls back to the original on error)
    steps = WIKI_STEPS.filter(s => s <= 1280); at = s => `https://upload.wikimedia.org/wikipedia/${proj}/thumb/${dir}/${name}/${s}px-${name}`;
  } else if (l) {
    steps = LOCAL_STEPS; at = s => `${l[1]}-${s}.webp`;
  }
  if (!steps?.length) return { src: url };
  const src = steps.find(s => s >= want * 2) ?? steps[steps.length - 1];       // 2x: sharp on high-density screens
  return { src: at(src), srcSet: steps.map(s => `${at(s)} ${s}w`).join(', ') };
}
