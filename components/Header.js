'use client';
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useData } from './DataProvider';

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
  const { me, meReady, openAuth, signOut } = useData();
  const [menu, setMenu] = useState(false);
  const box = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!menu) return;
    const off = e => { if (!box.current?.contains(e.target)) setMenu(false); };
    const esc = e => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [menu]);

  return (
    <header className="topbar">
      <Link className="logo" href="/">Futlooooooooooog</Link>
      <Suspense fallback={<div className="search" />}><SearchBox /></Suspense>
      <nav className="nav"><Link href="/#matches">Matches</Link><Link href="/feed">Feed</Link><Link href="/write">Write</Link></nav>
      {!meReady ? <span className="avatar-btn ph" aria-hidden="true" /> : me ? (
        <div className="acct" ref={box}>
          <button className="avatar-btn" aria-label="Account menu" aria-haspopup="menu" aria-expanded={menu} title={me.name} onClick={() => setMenu(m => !m)}>
            {me.avatar
              ? <img src={me.avatar} alt="" />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="#1b1a3d"><circle cx="12" cy="8" r="4.5" /><path d="M3 21c0-5 4-7 9-7s9 2 9 7z" /></svg>}
          </button>
          {menu && (
            <div className="acct-menu" role="menu">
              <div className="acct-who"><b>{me.name}</b><small>@{me.handle}</small></div>
              <Link role="menuitem" href={`/profile/${me.handle}`} onClick={() => setMenu(false)}>Your profile</Link>
              <Link role="menuitem" href="/write" onClick={() => setMenu(false)}>Write an article</Link>
              <Link role="menuitem" href={`/profile/${me.handle}?tab=articles`} onClick={() => setMenu(false)}>Your articles</Link>
              <Link role="menuitem" href={`/profile/${me.handle}?tab=saved`} onClick={() => setMenu(false)}>Saved articles</Link>
              <Link role="menuitem" href="/settings" onClick={() => setMenu(false)}>Settings</Link>
              <button role="menuitem" onClick={async () => { setMenu(false); await signOut(); router.refresh(); }}>Sign out</button>
            </div>
          )}
        </div>
      ) : (
        <button className="signin-btn" onClick={() => openAuth('signin')}>Sign in</button>
      )}
    </header>
  );
}
