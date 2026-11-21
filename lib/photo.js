// Responsive sizes for photos. Pure functions, safe on the server and in the browser.
//
// The stadium photos come from Wikimedia Commons as 1280px thumbnails (scripts/fetch-venue-photos.mjs), but a poster card shows them
// at ~150px. Wikimedia serves the same picture at a fixed set of widths by changing the "1280px-" part of the file name, so a small card
// can load a 330px copy and a big hero a 960px one, with no image proxy involved. Any other URL (article covers can be any https link)
// is used as it is.
const WIKI = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[a-z-]+\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/[^/]+\/)(\d+)px-([^/?#]+)$/i;
const STEPS = [330, 500, 960, 1280, 1920];       // widths Wikimedia accepts (other widths are refused)

// want = the width in CSS pixels the picture is shown at. -> { src, srcSet } (srcSet only when the URL can be resized)
export function photoSet(url, want = 640) {
  const m = WIKI.exec(String(url || ''));
  if (!m) return { src: url };
  const [, base, cur, name] = m, max = +cur;
  const steps = STEPS.filter(s => s <= max);
  if (!steps.length) return { src: url };
  const at = s => `${base}${s}px-${name}`;
  const src = steps.find(s => s >= want * 2) ?? steps[steps.length - 1];       // 2x: sharp on high-density screens
  return { src: at(src), srcSet: steps.map(s => `${at(s)} ${s}w`).join(', ') };
}
