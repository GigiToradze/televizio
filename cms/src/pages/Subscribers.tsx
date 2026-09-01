import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import {
  currentSubscription, useSubscribers, type SubscriberRecord,
} from '../lib/subscribers';
import {
  subscriptionState, type SubscriptionState,
} from '../../../supabase/functions/_shared/subscription';
import SubscriberDrawer from './SubscriberDrawer';

const TONE: Record<SubscriptionState, string> = {
  active: 'state--ok',
  'due-soon': 'state--standby',
  overdue: 'state--fault',
  expired: 'state--fault',
  cancelled: 'state--ok',
};

const WORDS: Record<SubscriptionState, string> = {
  active: 'active',
  'due-soon': 'due soon',
  overdue: 'overdue',
  expired: 'expired',
  cancelled: 'cancelled',
};

export default function Subscribers() {
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'subscribers');
  const subscribers = useSubscribers();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (subscribers.isLoading) return <p className="eyebrow">Loading</p>;
  if (subscribers.error) return <p className="error">{String(subscribers.error)}</p>;

  const all = subscribers.data ?? [];
  const term = query.trim().toLowerCase();
  const rows = all.filter((s) =>
    !term ||
    s.subscriber_no.toLowerCase().includes(term) ||
    s.full_name.toLowerCase().includes(term) ||
    s.phone.replace(/\D/g, '').includes(term.replace(/\D/g, '')) ||
    (s.full_name.includes(query.trim())));

  const overdue = all.filter((s) => {
    const sub = currentSubscription(s);
    return sub && subscriptionState(sub, today) === 'overdue';
  }).length;

  return (
    <section>
      <div className="head">
        <h1 className="head__title">Subscribers</h1>
        <span className="head__count">
          {rows.length === all.length ? all.length : `${rows.length} of ${all.length}`}
          {overdue > 0 && <span className="state state--fault"> · {overdue} overdue</span>}
        </span>
        <div className="head__right">
          <input
            className="field field--mono" style={{ width: 210 }}
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Number, name or phone"
          />
          {editable && (
            <button className="btn btn--signal btn--sm" onClick={() => setAdding(true)}>
              Add subscriber
            </button>
          )}
        </div>
      </div>

      <div className="panel panel--table">
        <table className="grid">
          <thead>
            <tr>
              <th>Number</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Plan</th>
              <th>Due</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s: SubscriberRecord) => {
              const sub = currentSubscription(s);
              const state = sub ? subscriptionState(sub, today) : null;
              return (
                <tr key={s.id} className="is-clickable">
                  <td>
                    <Link className="num link" to={`/subscribers/${s.id}`}>
                      {s.subscriber_no}
                    </Link>
                  </td>
                  <td>{s.full_name}</td>
                  <td><span className="num">{s.phone}</span></td>
                  <td>{sub?.plans?.name_en ?? <span className="state state--standby">no plan</span>}</td>
                  <td>{sub ? <span className="num">{sub.due_on}</span> : '—'}</td>
                  <td>
                    {s.status !== 'active'
                      ? <span className="state state--fault">{s.status}</span>
                      : state
                        ? <span className={`state ${TONE[state]}`}>{WORDS[state]}</span>
                        : <span className="state state--standby">none</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {all.length === 0 && (
          <p className="notice">
            <span className="state state--standby">Empty</span>
            No subscribers yet. Add the first one to start keeping records.
          </p>
        )}
        {all.length > 0 && rows.length === 0 && (
          <p className="notice">
            <span className="state state--ok">Nothing found</span>
            No subscriber matches “{query}”.
          </p>
        )}
      </div>

      {adding && <SubscriberDrawer subscriber={null} onClose={() => setAdding(false)} />}
    </section>
  );
}
