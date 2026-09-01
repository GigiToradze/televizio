import { useState } from 'react';
import { usePlans } from '../lib/queries';
import {
  useSaveSubscriber, useSaveSubscription, type SubscriberRecord,
} from '../lib/subscribers';
import { addMonths } from '../../../supabase/functions/_shared/subscription';

const BLANK = {
  subscriber_no: '', full_name: '', phone: '',
  email: '', address: '', city: '', notes: '',
  status: 'active' as const,
};

export default function SubscriberDrawer({
  subscriber, onClose,
}: {
  subscriber: SubscriberRecord | null;
  onClose: () => void;
}) {
  const plans = usePlans();
  const saveSubscriber = useSaveSubscriber();
  const saveSubscription = useSaveSubscription();

  const [form, setForm] = useState(
    subscriber
      ? {
          subscriber_no: subscriber.subscriber_no,
          full_name: subscriber.full_name,
          phone: subscriber.phone,
          email: subscriber.email ?? '',
          address: subscriber.address ?? '',
          city: subscriber.city ?? '',
          notes: subscriber.notes ?? '',
          status: subscriber.status,
        }
      : { ...BLANK },
  );

  // A new subscriber with no subscription is not a useful record, so the
  // first one is part of the same form.
  const today = new Date().toISOString().slice(0, 10);
  const [sub, setSub] = useState({
    plan_id: '', started_on: today, due_on: addMonths(today, 1), device_count: 1,
  });

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isNew = !subscriber;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isNew && !sub.plan_id) { setError('Pick a plan for the first subscription.'); return; }

    setBusy(true);
    try {
      const id = await saveSubscriber.mutateAsync(
        subscriber ? { id: subscriber.id, ...form } : form,
      );

      if (isNew) {
        const plan = (plans.data ?? []).find((p) => p.id === sub.plan_id);
        await saveSubscription.mutateAsync({
          subscriber_id: id,
          plan_id: sub.plan_id,
          started_on: sub.started_on,
          due_on: sub.due_on,
          device_count: sub.device_count,
          price_at_signup: plan?.price ?? 0,
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form className="drawer" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="eyebrow">{isNew ? 'New subscriber' : 'Edit subscriber'}</p>
          <h2 className="drawer__title">{form.full_name || 'Untitled'}</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="label">
            <span className="eyebrow">Subscriber number</span>
            <input className="field field--mono" required value={form.subscriber_no}
                   onChange={(e) => set('subscriber_no', e.target.value.trim())} />
          </label>
          <label className="label">
            <span className="eyebrow">Phone</span>
            <input className="field field--mono" required value={form.phone}
                   placeholder="+995 555 12 34 56"
                   onChange={(e) => set('phone', e.target.value)} />
          </label>
        </div>
        <p className="note">
          The last four digits of this number are what the customer types on the
          lookup page, so keep it the number they actually use.
        </p>

        <label className="label">
          <span className="eyebrow">Full name</span>
          <input className="field" required value={form.full_name}
                 onChange={(e) => set('full_name', e.target.value)} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="label">
            <span className="eyebrow">Email</span>
            <input className="field" type="email" value={form.email}
                   onChange={(e) => set('email', e.target.value)} />
          </label>
          <label className="label">
            <span className="eyebrow">City</span>
            <input className="field" value={form.city}
                   onChange={(e) => set('city', e.target.value)} />
          </label>
        </div>

        <label className="label">
          <span className="eyebrow">Address</span>
          <input className="field" value={form.address}
                 onChange={(e) => set('address', e.target.value)} />
        </label>

        <label className="label">
          <span className="eyebrow">Notes</span>
          <textarea className="field" rows={2} value={form.notes}
                    onChange={(e) => set('notes', e.target.value)} />
        </label>

        <label className="label">
          <span className="eyebrow">Account status</span>
          <select className="field" value={form.status}
                  onChange={(e) => set('status', e.target.value as typeof form.status)}>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>

        {isNew && (
          <>
            <div className="drawer__rule">
              <span className="eyebrow">First subscription</span>
            </div>

            <label className="label">
              <span className="eyebrow">Plan</span>
              <select className="field" value={sub.plan_id}
                      onChange={(e) => setSub({ ...sub, plan_id: e.target.value })}>
                <option value="">Pick a plan</option>
                {(plans.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name_en} — {p.price}₾
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <label className="label">
                <span className="eyebrow">Started</span>
                <input className="field field--mono" type="date" value={sub.started_on}
                       onChange={(e) => setSub({
                         ...sub,
                         started_on: e.target.value,
                         due_on: addMonths(e.target.value, 1),
                       })} />
              </label>
              <label className="label">
                <span className="eyebrow">Due</span>
                <input className="field field--mono" type="date" value={sub.due_on}
                       onChange={(e) => setSub({ ...sub, due_on: e.target.value })} />
              </label>
              <label className="label">
                <span className="eyebrow">Devices</span>
                <input className="field field--mono" type="number" min={1}
                       value={sub.device_count}
                       onChange={(e) => setSub({ ...sub, device_count: +e.target.value })} />
              </label>
            </div>
            <p className="note">
              The due date follows the start date by one month. Change it if the
              customer is on a different cycle.
            </p>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div className="drawer__foot">
          <button type="submit" className="btn btn--signal btn--sm" disabled={busy}>
            {busy ? 'Saving' : isNew ? 'Add subscriber' : 'Save'}
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
