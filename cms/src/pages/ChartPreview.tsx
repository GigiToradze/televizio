import { useLang } from '../lang/LangProvider';
import { monthLabel, monthsBack } from '../lib/analytics';
import { BarChart, BarsAcross, LineChart } from '../components/Chart';
import LangSwitch from '../components/LangSwitch';

/* Dev-only. The dashboard sits behind a session, and a chart has to be
   looked at to be trusted — this renders the same components against
   fixture data so layout, tick collisions and tooltips can be checked.

   Mounted only when import.meta.env.DEV, so the production bundle drops it. */
export default function ChartPreview() {
  const { t, lang } = useLang();
  const months = monthsBack(12, '2026-09-01');
  const labels = months.map((m) => monthLabel(m, lang));

  const growth = [4, 9, 14, 21, 26, 34, 41, 47, 58, 66, 79, 91];
  const revenue = [116, 261, 406, 609, 754, 986, 1189, 1363, 1682, 1914, 2291, 2639];
  const money = (n: number) => `${Math.round(n)}₾`;

  return (
    <div className="app" style={{ gridTemplateColumns: '1fr', gridTemplateAreas: '"tally" "stage"', gridTemplateRows: 'var(--tally-h) 1fr' }}>
      <header className="tally" data-state="pending">
        <span className="lamp lamp--pending" />
        <span className="tally__state">{t('რიგში', 'Queued')}</span>
        <span className="tally__meta">chart preview · fixture data</span>
        <div className="tally__right"><LangSwitch /></div>
      </header>

      <main className="stage">
        <div className="head">
          <h1 className="head__title">{t('მიმოხილვა', 'Overview')}</h1>
        </div>

        <div className="figures">
          {[
            { v: 91, l: t('აქტიური აბონენტი', 'Active subscribers'), m: t('სულ 104', '104 on file') },
            { v: '2 639', cur: '₾', l: t('თვიური ღირებულება', 'Monthly value'), m: t('აქტიური გამოწერების ჯამი', 'sum of active subscriptions') },
            { v: 7, l: t('ვადაგასული', 'Overdue'), m: t('ვადა უკვე გავიდა', 'past the due date'), tone: 'fault' },
            { v: 12, l: t('ვადა 7 დღეში', 'Due in 7 days'), m: t('მალე გასაახლებელი', 'renewals coming up'), tone: 'standby' },
          ].map((f) => (
            <span key={f.l} className="figure">
              <span className={`figure__value${f.tone ? ` is-${f.tone}` : ''}`}>
                {f.v}{'cur' in f && f.cur && <span className="figure__cur">{f.cur}</span>}
              </span>
              <span className="eyebrow">{f.l}</span>
              <span className="figure__meta">{f.m}</span>
            </span>
          ))}
        </div>

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
            rows={[
              { label: 'Basic', value: 21 },
              { label: 'Standard', value: 52 },
              { label: 'Premium', value: 18 },
            ]}
          />
          <figure className="fig">
            <figcaption className="fig__head">
              <span className="fig__title">{t('გასაახლებელი', 'Renewals due')}</span>
              <span className="fig__meta">{t('აქტიური გამოწერები', 'active subscriptions')}</span>
            </figcaption>
            <div className="panel">
              <p className="notice"><span className="state state--fault">{t('ვადაგასული', 'Overdue')}</span><span className="num">7</span></p>
              <p className="notice"><span className="state state--standby">{t('7 დღეში', 'Within 7 days')}</span><span className="num">12</span></p>
              <p className="notice"><span className="state state--ok">{t('30 დღეში', 'Within 30 days')}</span><span className="num">38</span></p>
              <p className="notice"><span className="state state--ok">{t('მოგვიანებით', 'Later')}</span><span className="num">34</span></p>
            </div>
          </figure>
        </div>
      </main>
    </div>
  );
}
