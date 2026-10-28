'use client';
import { useEffect, useRef, useState } from 'react';
import { useData } from './DataProvider';
import { Avatar } from './ui';
import { preparePostImage, sendJSON } from '@/lib/profile';

const MAX = 280, MAX_PICS = 4;
const EMOJI = ['⚽', '🥅', '🏆', '🔥', '👏', '😂', '😍', '😮', '😭', '😡', '🤯', '🙌', '💪', '👀', '🎯', '🟨', '🟥', '🧤', '🏟️', '🇦🇿', '🇪🇸', '🇬🇧', '🇩🇪', '🇦🇷'];
const svg = (d, extra) => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}{extra}</svg>;
const I = {
  img: svg(<><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /></>, <path d="M4 17l5-5 4 4 2.5-2.5L20 18" />),
  emoji: svg(<circle cx="12" cy="12" r="8.5" />, <><path d="M8.5 14c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" /><path d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.6" /></>),
  ball: svg(<circle cx="12" cy="12" r="8.5" />, <path d="M12 8l3.2 2.3-1.2 3.7h-4L8.8 10.3zM12 3.5V8M15.2 10.3l4-1.3M14 14l2.5 3.3M10 14l-2.5 3.3M8.8 10.3l-4-1.3" />),
};

// Twitter-style post box for the feed: avatar, auto-growing text, up to 4 pictures (pick, drag in or paste), emoji, optional match tag,
// a character ring and a Post button. onPosted(post) gets the saved post (text and/or pictures are saved by POST /api/posts).
export default function PostComposer({ onPosted }) {
  const { me, matches, label, openAuth, byId } = useData();
  const [text, setText] = useState(''), [pics, setPics] = useState([]), [tag, setTag] = useState(0);
  const [tagOpen, setTagOpen] = useState(false), [emojiOpen, setEmojiOpen] = useState(false), [altFor, setAltFor] = useState(-1);
  const [busy, setBusy] = useState(false), [working, setWorking] = useState(0), [err, setErr] = useState(''), [drag, setDrag] = useState(false);
  const ta = useRef(null), file = useRef(null), emojiBox = useRef(null), seq = useRef(0);

  useEffect(() => {                                             // grow the box with the text
    const el = ta.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 360) + 'px';
  }, [text]);
  useEffect(() => {
    if (!emojiOpen) return;
    const off = e => { if (!emojiBox.current?.contains(e.target)) setEmojiOpen(false); };
    const esc = e => { if (e.key === 'Escape') setEmojiOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [emojiOpen]);

  const left = MAX - text.length, over = left < 0;
  const empty = !text.trim() && !pics.length;
  const canPost = !busy && !working && !empty && !over;

  const addFiles = async list => {
    const files = [...list].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    if (!me) { openAuth('signin'); return; }
    const room = MAX_PICS - pics.length - working;
    if (room <= 0) { setErr(`You can add up to ${MAX_PICS} pictures`); return; }
    setErr(files.length > room ? `Only ${MAX_PICS} pictures fit in a post, the rest were skipped` : '');
    setWorking(w => w + Math.min(files.length, room));
    for (const f of files.slice(0, room)) {
      try {
        const im = await preparePostImage(f);
        setPics(p => p.length < MAX_PICS ? [...p, { ...im, alt: '', key: ++seq.current }] : p);
      } catch (x) { setErr(x.message); }
      finally { setWorking(w => w - 1); }
    }
  };

  const insert = s => {
    const el = ta.current, a = el?.selectionStart ?? text.length, b = el?.selectionEnd ?? text.length;
    setText(t => t.slice(0, a) + s + t.slice(b)); setErr('');
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + s.length, a + s.length); });
  };

  const submit = async e => {
    e?.preventDefault();
    if (!me) { openAuth('signin'); return; }
    if (!canPost) return;
    setBusy(true); setErr('');
    try {
      const { post } = await sendJSON('/api/posts', 'POST', {
        body: text.trim(), matchId: tag || undefined,
        images: pics.map(p => ({ data: p.data, w: p.w, h: p.h, alt: p.alt.trim() || undefined })),
      });
      setText(''); setPics([]); setTag(0); setTagOpen(false); setAltFor(-1);
      onPosted?.(post);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  // character ring (r = 9): fills up as you type, turns amber near the limit and red over it
  const C = 2 * Math.PI * 9, used = Math.min(text.length / MAX, 1), warn = left <= 20;
  const tagged = tag ? byId(tag) : null;

  return (
    <form className={`cmp${drag ? ' drag' : ''}`} onSubmit={submit}
      onDragOver={e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false); }}
      onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
      <Avatar name={me?.name || '?'} src={me?.avatar} className="cmp-av" />
      <div className="cmp-main">
        <textarea ref={ta} rows={2} value={text} aria-label="Write a post"
          placeholder={me ? 'What’s happening in football?' : 'Sign in to share a thought on the game…'}
          onFocus={() => { if (!me) openAuth('signin'); }}
          onChange={e => { setText(e.target.value); setErr(''); }}
          onPaste={e => { const f = [...(e.clipboardData?.files || [])].filter(x => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); addFiles(f); } }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }} />

        {(pics.length > 0 || working > 0) && (
          <div className={`cmp-pics n${Math.min(pics.length + working, 4)}`}>
            {pics.map((p, i) => (
              <div className="cmp-pic" key={p.key}>
                <img src={p.data} alt={p.alt || `Picture ${i + 1}`} />
                <button type="button" className="cmp-rm" onClick={() => { setPics(l => l.filter((_, j) => j !== i)); setAltFor(-1); }} aria-label={`Remove picture ${i + 1}`}>✕</button>
                <button type="button" className={`cmp-alt${p.alt ? ' set' : ''}`} onClick={() => setAltFor(altFor === i ? -1 : i)} aria-expanded={altFor === i}>{p.alt ? 'ALT ✓' : '+ ALT'}</button>
                {altFor === i && (
                  <input className="cmp-altin" autoFocus maxLength={200} value={p.alt} placeholder="Describe this picture for people who cannot see it"
                    aria-label={`Description of picture ${i + 1}`}
                    onChange={e => setPics(l => l.map((x, j) => j === i ? { ...x, alt: e.target.value } : x))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setAltFor(-1); } if (e.key === 'Escape') setAltFor(-1); }} />
                )}
              </div>
            ))}
            {Array.from({ length: working }, (_, i) => <div className="cmp-pic loading" key={'w' + i} aria-label="Preparing picture"><span /></div>)}
          </div>
        )}

        {tagged && !tagOpen && (
          <div className="cmp-chip"><span>⚽ {label(tagged)}</span><button type="button" onClick={() => setTag(0)} aria-label="Remove match tag">✕</button></div>
        )}
        {tagOpen && (
          <select className="cmp-tag" value={tag} onChange={e => { setTag(+e.target.value); setTagOpen(false); }} aria-label="Tag a match" autoFocus onBlur={() => setTagOpen(false)}>
            <option value="0">No match tagged</option>
            {matches.slice(0, 100).map(m => <option key={m.id} value={m.id}>{label(m)}</option>)}
          </select>
        )}
        {err && <p className="st-err" role="alert">{err}</p>}

        <div className="cmp-bar">
          <div className="cmp-tools">
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <button type="button" title="Add pictures" aria-label="Add pictures" disabled={pics.length + working >= MAX_PICS} onClick={() => me ? file.current?.click() : openAuth('signin')}>{I.img}</button>
            <span className="cmp-emoji" ref={emojiBox}>
              <button type="button" title="Emoji" aria-label="Add emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(o => !o)}>{I.emoji}</button>
              {emojiOpen && <div className="cmp-pop" role="menu">{EMOJI.map(x => <button key={x} type="button" role="menuitem" onClick={() => { insert(x); setEmojiOpen(false); }}>{x}</button>)}</div>}
            </span>
            <button type="button" title="Tag a match" aria-label="Tag a match" className={tag ? 'on' : ''} onClick={() => setTagOpen(o => !o)}>{I.ball}</button>
          </div>
          <div className="cmp-end">
            {text.length > 0 && (
              <span className={`cmp-ring${warn ? ' warn' : ''}${over ? ' over' : ''}`} role="status" aria-label={`${left} characters left`}>
                <svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="9" className="bg" /><circle cx="13" cy="13" r="9" className="fg" strokeDasharray={C} strokeDashoffset={C * (1 - used)} transform="rotate(-90 13 13)" /></svg>
                {left <= 20 && <b>{left}</b>}
              </span>
            )}
            <button type="submit" className="cmp-post" disabled={!canPost}>{busy ? 'Posting…' : 'Post'}</button>
          </div>
        </div>
      </div>
      {drag && <div className="cmp-drop">Drop pictures to add them</div>}
    </form>
  );
}
