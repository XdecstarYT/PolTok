import { useState, type FormEvent } from 'react';
import { Button } from '../../components';
import { login } from './auth';
import './owner.css';

export function OwnerLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await login(user.trim(), pass);
    setBusy(false);
    if (r.ok) {
      setPass('');
      onSuccess();
    } else setErr(r.error);
  };
  return (
    <form className="ow-login" onSubmit={submit}>
      <label>
        <span>Username</span>
        <input autoFocus autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} required />
      </label>
      <label>
        <span>Password</span>
        <input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} required />
      </label>
      {err && <p className="ow-err" role="alert">{err}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
    </form>
  );
}
