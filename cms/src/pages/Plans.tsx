import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useChannels, usePlans, useSavePlan, type PlanRecord } from '../lib/queries';

const field = 'w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ' +
              'ring-neutral-800 focus:outline-none focus:ring-red-600';

function PlanCard({ plan, editable }: { plan: PlanRecord; editable: boolean }) {
  const channels = useChannels();
  const save = useSavePlan();
  const [form, setForm] = useState(plan);
  const [features, setFeatures] = useState(
    [...plan.plan_features].sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => ({ text_ka: f.text_ka, text_en: f.text_en })),
  );
  const [channelIds, setChannelIds] = useState(
    plan.plan_channels.map((c) => c.channel_id),
  );
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { setForm(plan); }, [plan]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const { plan_features: _f, plan_channels: _c, ...row } = form;
    try {
      await save.mutateAsync({ plan: row, features, channelIds });
      setStatus('Saved');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded ring-1 ring-neutral-800 p-4">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold">{form.name_en}</h2>
        <span className="text-xs text-neutral-600">{form.slug}</span>
        {form.is_featured && (
          <span className="rounded bg-red-600 px-1.5 text-[10px]">featured</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 block">
          <span className="text-xs text-neutral-500">Name (Georgian)</span>
          <input className={field} value={form.name_ka}
                 onChange={(e) => setForm({ ...form, name_ka: e.target.value })} />
        </label>
        <label className="space-y-1 block">
          <span className="text-xs text-neutral-500">Name (English)</span>
          <input className={field} value={form.name_en}
                 onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        </label>
        <label className="space-y-1 block">
          <span className="text-xs text-neutral-500">Price</span>
          <input className={field} type="number" step="1" value={form.price}
                 onChange={(e) => setForm({ ...form, price: +e.target.value })} />
        </label>
        <label className="space-y-1 block">
          <span className="text-xs text-neutral-500">
            Channel count shown on the card
          </span>
          <input className={field} value={form.total_label}
                 onChange={(e) => setForm({ ...form, total_label: e.target.value })} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_featured}
               onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
        Featured — the raised card with the red button
      </label>

      <div className="space-y-2">
        <span className="text-xs text-neutral-500">Features</span>
        {features.map((f, i) => (
          <div key={i} className="flex gap-2">
            <input className={field} value={f.text_ka} placeholder="Georgian"
                   onChange={(e) => {
                     const next = [...features];
                     next[i] = { ...f, text_ka: e.target.value };
                     setFeatures(next);
                   }} />
            <input className={field} value={f.text_en} placeholder="English"
                   onChange={(e) => {
                     const next = [...features];
                     next[i] = { ...f, text_en: e.target.value };
                     setFeatures(next);
                   }} />
            <button type="button" className="px-2 text-neutral-500"
                    onClick={() => setFeatures(features.filter((_, x) => x !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="text-xs text-neutral-400"
                onClick={() => setFeatures([...features, { text_ka: '', text_en: '' }])}>
          + Add a feature
        </button>
      </div>

      <div className="space-y-2">
        <span className="text-xs text-neutral-500">
          Channels in this plan — {channelIds.length} of {channels.data?.length ?? 0}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(channels.data ?? []).map((c) => {
            const on = channelIds.includes(c.id);
            return (
              <button
                type="button" key={c.id}
                onClick={() => setChannelIds(on
                  ? channelIds.filter((x) => x !== c.id)
                  : [...channelIds, c.id])}
                className={`rounded px-2 py-1 text-xs ring-1 ${
                  on ? 'bg-red-600 ring-red-600' : 'ring-neutral-800 text-neutral-400'}`}
              >
                {c.name_en}
              </button>
            );
          })}
        </div>
      </div>

      {editable && (
        <div className="flex items-center gap-3">
          <button type="submit" disabled={save.isPending}
                  className="rounded bg-red-600 px-3 py-2 text-sm font-medium
                             disabled:opacity-50">
            {save.isPending ? 'Saving…' : 'Save plan'}
          </button>
          {status && <span className="text-xs text-neutral-500">{status}</span>}
        </div>
      )}
    </form>
  );
}

export default function Plans() {
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'content');
  const plans = usePlans();

  if (plans.isLoading) return <p className="text-neutral-500">Loading…</p>;
  if (plans.error) return <p className="text-red-500">{String(plans.error)}</p>;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Plans</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        {(plans.data ?? []).map((p) => (
          <PlanCard key={p.id} plan={p} editable={editable} />
        ))}
      </div>
    </section>
  );
}
