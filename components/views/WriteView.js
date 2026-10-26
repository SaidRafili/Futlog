'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import { CATEGORIES } from '@/lib/consts';
import { sendJSON } from '@/lib/profile';

const BLANK = { title: '', category: 'Analysis', cover: '', body: '', matchIds: [] };

// Write / edit an article. /write = new article, /write/:id = edit one of yours.
// Draft -> POST/PUT /api/articles (status 'draft'); Publish -> status 'published'; Unpublish -> back to 'draft'.
export default function WriteView() {
  const d = useData();
  const id = useParams().id;
  if (d.status !== 'ready' || !d.meReady) return null;
  if (!d.me) {
    return (
      <main className="settings">
        <h1 className="st-h1">Write an article</h1>
        <div className="st-card st-gate">
          <p>Sign in to write and publish articles.</p>
          <div className="st-btns"><button className="btn primary" onClick={() => d.openAuth('signin')}>Sign in</button><button className="btn" onClick={() => d.openAuth('signup')}>Create account</button></div>
        </div>
      </main>
    );
  }
  return <Editor key={id || 'new'} id={id} />;
}

const toForm = a => ({ title: a.title, category: a.category, cover: a.cover || '', body: (a.body || []).join('\n\n'), matchIds: a.matchIds || [] });

