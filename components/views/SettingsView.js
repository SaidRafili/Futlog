'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import { Avatar } from '../ui';
import { AVATAR, BANNER, fetchProfile, prepareImage, sendJSON } from '@/lib/profile';
import { hue } from '@/lib/util';

const BIO_MAX = 500;

export default function SettingsView() {
  const d = useData();
  if (d.status !== 'ready' || !d.meReady) return null;
  if (!d.me) {
    return (
      <main className="settings">
        <h1 className="st-h1">Settings</h1>
        <div className="st-card st-gate">
          <p>Sign in to edit your profile, photo and banner.</p>
          <div className="st-btns"><button className="btn primary" onClick={() => d.openAuth('signin')}>Sign in</button><button className="btn" onClick={() => d.openAuth('signup')}>Create account</button></div>
        </div>
      </main>
    );
  }
  return <Settings key={d.me.handle} handle={d.me.handle} />;
}

function Settings({ handle }) {
  const { TL, refreshMe } = useData();
  const [saved, setSaved] = useState(null);          // what is in the database (null = no row yet)
  const [phase, setPhase] = useState('loading');     // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ name: '', bio: '', location: '', favTeamId: '', bannerHue: null });
  const [pending, setPending] = useState({});        // { avatar?, banner? }: a new data URL, or null = remove; absent = unchanged
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState(null), [fields, setFields] = useState({});
  const avatarIn = useRef(null), bannerIn = useRef(null);

  const toForm = u => ({ name: u?.name ?? '', bio: u?.bio ?? '', location: u?.location ?? '', favTeamId: u?.favTeamId ?? '', bannerHue: u?.bannerHue ?? null });

  useEffect(() => {
    let dead = false;
    fetchProfile(handle)
      .then(api => { if (dead) return; setSaved(api?.user || null); setForm(toForm(api?.user)); setPhase('ready'); })
      .catch(e => { if (!dead) { setLoadError(e.message); setPhase('error'); } });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { document.title = 'Settings · Futlog'; }, []);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setMsg(null); setFields(x => ({ ...x, [k]: undefined })); };
  const avatar = pending.avatar !== undefined ? pending.avatar : saved?.avatar ?? null;
  const banner = pending.banner !== undefined ? pending.banner : saved?.banner ?? null;
  const base = toForm(saved);
  const dirty = Object.keys(pending).length > 0 || ['name', 'bio', 'location', 'favTeamId', 'bannerHue'].some(k => String(form[k] ?? '') !== String(base[k] ?? ''));

  const pickImage = async (kind, file, spec) => {
    if (!file) return;
    setBusy(kind); setMsg(null);
    try { setPending(p => ({ ...p, [kind]: null })); const url = await prepareImage(file, spec.w, spec.h, spec.max); setPending(p => ({ ...p, [kind]: url })); }
    catch (e) { setPending(p => { const n = { ...p }; delete n[kind]; return n; }); setMsg({ bad: true, text: e.message }); }
    finally { setBusy(''); }
  };

  const save = async e => {
    e.preventDefault();
    setBusy('save'); setMsg(null); setFields({});
    try {
      const body = { name: form.name, bio: form.bio, location: form.location, favTeamId: form.favTeamId === '' ? null : +form.favTeamId, bannerHue: form.bannerHue, ...pending };
      const { user } = await sendJSON(`/api/users/${handle}`, 'PUT', body);
      setSaved(user); setForm(toForm(user)); setPending({});
      refreshMe();
      setMsg({ text: 'Saved. Your profile is up to date.' });
    } catch (err) {
      setFields(err.fields || {});
      setMsg({ bad: true, text: err.fields ? 'Fix the highlighted fields and try again.' : err.message });
    } finally { setBusy(''); }
  };

  const discard = () => { setForm(toForm(saved)); setPending({}); setMsg(null); setFields({}); };

  if (phase === 'loading') return <main className="settings"><p className="empty">Loading…</p></main>;
  if (phase === 'error') return <main className="settings"><h1>Settings</h1><p className="pf-note" role="alert">Could not load your profile: {loadError}</p></main>;

  const name = form.name.trim() || 'Your name';
  const cover = banner ? { backgroundImage: `url("${banner}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : { '--h': form.bannerHue ?? hue(handle) };

  return (
    <main className="settings">
      <div className="st-top"><h1>Settings</h1><Link href={`/profile/${handle}`}>View profile →</Link></div>

      <form onSubmit={save} noValidate>
        <section className="st-card" aria-labelledby="st-look">
          <h2 id="st-look">Banner and photo</h2>
          <div className="st-preview">
            <div className={`pf-cover${banner ? ' img' : ''}`} style={cover} />
            <div className="st-prow"><Avatar name={name} src={avatar} className="pf-av" /><div><b>{name}</b><div className="handle">@{handle}</div></div></div>
          </div>

          <div className="st-row">
            <div className="st-lab"><b>Profile photo</b><small>Square, shown at 256 × 256. JPEG, PNG or WebP.</small></div>
            <div className="st-btns">
              <input ref={avatarIn} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { pickImage('avatar', e.target.files[0], AVATAR); e.target.value = ''; }} />
              <button type="button" className="btn" disabled={!!busy} onClick={() => avatarIn.current.click()}>{busy === 'avatar' ? 'Processing…' : avatar ? 'Change photo' : 'Upload photo'}</button>
              {avatar && <button type="button" className="btn ghost" disabled={!!busy} onClick={() => setPending(p => ({ ...p, avatar: null }))}>Remove</button>}
            </div>
            {fields.avatar && <p className="st-err">{fields.avatar}</p>}
          </div>

          <div className="st-row">
            <div className="st-lab"><b>Banner image</b><small>Wide, shown at 1600 × 400 and cropped to fit. Keep the middle clear.</small></div>
            <div className="st-btns">
              <input ref={bannerIn} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { pickImage('banner', e.target.files[0], BANNER); e.target.value = ''; }} />
              <button type="button" className="btn" disabled={!!busy} onClick={() => bannerIn.current.click()}>{busy === 'banner' ? 'Processing…' : banner ? 'Change banner' : 'Upload banner'}</button>
              {banner && <button type="button" className="btn ghost" disabled={!!busy} onClick={() => setPending(p => ({ ...p, banner: null }))}>Remove</button>}
            </div>
            {fields.banner && <p className="st-err">{fields.banner}</p>}
          </div>

          <div className="st-row">
            <label className="st-lab" htmlFor="st-hue"><b>Banner colour</b><small>{banner ? 'Used when there is no banner image.' : 'The colour of your default banner.'}</small></label>
            <div className="st-btns">
              <input id="st-hue" type="range" min="0" max="359" className="hue" value={form.bannerHue ?? hue(handle)} onChange={e => set('bannerHue', +e.target.value)} />
              {form.bannerHue !== null && <button type="button" className="btn ghost" onClick={() => set('bannerHue', null)}>Reset</button>}
            </div>
          </div>
        </section>

        <section className="st-card" aria-labelledby="st-about">
          <h2 id="st-about">About you</h2>
          <div className="st-field">
            <label htmlFor="st-name">Display name</label>
            <input id="st-name" value={form.name} maxLength={100} required aria-invalid={!!fields.name} onChange={e => set('name', e.target.value)} />
            {fields.name && <p className="st-err">{fields.name}</p>}
          </div>
          <div className="st-field">
            <label htmlFor="st-handle">Username</label>
            <input id="st-handle" value={'@' + handle} disabled aria-describedby="st-handle-h" />
            <small id="st-handle-h">Your profile address is /profile/{handle}. Usernames can’t be changed.</small>
          </div>
          <div className="st-field">
            <label htmlFor="st-bio">Bio</label>
            <textarea id="st-bio" rows={4} value={form.bio} maxLength={BIO_MAX} aria-invalid={!!fields.bio} onChange={e => set('bio', e.target.value)} />
            <small className="count">{form.bio.length}/{BIO_MAX}</small>
            {fields.bio && <p className="st-err">{fields.bio}</p>}
          </div>
          <div className="st-two">
            <div className="st-field">
              <label htmlFor="st-loc">Location</label>
              <input id="st-loc" value={form.location} maxLength={100} placeholder="City, country" onChange={e => set('location', e.target.value)} />
            </div>
            <div className="st-field">
              <label htmlFor="st-team">Favourite team</label>
              <select id="st-team" value={form.favTeamId} aria-invalid={!!fields.favTeamId} onChange={e => set('favTeamId', e.target.value)}>
                <option value="">None</option>
                {[...TL].sort((a, b) => a.n.localeCompare(b.n)).map(t => <option key={t.id} value={t.id}>{t.n}</option>)}
              </select>
              {fields.favTeamId && <p className="st-err">{fields.favTeamId}</p>}
            </div>
          </div>
        </section>

        <div className="st-bar">
          <p role="status" className={msg?.bad ? 'bad' : 'ok'}>{msg?.text}</p>
          <button type="button" className="btn ghost" disabled={!dirty || !!busy} onClick={discard}>Discard changes</button>
          <button type="submit" className="btn primary" disabled={!dirty || !!busy}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </main>
  );
}
