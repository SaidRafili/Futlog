'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../DataProvider';
import MatchCard from '../MatchCard';
import PostCard from '../PostCard';
import { Avatar, FollowButton } from '../ui';
import { highlightParts, tokens } from '@/lib/fold';
import { searchMatches } from '@/lib/matchsearch';
import { fmt, profileHref, shortDate, uniq } from '@/lib/util';

const CAP = 120, PAGE = 20, PREVIEW = 4;
const TABS = [['all', 'All'], ['matches', 'Matches'], ['articles', 'Articles'], ['people', 'People'], ['posts', 'Posts']];
const REMOTE = ['people', 'articles', 'posts'];

const Mark = ({ text, words }) => words.length ? highlightParts(text, words).map((p, i) => p.hit ? <mark key={i}>{p.t}</mark> : p.t) : text;

function PersonRow({ p, words }) {
  const { me } = useData();
  return (
    <div className="sr-person">
      <Link href={profileHref(p.handle)} className="sr-pl">
        <Avatar name={p.name} src={p.avatar} className="sr-av" size={48} />
        <span>
          <b><Mark text={p.name} words={words} /></b>
          <small>@<Mark text={p.handle} words={words} />{p.isAuthor ? ' · Author' : ''} · {fmt(p.followers)} follower{p.followers === 1 ? '' : 's'}</small>
          {p.bio ? <em><Mark text={p.bio} words={words} /></em> : null}
        </span>
      </Link>
      {p.handle === me?.handle ? null : <FollowButton h={p.handle} />}
    </div>
  );
}

function ArticleRow({ a, words }) {
  return (
    <Link className="sr-art" href={`/article/${a.id}`}>
      <div className="sr-thumb" role="img" aria-label="" style={a.cover ? { backgroundImage: `url('${a.cover}')` } : undefined}>{a.cover ? null : <span>{a.category.slice(0, 1)}</span>}</div>
      <div>
        <h3><Mark text={a.title} words={words} /></h3>
        <p className="sr-meta">{a.category} · by {a.author.name} · {a.readMinutes || 1} min read{a.publishedAt ? ' · ' + shortDate(a.publishedAt) : ''} · ♥ {a.likes} · 💬 {a.comments}</p>
        {a.snippet ? <p className="sr-snip">…<Mark text={a.snippet} words={words} />…</p> : null}
      </div>
    </Link>
  );
}

