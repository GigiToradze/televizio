import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useLang } from '../lang/LangProvider';
import LangSwitch from '../components/LangSwitch';

export default function Login() {
  const { signIn } = useAuth();
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Supabase speaks in its own terms. The interface should speak in ours:
   *  say what went wrong and what to do, without apologising for it. */
  function readable(message: string): string {
    if (/invalid login credentials/i.test(message)) {
      return t('ელფოსტა და პაროლი არ ემთხვევა ადმინის ანგარიშს.',
               'That email and password do not match an admin account.');
    }
    if (/email not confirmed/i.test(message)) {
      return t('ანგარიში ჯერ არ დადასტურდა. სთხოვე მფლობელს, ხელახლა გამოგზავნოს მოწვევა.',
               'This account has not been confirmed yet. Ask an owner to resend the invite.');
    }
    if (/failed to fetch|network/i.test(message)) {
      return t('სერვერთან კავშირი ვერ დამყარდა. შეამოწმე ინტერნეტი და სცადე თავიდან.',
               'Could not reach the server. Check the connection and try again.');
    }
    return message;
  }

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
          <span style={{ marginLeft: 'auto' }}><LangSwitch /></span>
        </div>
        <p className="eyebrow gate__sub">
          {t('არხები · პაკეტები · აბონენტები', 'Channels · Plans · Subscriptions')}
        </p>

        <label className="label">
          <span className="eyebrow">{t('ელფოსტა', 'Email')}</span>
          <input
            className="field" type="email" value={email} required autoFocus
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="label">
          <span className="eyebrow">{t('პაროლი', 'Password')}</span>
          <input
            className="field" type="password" value={password} required
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn--signal" disabled={busy}>
          {busy ? t('შესვლა…', 'Signing in') : t('შესვლა', 'Sign in')}
        </button>

        <p className="note">
          {t('ანგარიშებს ქმნის მფლობელი. რეგისტრაცია არ არსებობს.',
             'Accounts are created by an owner. There is no sign-up.')}
        </p>
      </form>
    </div>
  );
}
