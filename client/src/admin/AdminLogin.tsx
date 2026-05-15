import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        code === 'not_an_admin' ? 'That email isn\'t in the PLATFORM_ADMIN_EMAILS allowlist.' :
        code === 'not_initialized' ? 'No password set for that email yet. Run `npm run admin:set-password -w server -- --email=... --password=...` first.' :
        code === 'locked_out' ? 'Too many failed attempts. Try again in 15 minutes.' :
        `Error: ${code}`
      );
    } finally { setBusy(false); }
  }

  return (
    <main className="page page--narrow">
      <h2>Platform admin login</h2>
      <p className="muted">
        For NAWRA / entitledto staff. Manage templates, the LA client list, and trust-domain
        allowlist approvals.
      </p>
      {error && <div className="alert alert--error">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-row">
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
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
          />
        </div>
        <button className="btn" type="submit" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
