'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// The site name. From November 22 to January 11 three of the "o"s (the middle ones) turn into Christmas baubles.
// To preview it any time of year, run  localStorage.setItem('futlog-xmas','1')  in the browser console (use '0' to force it off).
const WORD = ['F', 'u', 't', 'l', ...'oooooooooo', 'g'];
const BAUBLES = { 7: 0, 8: 1, 9: 2 };         // positions in WORD (0-based) -> colour: the 4th, 5th and 6th "o", together in the middle

export function isChristmas(now = new Date()) {
  try { const f = localStorage.getItem('futlog-xmas'); if (f === '1') return true; if (f === '0') return false; } catch {}
  const m = now.getMonth(), d = now.getDate();                       // Nov 22 - Jan 11, every year
  return (m === 10 && d >= 22) || m === 11 || (m === 0 && d <= 11);
}

const COLORS = [['#ff6b6b', '#c1121f'], ['#ffd84a', '#d98e04'], ['#6cb8ff', '#1d5fd1']];   // [light, dark] of each bauble

// Same width and height as the letter "o" (.58em), so it sits in the word like a letter
function Bauble({ n }) {
  const [lt, dk] = COLORS[n], id = `xb${n}`;
  return (
    <svg className="xb" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <defs><radialGradient id={id} cx=".35" cy=".3" r=".85"><stop offset="0" stopColor={lt} /><stop offset="1" stopColor={dk} /></radialGradient></defs>
      <circle cx="10" cy="10" r="10" fill={`url(#${id})`} />
      <path d="M1.2 8.6Q10 12.4 18.8 8.6" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2 13Q10 16.6 18 13" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M7.6 0.6h4.8l-.6 2.6H8.2z" fill="#f4c542" stroke="#b8860b" strokeWidth=".5" />
      <ellipse className="shine" cx="6.2" cy="5.8" rx="2" ry="1.2" transform="rotate(-35 6.2 5.8)" fill="#fff" fillOpacity=".85" />
    </svg>
  );
}

export default function Logo({ className = 'logo', href = '/' }) {
  const [xmas, setXmas] = useState(false);          // plain text on the server and first paint, then the date decides
  useEffect(() => setXmas(isChristmas()), []);
  return (
    <Link className={className} href={href} aria-label="Futlog">
      {WORD.map((c, i) => xmas && i in BAUBLES ? <Bauble key={i} n={BAUBLES[i]} /> : c)}
    </Link>
  );
}
