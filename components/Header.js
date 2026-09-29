'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const initial = pathname === '/search' ? (sp.get('q') || '') : '';
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);

  const submit = e => {
    e.preventDefault();
    const q = v.trim();
    if (q) router.push('/search?' + new URLSearchParams({ q }));
  };

  return (
    <form className="search" role="search" onSubmit={submit}>
      <input type="search" name="q" value={v} onChange={e => setV(e.target.value)} placeholder="Search teams, competitions, seasons" aria-label="Search matches" />
      <button type="submit" aria-label="Search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg></button>
    </form>
  );
}

export default function Header() {
  const router = useRouter();
  return (
    <header className="topbar">
      <Link className="logo" href="/">Futlooooooooooog</Link>
      <Suspense fallback={<div className="search" />}><SearchBox /></Suspense>
      <nav className="nav"><Link href="/#matches">Matches</Link><Link href="/feed">Feed</Link></nav>
      <button className="avatar-btn" aria-label="Account" onClick={() => router.push('/profile/saidrafili')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#1b1a3d"><circle cx="12" cy="8" r="4.5" /><path d="M3 21c0-5 4-7 9-7s9 2 9 7z" /></svg>
      </button>
    </header>
  );
}
