import { Link } from 'react-router-dom';
import { useLang } from '../lang/LangProvider';
import {
  useChannels, useLastPublication, usePendingChanges, usePlans,
} from '../lib/queries';
import { currentSubscription, useSubscribers } from '../lib/subscribers';
import {
  cumulativeByMonth, monthLabel, monthsBack, renewalBuckets, sumByMonth,
} from '../lib/analytics';
import { BarChart, BarsAcross, LineChart } from '../components/Chart';

export default function Overview() {
  const { t, lang } = useLang();
  const channels = useChannels();
  const plans = usePlans();
  const subscribers = useSubscribers();
  const last = useLastPublication();
  const pending = usePendingChanges(last.data?.published_at ?? null);

  const today = new Date().toISOString().slice(0, 10);

  if (channels.isLoading || plans.isLoading || subscribers.isLoading) {
    return <p className="eyebrow">{t('იტვირთება', 'Loading')}</p>;
  }

  const people = subscribers.data ?? [];
  const allPlans = plans.data ?? [];
  const liveChannels = (channels.data ?? []).filter((c) => c.is_active);

  const current = people
    .map((s) => ({ person: s, sub: currentSubscription(s) }))
    .filter((x) => x.sub);

  const activeSubs = current.filter((x) => x.sub!.status === 'active');
  const monthlyValue = activeSubs
    .reduce((sum, x) => sum + Number(x.sub!.price_at_signup), 0);

  const buckets = renewalBuckets(
    current.map((x) => ({ due_on: x.sub!.due_on, status: x.sub!.status })), today,
  );

  const months = monthsBack(12, today);
  const labels = months.map((m) => monthLabel(m, lang));

  const growth = cumulativeByMonth(people.map((s) => s.created_at), months);
  const revenue = sumByMonth(
    people.flatMap((s) => s.subscriptions.flatMap((x) => x.payments))
      .map((p) => ({ paid_on: p.paid_on, amount: Number(p.amount) })),
    months,
  );

  const mix = allPlans.map((p) => ({
    label: p.name_en,
    value: activeSubs.filter((x) => x.sub!.plan_id === p.id).length,
  }));

  const money = (n: number) => `${Math.round(n)}₾`;

  // Blocks a publish — the same two rules the publish endpoint refuses on.
  const noLogo = liveChannels.filter((c) => !c.logo_path || !c.logo_w || !c.logo_h);
  const emptyPlans = allPlans
    .filter((p) => p.is_active && p.plan_channels.length === 0);
  const unpublished = pending.data ?? 0;

  const tiles = [
    { value: activeSubs.length, label: t('აქტიური აბონენტი', 'Active subscribers'),
      meta: t(`სულ ${people.length}`, `${people.length} on file`), to: '/subscribers' },
    { value: Math.round(monthlyValue).toLocaleString('en-US').replace(/,/g, ' '),
      cur: '₾', label: t('თვიური ღირებულება', 'Monthly value'),
      meta: t('აქტიური გამოწერების ჯამი', 'sum of active subscriptions'), to: '/subscribers' },
    { value: buckets.overdue, label: t('ვადაგასული', 'Overdue'),
      meta: t('ვადა უკვე გავიდა', 'past the due date'), to: '/subscribers',
      tone: buckets.overdue > 0 ? 'fault' : undefined },
    { value: buckets.within7, label: t('ვადა 7 დღეში', 'Due in 7 days'),
      meta: t('მალე გასაახლებელი', 'renewals coming up'), to: '/subscribers',
      tone: buckets.within7 > 0 ? 'standby' : undefined },
  ];

  return (
    <section>
      <div className="head">
        <h1 className="head__title">{t('მიმოხილვა', 'Overview')}</h1>
      </div>

      <div className="figures">
        {tiles.map((f) => (
          <Link key={f.label} to={f.to} className="figure">
            <span className={`figure__value${f.tone ? ` is-${f.tone}` : ''}`}>
              {f.value}
              {'cur' in f && f.cur && <span className="figure__cur">{f.cur}</span>}
            </span>
            <span className="eyebrow">{f.label}</span>
            <span className="figure__meta">{f.meta}</span>
          </Link>
        ))}
      </div>

      {people.length === 0 ? (
        <div className="panel panel--spaced">
          <p className="notice">
            <span className="state state--standby">{t('ცარიელია', 'Empty')}</span>
            {t('ჯერ არცერთი აბონენტი არ არის. დაამატე პირველი და გრაფიკები გაცოცხლდება.',
               'No subscribers yet. Add the first one and these charts come to life.')}
          </p>
        </div>
      ) : (
        <div className="figs">
          <LineChart
            title={t('აბონენტების ზრდა', 'Subscriber growth')}
            meta={t('ბოლო 12 თვე, ჯამურად', 'last 12 months, cumulative')}
            labels={labels} values={growth}
          />
          <BarChart
            title={t('შემოსული თანხა', 'Revenue recorded')}
            meta={t('ბოლო 12 თვე', 'last 12 months')}
            labels={labels} values={revenue} format={money}
          />
          <BarsAcross
            title={t('პაკეტების განაწილება', 'Plan mix')}
            meta={t('აქტიური გამოწერები', 'active subscriptions')}
            rows={mix}
          />

          <figure className="fig">
            <figcaption className="fig__head">
              <span className="fig__title">{t('გასაახლებელი', 'Renewals due')}</span>
              <span className="fig__meta">{t('აქტიური გამოწერები', 'active subscriptions')}</span>
            </figcaption>
            <div className="panel">
              <Link to="/subscribers" className="notice notice--link">
                <span className="state state--fault">{t('ვადაგასული', 'Overdue')}</span>
                <span className="num">{buckets.overdue}</span>
              </Link>
              <Link to="/subscribers" className="notice notice--link">
                <span className="state state--standby">{t('7 დღეში', 'Within 7 days')}</span>
                <span className="num">{buckets.within7}</span>
              </Link>
              <Link to="/subscribers" className="notice notice--link">
                <span className="state state--ok">{t('30 დღეში', 'Within 30 days')}</span>
                <span className="num">{buckets.within30}</span>
              </Link>
              <p className="notice">
                <span className="state state--ok">{t('მოგვიანებით', 'Later')}</span>
                <span className="num">{buckets.later}</span>
              </p>
            </div>
          </figure>
        </div>
      )}

      <div className="head head--sub">
        <h2 className="head__title">
          {t('ყურადღება', 'Attention')}
        </h2>
      </div>

      <div className="panel">
        {noLogo.length === 0 && emptyPlans.length === 0 && unpublished === 0 && (
          <p className="notice">
            <span className="state state--ok">{t('წესრიგშია', 'Clear')}</span>
            {t('ყველაფერი გამოქვეყნებულია და არაფერი აკლია.',
               'Everything is published and nothing is missing.')}
          </p>
        )}

        {noLogo.length > 0 && (
          <Link to="/slider" className="notice notice--link">
            <span className="state state--fault">
              {t('აჩერებს გამოქვეყნებას', 'Blocks publish')}
            </span>
            {t(`${noLogo.length} არხს ლოგო არ აქვს — ${noLogo.map((c) => c.slug).join(', ')}`,
               `${noLogo.length} channel${noLogo.length === 1 ? '' : 's'} without a usable logo — ${noLogo.map((c) => c.slug).join(', ')}`)}
          </Link>
        )}

        {emptyPlans.length > 0 && (
          <Link to="/plans" className="notice notice--link">
            <span className="state state--fault">
              {t('აჩერებს გამოქვეყნებას', 'Blocks publish')}
            </span>
            {t(`${emptyPlans.length} პაკეტს არხები არ აქვს — ${emptyPlans.map((p) => p.slug).join(', ')}`,
               `${emptyPlans.length} plan${emptyPlans.length === 1 ? '' : 's'} carrying no channels — ${emptyPlans.map((p) => p.slug).join(', ')}`)}
          </Link>
        )}

        {unpublished > 0 && (
          <p className="notice">
            <span className="state state--standby">{t('რიგში', 'Queued')}</span>
            {t(`${unpublished} ცვლილება შენახულია, მაგრამ საიტზე ჯერ არ არის.`,
               `${unpublished} change${unpublished === 1 ? '' : 's'} saved but not yet on the live site.`)}
          </p>
        )}
      </div>

      <p className="note note--spaced">
        {t('ეს გრაფიკები აბონენტებისა და გადახდების ჩანაწერებს ეყრდნობა. ვიზიტორების სტატისტიკა ცალკე თვალთვალის ცხრილს საჭიროებს, რომელიც ჯერ არ არსებობს.',
           'These figures come from the subscriber and payment records. Visitor statistics need a separate tracking table, which does not exist yet.')}
      </p>
    </section>
  );
}
