import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

/** Supabase speaks in its own terms. The interface should speak in ours:
 *  say what went wrong and what to do, without apologising for it. */
function readable(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password do not match an admin account.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'This account has not been confirmed yet. Ask an owner to resend the invite.';
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'Could not reach the server. Check the connection and try again.';
  }
  return message;
}

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const message = await signIn(email, password);
    setError(message ? readable(message) : null);
    setBusy(false);
  }

  return (
    <div className="gate">
      <form onSubmit={submit} className="gate__form">
        <div className="gate__mark">
          <span className="gate__star" aria-hidden="true" />
          <span className="gate__name">Televizio</span>
        </div>
        <p className="eyebrow gate__sub">Channels · Plans · Subscriptions</p>

        <label className="label">
          <span className="eyebrow">Email</span>
          <input
            className="field" type="email" value={email} required autoFocus
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="label">
          <span className="eyebrow">Password</span>
          <input
            className="field" type="password" value={password} required
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn--signal" disabled={busy}>
          {busy ? 'Signing in' : 'Sign in'}
        </button>

        <p className="note">
          Accounts are created by an owner. There is no sign-up.
        </p>
      </form>
    </div>
  );
}
