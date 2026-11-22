'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// The site name. Between December 1 and January 6 a few of the "o"s turn into little decorated pine trees.
// To preview it any time of year, run  localStorage.setItem('futlog-xmas','1')  in the browser console (use '0' to force it off).
const WORD = ['F', 'u', 't', 'l', ...'oooooooooo', 'g'];
const TREES = new Set([4, 7, 10, 13]);       // positions in WORD (0-based) that become trees: the 1st, 4th, 7th and 10th "o"

export function isChristmas(now = new Date()) {
  try { const f = localStorage.getItem('futlog-xmas'); if (f === '1') return true; if (f === '0') return false; } catch {}
  const m = now.getMonth(), d = now.getDate();
  return m === 11 || (m === 0 && d <= 6);
}

function Tree({ n }) {
  const star = n % 2 === 0 ? '#ffd84a' : '#ffe680';
  return (
    <svg className="xt" viewBox="0 0 12 16" aria-hidden="true" focusable="false">
      <path className="star" d="M6 0l.9 1.7 1.9.3-1.4 1.3.3 1.9L6 4.3 4.3 5.2l.3-1.9L3.2 2l1.9-.3z" fill={star} />
      <path d="M6 3.2L9.3 7.6H2.7z" fill="#2f9e57" />
      <path d="M6 5.6l4 5H2z" fill="#26874a" />
      <path d="M6 8.4l5 5.4H1z" fill="#1f7340" />
      <rect x="5" y="13.8" width="2" height="2.2" fill="#7a4b2a" />
      <circle className="b1" cx="6" cy="6.6" r=".75" fill="#ff5c6c" />
      <circle className="b2" cx="4.4" cy="10.2" r=".8" fill="#ffd84a" />
      <circle className="b3" cx="7.8" cy="11.8" r=".8" fill="#7cc4ff" />
    </svg>
  );
}

export default function Logo({ className = 'logo', href = '/' }) {
  const [xmas, setXmas] = useState(false);          // plain text on the server and first paint, then the date decides
  useEffect(() => setXmas(isChristmas()), []);
  return (
    <Link className={className} href={href} aria-label="Futlog">
      {WORD.map((c, i) => xmas && TREES.has(i) ? <Tree key={i} n={i} /> : c)}
    </Link>
  );
}