export default function SearchView() {
  const d = useData();
  const router = useRouter(), sp = useSearchParams();
  const q = sp.get('q') || '', league = sp.get('league') || '', season = sp.get('season') || '';
  const type = TABS.some(t => t[0] === sp.get('type')) ? sp.get('type') : 'all';
  const who = d.me?.handle || '';
  const words = useMemo(() => tokens(q), [q]);

  // people / articles / posts come from the server; `data[type] = { items, total }`, counts for the other tabs come along with it
  const [data, setData] = useState({}), [loading, setLoading] = useState(true), [err, setErr] = useState(''), [more, setMore] = useState(false);
  const [open, setOpen] = useState(() => new Set());

  useEffect(() => { document.title = (q ? `${q} · ` : '') + 'Search · Futlog'; }, [q]);

  useEffect(() => {
    if (!d.meReady) return;
    const ctl = new AbortController();
    const want = type === 'all' ? REMOTE : REMOTE.filter(t => t === type), counts = REMOTE.filter(t => !want.includes(t));
    const url = '/api/search?' + new URLSearchParams({ q, types: want.join(','), counts: counts.join(','), limit: type === 'all' ? PREVIEW : PAGE });
    setLoading(true); setErr('');
    fetch(url, { signal: ctl.signal, cache: 'no-store' })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; })
      .then(j => { setData(j); setLoading(false); })
      .catch(e => { if (e.name !== 'AbortError') { setErr(e.message); setLoading(false); } });
    return () => ctl.abort();
  }, [q, type, d.meReady, who]);

  const loadMore = useCallback(async () => {
    const cur = data[type]; if (!cur) return;
    setMore(true);
    try {
      const r = await fetch('/api/search?' + new URLSearchParams({ q, types: type, limit: PAGE, offset: cur.items.length }), { cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
      setData(s => ({ ...s, [type]: { total: j[type].total, items: [...s[type].items, ...j[type].items.filter(x => !s[type].items.some(y => (y.id ?? y.handle) === (x.id ?? x.handle)))] } }));
    } catch (e) { setErr(e.message); } finally { setMore(false); }
  }, [data, q, type]);

  const ready = d.status === 'ready';
  const ms = useMemo(() => ready ? searchMatches(d.matches, d.T, q, { league, season }) : [], [ready, d.matches, d.T, q, league, season]);
  const msAll = useMemo(() => ready ? (league || season ? searchMatches(d.matches, d.T, q) : ms) : [], [ready, d.matches, d.T, q, league, season, ms]);
  if (!ready) return null;

  const nav = (patch) => {
    const p = new URLSearchParams({ q });
    const next = { type, league, season, ...patch };
    for (const [k, v] of Object.entries(next)) if (v && !(k === 'type' && v === 'all')) p.set(k, v);
    router.push('/search?' + p);
  };
  const total = t => t === 'matches' ? msAll.length : t === 'all' ? null : data[t]?.total;
  const count = t => { const n = total(t); return n == null || (loading && t !== 'matches' && !data[t]) ? '' : <span>{n > 999 ? '999+' : n}</span>; };
  const sum = msAll.length + REMOTE.reduce((n, t) => n + (data[t]?.total || 0), 0);
  const nothing = !loading && !err && sum === 0;
  const toggle = id => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const updatePost = (id, fn) => setData(s => ({ ...s, posts: { ...s.posts, items: s.posts.items.map(x => x.id === id ? fn(x) : x) } }));

  const section = (key, title, body, seeAll) => body && (
    <section className="sr-sec" key={key}>
      <div className="sec-head"><h2>{title}</h2>{seeAll}</div>
      {body}
    </section>
  );
  const seeAll = (t, n, shown) => n > shown ? <button className="sr-all" onClick={() => nav({ type: t })}>See all {n.toLocaleString()}</button> : null;

  const peopleList = it => it?.length ? <div className="sr-list">{it.map(p => <PersonRow key={p.handle} p={p} words={words} />)}</div> : null;
  const articleList = it => it?.length ? <div className="sr-list">{it.map(a => <ArticleRow key={a.id} a={a} words={words} />)}</div> : null;
  const postList = it => it?.length ? <div>{it.map(p => (
    <PostCard key={p.id} p={p} m={p.matchId ? d.byId(p.matchId) : null} mark={words} isOpen={open.has(p.id)} onToggle={() => toggle(p.id)} onReplies={n => updatePost(p.id, x => ({ ...x, replies: n }))} />
  ))}</div> : null;
  const matchGrid = (list, cap) => list.length ? (
    <>
      <div className="match-grid">{list.slice(0, cap).map(m => <MatchCard key={m.id} m={m} />)}</div>
      {list.length > cap && type === 'matches' && <p className="empty" style={{ gridColumn: '1/-1' }}>Showing the best {cap} of {list.length} matches. Add a team, league or season to narrow it down.</p>}
    </>
  ) : null;

  const filters = (
    <div className="filters">
      <select aria-label="League" value={league} onChange={e => nav({ league: e.target.value })}><option value="">League</option>{uniq(d.matches, 'comp').map(v => <option key={v}>{v}</option>)}</select>
      <select aria-label="Season" value={season} onChange={e => nav({ season: e.target.value })}><option value="">Season</option>{uniq(d.matches, 'season').map(v => <option key={v}>{v}</option>)}</select>
    </div>
  );

  let content;
  if (type === 'all') {
    const parts = [
      ['people', 'People', peopleList(data.people?.items), seeAll('people', data.people?.total, PREVIEW)],
      ['articles', 'Articles', articleList(data.articles?.items), seeAll('articles', data.articles?.total, PREVIEW)],
      ['matches', 'Matches', matchGrid(ms, 6), seeAll('matches', msAll.length, 6)],
      ['posts', 'Posts', postList(data.posts?.items), seeAll('posts', data.posts?.total, PREVIEW)],
    ];
    if (q.trim().startsWith('#')) parts.unshift(parts.splice(3, 1)[0]);       // a #hashtag is a search for posts first
    content = parts.map(([k, t, body, more]) => section(k, t, body, more));
  } else if (type === 'matches') {
    content = section('m', `Matches${msAll.length ? ` (${msAll.length.toLocaleString()})` : ''}`, matchGrid(ms, CAP), filters);
  } else {
    const cur = data[type], body = { people: peopleList, articles: articleList, posts: postList }[type](cur?.items);
    content = section(type, TABS.find(t => t[0] === type)[1], body && (
      <>{body}{cur.items.length < cur.total && <p className="sr-more"><button className="btn" onClick={loadMore} disabled={more}>{more ? 'Loading…' : `Show more (${cur.total - cur.items.length} left)`}</button></p>}</>
    ));
  }
  const noneHere = type === 'all' ? nothing : !loading && !err && (type === 'matches' ? ms.length === 0 : !data[type]?.items.length);

  return (
    <main className="results" id="results">
      <div className="sec-head sr-head">
        <h2>{q ? <>Search results for: <em>{q}</em></> : 'Browse everything'}</h2>
      </div>
      <div className="sr-tabs" role="tablist" aria-label="Result type">
        {TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={type === v} onClick={() => nav({ type: v })}>{l}{count(v)}</button>)}
      </div>
      {err && <p className="pf-note" role="alert">Search failed: {err}</p>}
      {loading && !Object.keys(data).length && type !== 'matches' && <p className="empty">Searching…</p>}
      {content}
      {noneHere && (
        <div className="empty">
          <p>Nothing found for “{q}”{type !== 'all' ? ` in ${TABS.find(t => t[0] === type)[1].toLowerCase()}` : ''}{league || season ? ' with these filters' : ''}.</p>
          <ul className="sr-tips">
            <li>Check the spelling, or try fewer words.</li>
            <li>Try a team (“{d.matches[0] ? d.T[d.matches[0].h].short : 'Belgrano'}”), a person’s name or @handle, or a #hashtag.</li>
            {type !== 'all' && <li><button className="sr-all" onClick={() => nav({ type: 'all' })}>Search everything instead</button></li>}
            {(league || season) && <li><button className="sr-all" onClick={() => nav({ league: '', season: '' })}>Clear the filters</button></li>}
          </ul>
        </div>
      )}
    </main>
  );
}
