'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useData } from './DataProvider';
import { sendJSON } from '@/lib/profile';

const EMPTY = { name: '', handle: '', email: '', id: '', password: '' };

// Sign in / create account popup. Opened from anywhere with useData().openAuth('signin' | 'signup').
export default function AuthModal() {
  const { auth, closeAuth, openAuth, refreshMe } = useData();
  const ref = useRef(null);
  const uid = useId();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const signup = auth.mode === 'signup';

  // open / close the native <dialog> (gives us the backdrop, Esc to close and focus trapping)
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (auth.open && !d.open) { d.showModal(); }
    if (!auth.open && d.open) d.close();
    if (auth.open) { setErrors({}); setFormError(''); setShow(false); setTimeout(() => d.querySelector('input:not([type=hidden])')?.focus(), 30); }
    else setF(EMPTY);
  }, [auth.open, auth.mode]);

  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); setFormError(''); };

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setErrors({}); setFormError('');
    try {
      await (signup
        ? sendJSON('/api/auth/signup', 'POST', { name: f.name, handle: f.handle, email: f.email, password: f.password })
        : sendJSON('/api/auth/login', 'POST', { id: f.id, password: f.password }));
      await refreshMe();
      closeAuth();
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.fields ? '' : err.message);
    } finally { setBusy(false); }
  };

  const field = (key, label, props = {}) => (
    <div className="au-field">
      <label htmlFor={`${uid}-${key}`}>{label}</label>
      <input id={`${uid}-${key}`} value={f[key]} onChange={e => set(key, props.lower ? e.target.value.toLowerCase() : e.target.value)}
        aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${uid}-${key}-e` : undefined} required {...props.attrs} />
      {props.hint && !errors[key] && <small>{props.hint}</small>}
      {errors[key] && <p className="au-err" id={`${uid}-${key}-e`}>{errors[key]}</p>}
    </div>
  );

  return (
    <dialog ref={ref} className="auth" aria-labelledby={`${uid}-t`} onClose={closeAuth}
      onClick={e => { if (e.target === ref.current) closeAuth(); }}>
      <div className="au-card">
        <button type="button" className="au-x" aria-label="Close" onClick={closeAuth}>×</button>
        <h2 id={`${uid}-t`}>{signup ? 'Create your account' : 'Welcome back'}</h2>
        <p className="au-sub">{signup ? 'Log matches, write reviews and follow other fans.' : 'Sign in to log matches and follow other fans.'}</p>

        <div className="au-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!signup} onClick={() => openAuth('signin')}>Sign in</button>
          <button type="button" role="tab" aria-selected={signup} onClick={() => openAuth('signup')}>Sign up</button>
        </div>

        <form onSubmit={submit} noValidate>
          {signup ? <>
            {field('name', 'Name', { attrs: { autoComplete: 'name', maxLength: 100 } })}
            {field('handle', 'Username', { lower: true, hint: 'Lowercase letters, numbers, dots and underscores. This is your profile address.', attrs: { autoComplete: 'username', maxLength: 30, autoCapitalize: 'none', spellCheck: false } })}
            {field('email', 'Email', { attrs: { type: 'email', autoComplete: 'email', maxLength: 255 } })}
          </> : field('id', 'Email or username', { attrs: { autoComplete: 'username', autoCapitalize: 'none', spellCheck: false } })}

          <div className="au-field">
            <label htmlFor={`${uid}-pw`}>Password</label>
            <div className="au-pw">
              <input id={`${uid}-pw`} type={show ? 'text' : 'password'} value={f.password} onChange={e => set('password', e.target.value)} required
                autoComplete={signup ? 'new-password' : 'current-password'} maxLength={128} aria-invalid={!!errors.password} />
              <button type="button" onClick={() => setShow(s => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
            </div>
            {signup && !errors.password && <small>At least 8 characters.</small>}
            {errors.password && <p className="au-err">{errors.password}</p>}
          </div>

          <p className="au-err au-form" role="alert">{formError}</p>
          <button type="submit" className="btn primary au-go" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button>
        </form>

        <p className="au-switch">
          {signup ? 'Already have an account? ' : 'New to Futlog? '}
          <button type="button" onClick={() => openAuth(signup ? 'signin' : 'signup')}>{signup ? 'Sign in' : 'Create an account'}</button>
        </p>
      </div>
    </dialog>
  );
}
