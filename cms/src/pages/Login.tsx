import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  }

  const field = 'w-full rounded bg-neutral-900 px-3 py-2 outline-none ' +
                'ring-1 ring-neutral-800 focus:ring-red-600';

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-100">
      <form onSubmit={submit} className="w-80 space-y-4">
        <h1 className="text-2xl font-semibold">Televizio CMS</h1>
        <input
          type="email" value={email} required autoFocus className={field}
          onChange={(e) => setEmail(e.target.value)} placeholder="Email"
        />
        <input
          type="password" value={password} required className={field}
          onChange={(e) => setPassword(e.target.value)} placeholder="Password"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit" disabled={busy}
          className="w-full rounded bg-red-600 px-3 py-2 font-medium disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
