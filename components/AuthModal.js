'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useData } from './DataProvider';
import { sendJSON } from '@/lib/profile';

const EMPTY = { name: '', handle: '', email: '', id: '', password: '' };
const RESEND_WAIT = 45;   // seconds before "Send a new code" works again (the server enforces it too)

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
  // step 2: the 6-digit code that was e-mailed to the user
  const [step, setStep] = useState('form');            // 'form' | 'code'
  const [challenge, setChallenge] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [note, setNote] = useState('');

  const resetCode = () => { setStep('form'); setChallenge(''); setSentTo(''); setCode(''); setWait(0); setNote(''); };

  // countdown for "Send a new code"
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // open / close the native <dialog> (gives us the backdrop, Esc to close and focus trapping)
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (auth.open && !d.open) { d.showModal(); }
    if (!auth.open && d.open) d.close();
    if (auth.open) { setErrors({}); setFormError(''); setShow(false); resetCode(); setTimeout(() => d.querySelector('input:not([type=hidden])')?.focus(), 30); }
    else { setF(EMPTY); resetCode(); }
  }, [auth.open, auth.mode]);

  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); setFormError(''); };

  // step 1: send the form; the server e-mails a 6-digit code
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setErrors({}); setFormError('');
    try {
      const r = await (signup
        ? sendJSON('/api/auth/signup', 'POST', { name: f.name, handle: f.handle, email: f.email, password: f.password })
        : sendJSON('/api/auth/login', 'POST', { id: f.id, password: f.password }));
      setChallenge(r.challenge); setSentTo(r.email); setCode(''); setNote(''); setWait(RESEND_WAIT); setStep('code');
      setTimeout(() => ref.current?.querySelector('.au-code')?.focus(), 30);
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.fields ? '' : err.message);
    } finally { setBusy(false); }
  };

  // step 2: check the code; on success the server signs the user in
  const verify = async e => {
    e?.preventDefault();
    if (code.length !== 6) { setFormError('Enter the 6-digit code from the email'); return; }
    setBusy(true); setFormError(''); setNote('');
    try {
      await sendJSON('/api/auth/verify', 'POST', { challenge, code });
      await refreshMe();
      closeAuth();
    } catch (err) {
      setFormError(err.message);
      if (err.status === 410 || err.status === 409) { setStep('form'); setChallenge(''); setCode(''); }   // expired / used up / taken: start over
      else { setCode(''); setTimeout(() => ref.current?.querySelector('.au-code')?.focus(), 30); }
    } finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setFormError(''); setNote('');
    try {
      await sendJSON('/api/auth/resend', 'POST', { challenge });
      setCode(''); setNote('A new code is on its way.'); setWait(RESEND_WAIT);
    } catch (err) {
      setFormError(err.message);
      if (err.status === 410) { setStep('form'); setChallenge(''); }
    } finally { setBusy(false); }
  };

  const onCode = v => { setCode(v.replace(/\D/g, '').slice(0, 6)); setFormError(''); };

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
        <h2 id={`${uid}-t`}>{step === 'code' ? 'Check your email' : signup ? 'Create your account' : 'Welcome back'}</h2>
        <p className="au-sub">{step === 'code' ? <>We sent a 6-digit code to <strong>{sentTo}</strong>. It expires in 10 minutes.</> : signup ? 'Log matches, write reviews and follow other fans.' : 'Sign in to log matches and follow other fans.'}</p>

        {step === 'code' ? (
          <form onSubmit={verify} noValidate>
            <div className="au-field">
              <label htmlFor={`${uid}-code`}>Verification code</label>
              <input id={`${uid}-code`} className="au-code" value={code} onChange={e => onCode(e.target.value)} inputMode="numeric" pattern="[0-9]*"
                autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-invalid={!!formError} required />
              <small>Can't find it? Check your spam folder.</small>
            </div>
            {note && <p className="au-note" role="status">{note}</p>}
            <p className="au-err au-form" role="alert">{formError}</p>
            <button type="submit" className="btn primary au-go" disabled={busy || code.length !== 6}>{busy ? 'Please wait…' : signup ? 'Verify and create account' : 'Verify and sign in'}</button>
            <p className="au-switch">
              <button type="button" onClick={resend} disabled={busy || wait > 0}>{wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}</button>
              {' · '}
              <button type="button" onClick={() => { resetCode(); setFormError(''); }}>Back</button>
            </p>
          </form>
        ) : <>
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
        </>}
      </div>
    </dialog>
  );
}
