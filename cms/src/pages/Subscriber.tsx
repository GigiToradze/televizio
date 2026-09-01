import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useLang } from '../lang/LangProvider';
import {
  currentSubscription, useAddPayment, useRenew, useSubscriber,
  type SubscriptionRecord,
} from '../lib/subscribers';
import {
  daysLeft, isPeriodPaid, nextDueDate, subscriptionState,
} from '../../../supabase/functions/_shared/subscription';
import SubscriberDrawer from './SubscriberDrawer';

function Money({ amount }: { amount: number }) {
  return <span className="num">{amount}₾</span>;
}

function Renew({
  subscription, subscriberId, today,
}: {
  subscription: SubscriptionRecord; subscriberId: string; today: string;
}) {
  const { admin } = useAuth();
  const renew = useRenew();
  const { t } = useLang();
  const [amount, setAmount] = useState(subscription.price_at_signup);
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState<string | null>(null);

  const to = nextDueDate(subscription.due_on, today);

  return (
    <div className="renew">
      <div>
        <span className="eyebrow">{t('განახლება თარიღამდე', 'Renew to')}</span>
        <p className="renew__date">{to}</p>
        <p className="note">
          {t('ითვლება მიმდინარე ვადიდან, და არა დღევანდელი დღიდან.', 'Counted from the current due date, not from today.')}
        </p>
      </div>
      <label className="label">
        <span className="eyebrow">{t('აღებული თანხა', 'Amount taken')}</span>
        <input className="field field--mono" type="number" value={amount}
               onChange={(e) => setAmount(+e.target.value)} />
      </label>
      <label className="label">
        <span className="eyebrow">{t('მეთოდი', 'Method')}</span>
        <select className="field" value={method}
                onChange={(e) => setMethod(e.target.value)}>
          <option value="cash">cash</option>
          <option value="transfer">transfer</option>
          <option value="card">card</option>
          <option value="other">other</option>
        </select>
      </label>
      <button
        className="btn btn--signal btn--sm"
        disabled={renew.isPending}
        onClick={async () => {
          setError(null);
          try {
            await renew.mutateAsync({
              subscription, subscriber_id: subscriberId,
              amount, method, recorded_by: admin?.id ?? null, today,
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        {renew.isPending ? t('ახლდება', 'Renewing') : t('განახლება', 'Renew')}
      </button>
      {error && <p className="error span-all">{error}</p>}
    </div>
  );
}

export default function Subscriber() {
  const { id } = useParams();
  const { t } = useLang();
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'subscribers');
  const subscriber = useSubscriber(id);
  const addPayment = useAddPayment();
  const [editing, setEditing] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (subscriber.isLoading) return <p className="eyebrow">{t('იტვირთება', 'Loading')}</p>;
  if (subscriber.error) return <p className="error">{String(subscriber.error)}</p>;
  const s = subscriber.data!;

  const current = currentSubscription(s);
  const state = current ? subscriptionState(current, today) : null;
  const payments = [...s.subscriptions.flatMap((x) => x.payments)]
    .sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  const unpaid = current && !isPeriodPaid(current, current.payments);

  return (
    <section style={{ maxWidth: 940 }}>
      <div className="head">
        <Link className="eyebrow" to="/subscribers">{t('← აბონენტები', '← Subscribers')}</Link>
      </div>

      <div className="head">
        <h1 className="head__title">{s.full_name}</h1>
        <span className="num head__count">{s.subscriber_no}</span>
        {s.status !== 'active' && (
          <span className="state state--fault">{s.status}</span>
        )}
        {editable && (
          <div className="head__right">
            <button className="btn btn--sm" onClick={() => setEditing(true)}>{t('რედაქტირება', 'Edit')}</button>
          </div>
        )}
      </div>

      <div className="figures">
        <div className="figure">
          <span className="figure__value">
            {current ? daysLeft(current.due_on, today) : '—'}
          </span>
          <span className="eyebrow">{t('დარჩენილი დღე', 'Days left')}</span>
          <span className="figure__meta">
            {current ? t(`ვადა ${current.due_on}`, `due ${current.due_on}`) : t('გამოწერა არ არის', 'no subscription')}
          </span>
        </div>
        <div className="figure">
          <span className="figure__value figure__value--sm">
            {current?.plans?.name_en ?? '—'}
          </span>
          <span className="eyebrow">{t('პაკეტი', 'Plan')}</span>
          <span className="figure__meta">
            {current ? t(`${current.price_at_signup}₾ · ${current.device_count} მოწყობილობა`, `${current.price_at_signup}₾ · ${current.device_count} device${current.device_count === 1 ? '' : 's'}`) : ''}
          </span>
        </div>
        <div className="figure">
          <span className="figure__value figure__value--sm">
            {state ?? 'none'}
          </span>
          <span className="eyebrow">{t('სტატუსი', 'State')}</span>
          <span className="figure__meta">
            {unpaid ? t('ეს პერიოდი გადაუხდელია', 'this period is unpaid') : t('ეს პერიოდი გადახდილია', 'this period is paid')}
          </span>
        </div>
      </div>

      <div className="head head--sub">
        <h2 className="head__title">{t('კონტაქტი', 'Contact')}</h2>
      </div>
      <div className="panel">
        <div className="setting">
          <span className="eyebrow setting__key">{t('ტელეფონი', 'Phone')}</span>
          <span className="num">{s.phone}</span>
          <span className="note">{t(`ბოლო ოთხი: ${s.phone_last4} — შემოწმებისთვის`, `last four: ${s.phone_last4} — used by the lookup`)}</span>
        </div>
        <div className="setting">
          <span className="eyebrow setting__key">{t('ელფოსტა', 'Email')}</span>
          <span className="num">{s.email || '—'}</span>
          <span className="note" />
        </div>
        <div className="setting">
          <span className="eyebrow setting__key">{t('მისამართი', 'Address')}</span>
          <span>{[s.address, s.city].filter(Boolean).join(', ') || '—'}</span>
          <span className="note" />
        </div>
        {s.notes && (
          <div className="setting">
            <span className="eyebrow setting__key">{t('შენიშვნები', 'Notes')}</span>
            <span>{s.notes}</span>
            <span className="note" />
          </div>
        )}
      </div>

      {current && editable && (
        <>
          <div className="head head--sub">
            <h2 className="head__title">{t('განახლება', 'Renew')}</h2>
          </div>
          <div className="panel">
            <Renew subscription={current} subscriberId={s.id} today={today} />
          </div>
        </>
      )}

      <div className="head head--sub">
        <h2 className="head__title">{t('გამოწერები', 'Subscriptions')}</h2>
        <span className="head__count">{s.subscriptions.length}</span>
      </div>
      <div className="panel panel--table">
        <table className="rows">
          <thead>
            <tr><th>{t('პაკეტი','Plan')}</th><th>{t('დაიწყო','Started')}</th><th>{t('ვადა','Due')}</th><th>{t('მოწყობილობა','Devices')}</th>
                <th>{t('ფასი','Price')}</th><th>{t('სტატუსი','Status')}</th></tr>
          </thead>
          <tbody>
            {[...s.subscriptions]
              .sort((a, b) => b.due_on.localeCompare(a.due_on))
              .map((x) => (
                <tr key={x.id}>
                  <td>{x.plans?.name_en ?? '—'}</td>
                  <td><span className="num">{x.started_on}</span></td>
                  <td><span className="num">{x.due_on}</span></td>
                  <td><span className="num">{x.device_count}</span></td>
                  <td><Money amount={x.price_at_signup} /></td>
                  <td><span className="state state--ok">{x.status}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
        {s.subscriptions.length === 0 && (
          <p className="notice">
            <span className="state state--standby">{t('არაფერი','None')}</span>
            {t('ამ აბონენტს ჯერ გამოწერა არ აქვს.', 'This subscriber has no subscription yet.')}
          </p>
        )}
      </div>

      <div className="head head--sub">
        <h2 className="head__title">{t('გადახდები', 'Payments')}</h2>
        <span className="head__count">{payments.length}</span>
        {current && editable && (
          <div className="head__right">
            <button
              className="btn btn--sm"
              disabled={addPayment.isPending}
              onClick={() => addPayment.mutate({
                subscription_id: current.id,
                subscriber_id: s.id,
                amount: current.price_at_signup,
                paid_on: today,
                method: 'cash',
                recorded_by: admin?.id ?? null,
              })}
            >
              {t('გადახდის ჩაწერა', 'Record payment')}
            </button>
          </div>
        )}
      </div>
      <div className="panel panel--table">
        <table className="rows">
          <thead>
            <tr><th>{t('თარიღი','Paid on')}</th><th>{t('თანხა','Amount')}</th><th>{t('მეთოდი','Method')}</th><th>{t('შენიშვნა','Note')}</th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td><span className="num">{p.paid_on}</span></td>
                <td><Money amount={p.amount} /></td>
                <td><span className="tag">{p.method}</span></td>
                <td className="name-ka">{p.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <p className="notice">
            <span className="state state--standby">{t('არაფერი','None')}</span>
            {t('ამ ანგარიშზე ჯერ არაფერია ჩაწერილი.', 'Nothing recorded against this account yet.')}
          </p>
        )}
      </div>

      {editing && (
        <SubscriberDrawer subscriber={s} onClose={() => setEditing(false)} />
      )}
    </section>
  );
}
