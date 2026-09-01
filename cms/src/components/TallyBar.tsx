import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useLang } from '../lang/LangProvider';
import { useLastPublication, usePendingChanges, usePublish } from '../lib/queries';
import LangSwitch from './LangSwitch';

/** The tally.
 *
 *  The one thing this panel exists to tell you at a glance is whether the
 *  live site matches the database. In a gallery that is a tally light: red
 *  when the source is on air, amber when something is queued behind it.
 *
 *  It deliberately does not say "off air" — the site is never down. What
 *  changes is whether your edits have reached it yet.
 */
export default function TallyBar() {
  const { admin, signOut } = useAuth();
  const { t, lang } = useLang();
  const last = useLastPublication();
  const pending = usePendingChanges(last.data?.published_at ?? null);
  const publish = usePublish();

  const mayPublish = canWrite(admin?.role, 'content');
  const count = pending.data ?? 0;
  const queued = count > 0 || !last.data;
  const state = queued ? 'pending' : 'live';

  const when = last.data
    ? new Date(last.data.published_at).toLocaleString(
        lang === 'ka' ? 'ka-GE' : 'en-GB',
        { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' },
      )
    : null;

  const meta = !last.data
    ? t('ჯერ არ გამოქვეყნებულა', 'never published')
    : count > 0
      ? t(`${count} ცვლილება არ არის გამოქვეყნებული · ბოლო ${when}`,
          `${count} change${count === 1 ? '' : 's'} not published · last ${when}`)
      : t(`ბოლო გამოქვეყნება ${when}`, `last published ${when}`);

  return (
    <header className="tally" data-state={state}>
      <span className={`lamp lamp--${state}`} aria-hidden="true" />
      <span className="tally__state">
        {queued ? t('რიგში', 'Queued') : t('ეთერში', 'On air')}
      </span>
      <span className="tally__meta">{meta}</span>

      {publish.error && <span className="error">{publish.error.message}</span>}

      <div className="tally__right">
        {mayPublish && (
          <button
            className={`btn btn--sm ${queued ? 'btn--signal' : ''}`}
            onClick={() => publish.mutate()}
            disabled={publish.isPending}
          >
            {publish.isPending ? t('ქვეყნდება', 'Publishing') : t('გამოქვეყნება', 'Publish')}
          </button>
        )}
        <LangSwitch />
        <span className="who">
          <span className="who__name">{admin?.name}</span>
          <span className="who__role">{admin?.role}</span>
        </span>
        <button className="btn btn--quiet btn--sm" onClick={signOut}>
          {t('გასვლა', 'Sign out')}
        </button>
      </div>
    </header>
  );
}
