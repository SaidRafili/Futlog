'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// The pictures of a post, laid out like Twitter: 1 = one wide picture, 2 = side by side, 3 = one tall + two small, 4 = a 2x2 grid.
// Clicking a picture opens it full size in a lightbox (arrow keys / swipe buttons to move, Esc to close).
export function PostImages({ images }) {
  const [open, setOpen] = useState(-1);
  if (!images?.length) return null;
  const one = images[0], ratio = one.w && one.h ? Math.min(Math.max(one.w / one.h, 0.8), 2) : 1.6;
  return (
    <>
      <div className={`pm pm-${images.length}`} style={images.length === 1 ? { aspectRatio: ratio } : undefined}>
        {images.map((im, i) => (
          <button key={im.id} type="button" className="pm-i" onClick={() => setOpen(i)} aria-label={im.alt ? `Open picture: ${im.alt}` : `Open picture ${i + 1} of ${images.length}`}>
            <img src={im.url} alt={im.alt || ''} loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      {open >= 0 && <Lightbox images={images} start={open} onClose={() => setOpen(-1)} />}
    </>
  );
}

function Lightbox({ images, start, onClose }) {
  const [i, setI] = useState(start), box = useRef(null);
  const n = images.length, go = useCallback(d => setI(x => (x + d + n) % n), [n]);
  useEffect(() => {
    const prev = document.activeElement, scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; box.current?.focus();
    const key = e => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && n > 1) go(1);
      else if (e.key === 'ArrowLeft' && n > 1) go(-1);
      else if (e.key === 'Tab') { e.preventDefault(); box.current?.focus(); }     // the page behind stays out of reach
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = scroll; prev?.focus?.(); };
  }, [go, n, onClose]);
  const im = images[i];
  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label="Picture viewer" ref={box} tabIndex={-1} onClick={onClose}>
      <button className="lb-x" onClick={onClose} aria-label="Close">✕</button>
      {n > 1 && <button className="lb-n prev" onClick={e => { e.stopPropagation(); go(-1); }} aria-label="Previous picture">‹</button>}
      <figure onClick={e => e.stopPropagation()}>
        <img src={im.url} alt={im.alt || ''} />
        {(im.alt || n > 1) && <figcaption>{im.alt}{n > 1 ? <small>{i + 1} / {n}</small> : null}</figcaption>}
      </figure>
      {n > 1 && <button className="lb-n next" onClick={e => { e.stopPropagation(); go(1); }} aria-label="Next picture">›</button>}
    </div>
  );
}
