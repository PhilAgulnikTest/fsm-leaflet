import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { adminApi } from './adminApi';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(email, password);
      nav('/admin');
    } catch (err) {
      const code = (err as Error).message;
      setError(
        code === 'wrong_password' ? 'Wrong password.' :
        code === 'password_required' ? 'Enter the password.' :
        `Error: ${code}`
      );
    } finally { setBusy(false); }
  }

  return (
    <>
      <Header />
      <main className="page page--narrow">
        <h2>Admin sign-in</h2>
        <p className="muted">
          Enter the admin password to manage templates, LA clients, customisations, and trust-domain approvals.
        </p>
        {error && <div className="alert alert--error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-row">
            <label htmlFor="admin-email">
              Your email <span className="muted" style={{ fontWeight: 400 }}>— optional, for audit trail</span>
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="phil@entitledto.co.uk"
            />
          </div>
          <div className="form-row">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              autoFocus
            />
          </div>
          <button className="btn btn--large btn--primary" type="submit" disabled={busy || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </>
  );
}
