'use client';
import { useState } from 'react';
import { photoSet } from '@/lib/photo';

// A real <img> for covers and photos (instead of a CSS background), so it has alt text, can be lazy-loaded, can be found by image search,
// and its width / height reserve the space before it loads (no layout shift).
//   * It fills the nearest positioned parent (class "ph-img": absolute, object-fit: cover). The parent keeps its gradient / placeholder
//     background, which is what you see while the picture loads or if the link is broken (a failed picture removes itself; if a resized copy fails, the original address is tried first).
//   * alt: describe the picture; alt="" only when it is purely decoration next to text that already says it.
//   * priority: for the one big picture at the top of a page (it is likely the Largest Contentful Paint element): loaded at once, high priority.
//   * sizes: how wide it is shown ("(max-width: 700px) 100vw, 400px"); only used when the file has several sizes (Wikimedia stadium photos).
// Why not next/image: article covers can be any https address, and next/image only optimises hosts listed in next.config.js, so a plain <img>
// is the safe choice; the venue photos get proper responsive sizes from lib/photo.js instead (and, once `npm run venues:optimize` has run, from our own /venues files).
export default function Photo({ src, alt = '', width, height, sizes, priority = false, className = 'ph-img', style }) {
  const [err, setErr] = useState({ src: '', n: 0 });        // n: 0 = fine, 1 = resized copy failed (use the original), 2 = give up
  const n = err.src === src ? err.n : 0;
  if (!src || n > 1) return null;
  const set = n ? { src } : photoSet(src, width);
  return (
    <img className={className} src={set.src} srcSet={set.srcSet} sizes={set.srcSet ? sizes || `${width || 640}px` : undefined}
      alt={alt} width={width} height={height} style={style}
      loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" onError={() => setErr({ src, n: set.srcSet ? n + 1 : 2 })} />
  );
}
