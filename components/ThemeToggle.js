'use client';
import { useEffect, useState } from 'react';

// Dark / light switch. The choice is kept in localStorage; the first visit is always light.
// The class is applied before the first paint by the small script in app/layout.js, so there is no flash.
const ICON = {
  dark: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>,
  light: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
};

export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'light' ? '#ece9f8' : '#0b0b19');
}

export default function ThemeToggle() {
  const [t, setT] = useState(null);                  // unknown until mounted (the server cannot know)
  useEffect(() => setT(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'), []);
  const pick = v => { setT(v); applyTheme(v); try { localStorage.setItem('futlog-theme', v); } catch {} };
  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      {['dark', 'light'].map(v => (
        <button key={v} type="button" aria-pressed={t === v} onClick={() => pick(v)}>{ICON[v]}{v === 'dark' ? 'Dark' : 'Light'}</button>
      ))}
    </div>
  );
}
