'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useData } from './DataProvider';
import { Avatar } from './ui';
import { searchTeams } from '@/lib/matchsearch';
import { profileHref } from '@/lib/util';

const RECENT_KEY = 'futlog_recent_searches';
const readRecent = () => { try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string').slice(0, 6) : []; } catch { return []; } };
const writeRecent = a => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(a)); } catch { /* private mode: no history, that is fine */ } };
const href = (q, type) => '/search?' + new URLSearchParams(type ? { q, type } : { q });

// The header's search box with a live drop-down: people, articles and teams as you type, recent searches when it is empty.
// Arrow keys move through the list, Enter opens the highlighted row (or runs the search), Esc closes.
export default function SearchBox() {
  const router = useRouter(), pathname = usePathname(), sp = useSearchParams();
  const d = useData();
  const initial = pathname === '/search' ? (sp.get('q') || '') : '';
  const [v, setV] = useState(initial), [open, setOpen] = useState(false), [act, setAct] = useState(-1);
  const [remote, setRemote] = useState({ q: '', people: [], articles: [] }), [recent, setRecent] = useState([]);
  const box = useRef(null);
  useEffect(() => setV(initial), [initial]);

  const q = v.trim();
  useEffect(() => {                                 // ask the server 200 ms after you stop typing; older answers are thrown away
    if (!q) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch('/api/search/suggest?q=' + encodeURIComponent(q), { signal: ctl.signal, cache: 'no-store' })
        .then(r => r.ok ? r.json() : null).then(j => { if (j) setRemote({ q, people: j.people, articles: j.articles }); }).catch(() => {});
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const off = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);

  const teams = useMemo(() => d.status === 'ready' && q ? searchTeams(d.TL, q, 3) : [], [d.status, d.TL, q]);
  const fresh = remote.q === q;                      // do the server rows belong to what is typed now?
  const rows = useMemo(() => {
    if (!q) return recent.map(r => ({ key: 'r' + r, group: 'Recent searches', href: href(r), label: r, kind: 'recent' }));
    return [
      ...teams.map(t => ({ key: 't' + t.id, group: 'Teams', href: href(t.n, 'matches'), label: t.n, kind: 'team', t })),
      ...(fresh ? remote.people.map(p => ({ key: 'p' + p.handle, group: 'People', href: profileHref(p.handle), label: p.name, sub: '@' + p.handle, kind: 'person', p })) : []),
      ...(fresh ? remote.articles.map(a => ({ key: 'a' + a.id, group: 'Articles', href: `/article/${a.id}`, label: a.title, sub: `${a.category} · ${a.author}`, kind: 'article' })) : []),
    ];
  }, [q, recent, teams, remote, fresh]);
  useEffect(() => setAct(-1), [rows.length, q]);

  const remember = s => { const a = [s, ...readRecent().filter(x => x.toLowerCase() !== s.toLowerCase())].slice(0, 6); writeRecent(a); setRecent(a); };
  const go = (to, remembered) => { if (remembered) remember(remembered); setOpen(false); router.push(to); };
  const submit = e => { e.preventDefault(); if (act >= 0 && rows[act]) { go(rows[act].href, rows[act].kind === 'recent' ? rows[act].label : ''); return; } if (q) go(href(q), q); };
  const key = e => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return; }
    if (e.key === 'ArrowDown' && rows.length) { e.preventDefault(); setAct(a => (a + 1) % rows.length); }
    if (e.key === 'ArrowUp' && rows.length) { e.preventDefault(); setAct(a => (a <= 0 ? rows.length : a) - 1); }
  };

  const show = open && (rows.length > 0 || q);
  let last = '';
  return (
    <form className="search" role="search" onSubmit={submit} ref={box}>
      <input type="search" name="q" value={v} autoComplete="off" spellCheck="false" placeholder="Search matches, people, articles"
        aria-label="Search Futlog" role="combobox" aria-expanded={!!show} aria-controls="sb-list" aria-autocomplete="list" aria-activedescendant={act >= 0 ? 'sb-' + act : undefined}
        onChange={e => { setV(e.target.value); setOpen(true); }} onFocus={() => { setRecent(readRecent()); setOpen(true); }} onKeyDown={key} />
      <button type="submit" aria-label="Search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg></button>
      {show && (
        <div className="sb-pop" id="sb-list" role="listbox" onMouseDown={e => e.preventDefault()}>
          {q && <Link role="option" id="sb-all" aria-selected={false} className="sb-row sb-all" href={href(q)} onClick={e => { e.preventDefault(); go(href(q), q); }}><span className="sb-ico">⌕</span><span>Search for <b>“{q}”</b></span></Link>}
          {rows.map((r, i) => {
            const head = r.group !== last ? (last = r.group) : null;
            return (
              <div key={r.key}>
                {head && <div className="sb-head">{head}</div>}
                <Link role="option" id={'sb-' + i} aria-selected={act === i} className={`sb-row${act === i ? ' on' : ''}`} href={r.href} onClick={e => { e.preventDefault(); go(r.href, r.kind === 'recent' ? r.label : q); }} onMouseEnter={() => setAct(i)}>
                  {r.kind === 'person' ? <Avatar name={r.p.name} src={r.p.avatar} className="sb-av" size={28} />
                    : <span className="sb-ico">{r.kind === 'team' ? '⚽' : r.kind === 'article' ? '✎' : '↺'}</span>}
                  <span className="sb-t"><b>{r.label}</b>{r.sub && <small>{r.sub}</small>}</span>
                </Link>
              </div>
            );
          })}
          {q && !fresh && <div className="sb-note">Searching…</div>}
        </div>
      )}
    </form>
  );
}