function Editor({ id }) {
  const { matches, byId, label } = useData();
  const router = useRouter();
  const [phase, setPhase] = useState(id ? 'loading' : 'ready'), [loadError, setLoadError] = useState('');
  const [art, setArt] = useState(null);                 // what is saved in the database (null = new)
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState(null), [fields, setFields] = useState({});
  const [pick, setPick] = useState('');

  useEffect(() => { document.title = (id ? 'Edit article' : 'New article') + ' · Futlog'; }, [id]);
  useEffect(() => {
    if (!id) return;
    let dead = false;
    fetch('/api/articles/' + id, { cache: 'no-store' }).then(async res => {
      const j = await res.json().catch(() => ({}));
      if (dead) return;
      if (!res.ok) { setLoadError(res.status === 404 ? 'That article does not exist.' : j.error || 'HTTP ' + res.status); setPhase('error'); return; }
      if (!j.article.mine) { setLoadError('You can only edit your own articles.'); setPhase('error'); return; }
      setArt(j.article); setF(toForm(j.article)); setPhase('ready');
    }).catch(e => { if (!dead) { setLoadError(e.message); setPhase('error'); } });
    return () => { dead = true; };
  }, [id]);

  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setMsg(null); setFields(x => ({ ...x, [k]: undefined })); };
  const words = f.body.split(/\s+/).filter(Boolean).length;
  const base = art ? toForm(art) : BLANK;
  const dirty = ['title', 'category', 'cover', 'body'].some(k => f[k] !== base[k]) || f.matchIds.join() !== base.matchIds.join();

  // status: 'draft' | 'published' (what the article should be after this save)
  const save = async status => {
    setBusy(status); setMsg(null); setFields({});
    try {
      const body = { ...f, cover: f.cover.trim() || null, status };
      const { article } = art ? await sendJSON('/api/articles/' + art.id, 'PUT', body) : await sendJSON('/api/articles', 'POST', body);
      setArt(article); setF(toForm(article));
      if (status === 'published') { router.push('/article/' + article.id); return; }
      if (!id) router.replace('/write/' + article.id);
      setMsg({ text: art?.status === 'published' ? 'Taken offline and saved as a draft.' : 'Draft saved.' });
    } catch (e) { setFields(e.fields || {}); setMsg({ bad: true, text: e.fields ? 'Fix the highlighted fields and try again.' : e.message }); }
    finally { setBusy(''); }
  };

  const remove = async () => {
    if (!art || !confirm('Delete this article, its comments and likes? This cannot be undone.')) return;
    setBusy('delete');
    try { await sendJSON('/api/articles/' + art.id, 'DELETE', {}); router.push('/profile/' + art.author.handle + '?tab=articles'); }
    catch (e) { setMsg({ bad: true, text: e.message }); setBusy(''); }
  };

  if (phase === 'loading') return <main className="settings"><p className="empty">Loading…</p></main>;
  if (phase === 'error') return <main className="settings"><h1 className="st-h1">Edit article</h1><p className="pf-note" role="alert">{loadError}</p></main>;

  const published = art?.status === 'published';
  const err = k => fields[k] && <small className="st-err">{fields[k]}</small>;
  const chosen = f.matchIds.map(byId).filter(Boolean);

  return (
    <main className="settings">
      <div className="st-top"><h1>{art ? 'Edit article' : 'New article'}{art && <span className={`badge ${published ? 'pub' : ''}`}>{published ? 'Published' : 'Draft'}</span>}</h1>
        {art && <Link href={`/article/${art.id}`}>View article →</Link>}</div>

      <form onSubmit={e => { e.preventDefault(); save(published ? 'published' : 'draft'); }} noValidate>
        <section className="st-card">
          <div className="st-field"><label htmlFor="w-title">Title</label>
            <input id="w-title" value={f.title} onChange={e => set('title', e.target.value)} maxLength={300} aria-invalid={!!fields.title} placeholder="What is the article about?" />{err('title')}</div>
          <div className="st-two">
            <div className="st-field"><label htmlFor="w-cat">Category</label>
              <input id="w-cat" list="w-cats" value={f.category} onChange={e => set('category', e.target.value)} maxLength={50} aria-invalid={!!fields.category} /><datalist id="w-cats">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>{err('category')}</div>
            <div className="st-field"><label htmlFor="w-cover">Cover image link <small>(optional)</small></label>
              <input id="w-cover" value={f.cover} onChange={e => set('cover', e.target.value)} placeholder="https://…" inputMode="url" aria-invalid={!!fields.cover} />{err('cover')}</div>
          </div>
          <div className="st-field"><label htmlFor="w-body">Text</label>
            <textarea id="w-body" className="w-body" value={f.body} onChange={e => set('body', e.target.value)} rows={16} aria-invalid={!!fields.body} placeholder={'Write your article here.\n\nLeave a blank line to start a new paragraph.'} />
            <small className="count">{words} words · about {Math.max(1, Math.ceil(words / 200))} min read</small>{err('body')}</div>
        </section>

        <section className="st-card">
          <h2>Matches in this article</h2>
          <div className="w-matches">
            {chosen.map(m => <span key={m.id} className="w-chip">{label(m)}<button type="button" aria-label="Remove match" onClick={() => set('matchIds', f.matchIds.filter(x => x !== m.id))}>×</button></span>)}
            {!chosen.length && <small style={{ color: 'var(--muted)' }}>No matches added yet.</small>}
          </div>
          <div className="st-row">
            <div className="st-field"><select aria-label="Add a match" value={pick} onChange={e => setPick(e.target.value)}>
              <option value="">Choose one of the latest 150 matches…</option>
              {matches.slice(0, 150).filter(m => !f.matchIds.includes(m.id)).map(m => <option key={m.id} value={m.id}>{label(m)}</option>)}
            </select></div>
            <button type="button" className="btn" disabled={!pick || f.matchIds.length >= 8} onClick={() => { set('matchIds', [...f.matchIds, +pick]); setPick(''); }}>Add</button>
            {err('matchIds')}
          </div>
        </section>

        <div className="st-bar">
          <p className={msg?.bad ? 'bad' : 'ok'} role="status">{msg?.text || (dirty ? 'You have unsaved changes.' : '')}</p>
          {art && <button type="button" className="btn ghost" disabled={!!busy} onClick={remove}>{busy === 'delete' ? 'Deleting…' : 'Delete'}</button>}
          {published
            ? <><button type="button" className="btn ghost" disabled={!!busy} onClick={() => save('draft')}>{busy === 'draft' ? 'Saving…' : 'Unpublish'}</button>
                <button type="submit" className="btn primary" disabled={!!busy || !dirty}>{busy === 'published' ? 'Saving…' : 'Save changes'}</button></>
            : <><button type="submit" className="btn" disabled={!!busy || (!dirty && !!art)}>{busy === 'draft' ? 'Saving…' : 'Save draft'}</button>
                <button type="button" className="btn primary" disabled={!!busy} onClick={() => save('published')}>{busy === 'published' ? 'Publishing…' : 'Publish'}</button></>}
        </div>
      </form>
    </main>
  );
}
