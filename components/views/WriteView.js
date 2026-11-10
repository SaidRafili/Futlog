'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import { CATEGORIES } from '@/lib/consts';
import { sendJSON } from '@/lib/profile';

const BLANK = { title: '', category: CATEGORIES[0], cover: '', body: '', matchIds: [] };   // new articles start on the first fixed category
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Upload one image -> POST /api/article-images (multipart, field "file").
// Expected response: { url } or { id }  (url is then /api/article-images/<id>).
async function uploadImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG, WebP or GIF).');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('The image is larger than 4 MB.');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/article-images', { method: 'POST', body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Upload failed (HTTP ' + res.status + ').');
  const url = j.url || (j.id != null ? '/api/article-images/' + j.id : '');
  if (!url) throw new Error('Upload succeeded but no image link was returned.');
  return url;
}

// ---------- tiny markdown renderer (no dangerouslySetInnerHTML) ----------
const safeUrl = u => (/^(https?:\/\/|\/)/i.test(u) ? u : '#');

// inline: ![alt](url)  [text](url)  **bold**  *italic*   (unmatched markers stay as plain text)
function inline(text, key = '') {
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;
  const out = [];
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = key + i++;
    if (m[2]) out.push(<img key={k} src={safeUrl(m[2])} alt={m[1]} className="w-img" />);
    else if (m[4]) out.push(<a key={k} href={safeUrl(m[4])} target="_blank" rel="noopener noreferrer">{m[3]}</a>);
    else if (m[5]) out.push(<strong key={k}>{m[5]}</strong>);
    else out.push(<em key={k}>{m[6]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Each blank-line separated paragraph is rendered on its own; consecutive list items are merged into one list.
function renderMarkdown(src) {
  const lines = src.split('\n');
  const nodes = [];
  let list = null, para = [];
  const flushPara = () => { if (para.length) { nodes.push(<p key={nodes.length}>{inline(para.join(' '), 'p' + nodes.length)}</p>); para = []; } };
  const flushList = () => { if (list) { const L = list; nodes.push(L.ordered
    ? <ol key={nodes.length}>{L.items.map((t, i) => <li key={i}>{inline(t, 'o' + i)}</li>)}</ol>
    : <ul key={nodes.length}>{L.items.map((t, i) => <li key={i}>{inline(t, 'u' + i)}</li>)}</ul>); list = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushPara(); continue; }          // blank line: paragraph break (list may continue)
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara(); flushList();
      const H = 'h' + (m[1].length + 1);                   // # -> h2, ## -> h3, ### -> h4 (page title is the h1)
      nodes.push(<H key={nodes.length}>{inline(m[2], 'h' + nodes.length)}</H>);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) {   // image on its own line
      flushPara(); flushList();
      nodes.push(<img key={nodes.length} src={safeUrl(m[2])} alt={m[1]} className="w-img" />);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); flushList();
      nodes.push(<blockquote key={nodes.length}>{inline(m[1], 'q' + nodes.length)}</blockquote>);
    } else { flushList(); para.push(line.trim()); }
  }
  flushPara(); flushList();
  return nodes;
}

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
  const [tab, setTab] = useState('write');              // 'write' | 'preview'
  const [upl, setUpl] = useState('');                   // '' | 'cover' | 'body'
  const [coverBroken, setCoverBroken] = useState(false);
  const coverInput = useRef(null), bodyInput = useRef(null), bodyArea = useRef(null);

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

  // ----- image uploads -----
  const pickCover = async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUpl('cover'); setMsg(null);
    try { set('cover', await uploadImage(file)); setCoverBroken(false); }
    catch (err) { setMsg({ bad: true, text: err.message }); }
    finally { setUpl(''); }
  };
  const pickBodyImage = async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUpl('body'); setMsg(null);
    try {
      const url = await uploadImage(file);
      const ta = bodyArea.current;
      const at = ta ? ta.selectionStart : f.body.length;
      const before = f.body.slice(0, at), after = f.body.slice(at);
      const md = (before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '') + `![](${url})` + (after && !after.startsWith('\n\n') ? '\n\n' : '');
      set('body', before + md + after);
    } catch (err) { setMsg({ bad: true, text: err.message }); }
    finally { setUpl(''); }
  };

  // wrap the selected text (bold / italic) or insert a line prefix (heading / list)
  const wrap = (L, R = L) => {
    const ta = bodyArea.current; if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = f.body.slice(s, e) || 'text';
    set('body', f.body.slice(0, s) + L + sel + R + f.body.slice(e));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + L.length, s + L.length + sel.length); });
  };
  const prefix = p => {
    const ta = bodyArea.current; if (!ta) return;
    const s = ta.selectionStart, lineStart = f.body.lastIndexOf('\n', s - 1) + 1;
    set('body', f.body.slice(0, lineStart) + p + f.body.slice(lineStart));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + p.length, s + p.length); });
  };

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
  const hasCover = !!f.cover.trim();

  return (
    <main className="settings">
      <div className="st-top"><h1>{art ? 'Edit article' : 'New article'}{art && <span className={`badge ${published ? 'pub' : ''}`}>{published ? 'Published' : 'Draft'}</span>}</h1>
        {art && <Link href={`/article/${art.id}`}>View article →</Link>}</div>

      <form onSubmit={e => { e.preventDefault(); save(published ? 'published' : 'draft'); }} noValidate>
        <section className="st-card">
          <div className="st-field"><label htmlFor="w-title">Title</label>
            <input id="w-title" value={f.title} onChange={e => set('title', e.target.value)} maxLength={300} aria-invalid={!!fields.title} placeholder="What is the article about?" />{err('title')}</div>

          <div className="st-field"><label htmlFor="w-cat">Category</label>
            <select id="w-cat" value={f.category} onChange={e => set('category', e.target.value)} aria-invalid={!!fields.category}>
              {/* an older article may carry a category that is no longer in the list: keep it selectable until the author changes it */}
              {!CATEGORIES.includes(f.category) && f.category && <option value={f.category}>{f.category}</option>}
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>{err('category')}</div>

          {/* ----- cover photo ----- */}
          <div className="st-field"><label htmlFor="w-cover">Cover photo <small>(optional)</small></label>
            {hasCover && !coverBroken && <img className="w-cover" src={f.cover} alt="Cover preview" onError={() => setCoverBroken(true)} />}
            {hasCover && coverBroken && <p className="w-cover-bad">The preview could not be loaded. Check the link below.</p>}
            <div className="w-cover-bar">
              <input ref={coverInput} type="file" accept="image/*" hidden onChange={pickCover} />
              <button type="button" className="btn outline" disabled={!!upl || !!busy} onClick={() => coverInput.current?.click()}>
                {upl === 'cover' ? 'Uploading…' : hasCover ? 'Replace photo' : 'Upload photo'}</button>
              {hasCover && <button type="button" className="btn ghost" disabled={!!upl || !!busy} onClick={() => { set('cover', ''); setCoverBroken(false); }}>Remove</button>}
              <input id="w-cover" value={f.cover} onChange={e => { set('cover', e.target.value); setCoverBroken(false); }} placeholder="or paste an image link (https://…)" inputMode="url" aria-invalid={!!fields.cover} />
            </div>{err('cover')}</div>

          {/* ----- text: Write / Preview ----- */}
          <div className="st-field"><label id="w-body-l" htmlFor="w-body">Text</label>
            <div className="w-tabs" role="tablist" aria-label="Text editor mode">
              <button type="button" role="tab" id="w-tab-write" aria-selected={tab === 'write'} aria-controls="w-panel" className={`w-tab ${tab === 'write' ? 'on' : ''}`} onClick={() => setTab('write')}>Write</button>
              <button type="button" role="tab" id="w-tab-preview" aria-selected={tab === 'preview'} aria-controls="w-panel" className={`w-tab ${tab === 'preview' ? 'on' : ''}`} onClick={() => setTab('preview')}>Preview</button>
            </div>
            <div id="w-panel" role="tabpanel" aria-labelledby={tab === 'write' ? 'w-tab-write' : 'w-tab-preview'}>
              {tab === 'write' ? <>
                <div className="w-tools">
                  <button type="button" className="btn ghost" title="Heading" onClick={() => prefix('# ')}>H</button>
                  <button type="button" className="btn ghost" title="Bold" onClick={() => wrap('**')}><b>B</b></button>
                  <button type="button" className="btn ghost" title="Italic" onClick={() => wrap('*')}><i>I</i></button>
                  <button type="button" className="btn ghost" title="Bulleted list" onClick={() => prefix('- ')}>• List</button>
                  <input ref={bodyInput} type="file" accept="image/*" hidden onChange={pickBodyImage} />
                  <button type="button" className="btn ghost" title="Insert image" disabled={!!upl} onClick={() => bodyInput.current?.click()}>{upl === 'body' ? 'Uploading…' : 'Image'}</button>
                </div>
                <textarea id="w-body" ref={bodyArea} className="w-body" value={f.body} onChange={e => set('body', e.target.value)} rows={16} aria-invalid={!!fields.body} placeholder={'Write your article here.\n\nLeave a blank line to start a new paragraph.\n\n# Heading   - list item   **bold**   *italic*'} />
              </> : <div className="w-preview">
                {f.body.trim() ? renderMarkdown(f.body) : <p className="empty">Nothing to preview yet.</p>}
              </div>}
            </div>
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
