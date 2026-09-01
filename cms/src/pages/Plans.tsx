import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useLang } from '../lang/LangProvider';
import { useChannels, usePlans, useSavePlan, type PlanRecord } from '../lib/queries';

function PlanCard({ plan, editable }: { plan: PlanRecord; editable: boolean }) {
  const { t } = useLang();
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
      setStatus(t('შენახულია', 'Saved'));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  const live = (channels.data ?? []).filter((c) => c.is_active);

  return (
    <form className="panel plan" onSubmit={submit}>
      <div className="panel__head">
        <span className="eyebrow">{form.slug}</span>
        {form.is_featured && <span className="tag tag--primary">{t('გამორჩეული', 'featured')}</span>}
        <span className="plan__price">
          {form.price}<span className="plan__cur">₾</span>
        </span>
      </div>

      <div className="plan__body">
        <div className="pair">
          <label className="label">
            <span className="eyebrow">{t('სახელი — ქართულად', 'Name — Georgian')}</span>
            <input className="field" value={form.name_ka}
                   onChange={(e) => setForm({ ...form, name_ka: e.target.value })} />
          </label>
          <label className="label">
            <span className="eyebrow">{t('სახელი — ინგლისურად', 'Name — English')}</span>
            <input className="field" value={form.name_en}
                   onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          </label>
          <label className="label">
            <span className="eyebrow">{t('ფასი · ₾ თვეში', 'Price · ₾ per month')}</span>
            <input className="field field--mono" type="number" step="1" value={form.price}
                   onChange={(e) => setForm({ ...form, price: +e.target.value })} />
          </label>
          <label className="label">
            <span className="eyebrow">{t('ბარათზე ნაჩვენები რაოდენობა', 'Count on the card')}</span>
            <input className="field field--mono" value={form.total_label}
                   onChange={(e) => setForm({ ...form, total_label: e.target.value })} />
          </label>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={form.is_featured}
                 onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
          <span>{t('გამორჩეული — აწეული ბარათი წითელი ღილაკით', 'Featured — the raised card with the red button')}</span>
        </label>

        <div>
          <span className="eyebrow eyebrow--block">
            {t('მახასიათებლები', 'Features')}
          </span>
          <div className="stack-row">
            {features.map((f, i) => (
              <div key={i} className="line-row">
                <input className="field" value={f.text_ka} placeholder="Georgian"
                       onChange={(e) => {
                         const next = [...features];
                         next[i] = { ...f, text_ka: e.target.value };
                         setFeatures(next);
                       }} />
                <input className="field" value={f.text_en} placeholder="English"
                       onChange={(e) => {
                         const next = [...features];
                         next[i] = { ...f, text_en: e.target.value };
                         setFeatures(next);
                       }} />
                <button type="button" className="btn btn--quiet btn--sm"
                        aria-label="Remove this feature"
                        onClick={() => setFeatures(features.filter((_, x) => x !== i))}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--quiet btn--sm" style={{ marginTop: 'var(--s2)' }}
                  onClick={() => setFeatures([...features, { text_ka: '', text_en: '' }])}>
            {t('+ მახასიათებლის დამატება', '+ Add feature')}
          </button>
        </div>

        <div>
          <span className="eyebrow eyebrow--block">
            {t(`არხები — ${channelIds.length} / ${live.length}`, `Channels — ${channelIds.length} of ${live.length}`)}
          </span>
          <div className="wrap-row">
            {live.map((c) => {
              const on = channelIds.includes(c.id);
              return (
                <button
                  type="button" key={c.id}
                  className={`chip${on ? ' is-on' : ''}`}
                  onClick={() => setChannelIds(on
                    ? channelIds.filter((x) => x !== c.id)
                    : [...channelIds, c.id])}
                >
                  {c.slug}
                </button>
              );
            })}
          </div>
          {channelIds.length === 0 && (
            <p className="error error--spaced">
              {t('არხების გარეშე პაკეტი ვერ გამოქვეყნდება.', 'A plan with no channels cannot be published.')}
            </p>
          )}
        </div>
      </div>

      {editable && (
        <div className="panel__foot">
          <button type="submit" className="btn btn--signal btn--sm" disabled={save.isPending}>
            {save.isPending ? t('ინახება', 'Saving') : t('პაკეტის შენახვა', 'Save plan')}
          </button>
          {status && <span className="eyebrow">{status}</span>}
        </div>
      )}
    </form>
  );
}

export default function Plans() {
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'content');
  const plans = usePlans();
  const { t } = useLang();

  if (plans.isLoading) return <p className="eyebrow">{t('იტვირთება', 'Loading')}</p>;
  if (plans.error) return <p className="error">{String(plans.error)}</p>;

  return (
    <section>
      <div className="head">
        <h1 className="head__title">{t('პაკეტები', 'Plans')}</h1>
        <span className="head__count">{(plans.data ?? []).length}</span>
      </div>
      <p className="lede">
        {t('ფასების ბარათები და თითოეული პაკეტის არხები. საიტზე ბარათების რიგი აქაურ რიგს მიჰყვება.',
           'The pricing cards, and the channels each plan carries. The card order on the site follows the order here.')}
      </p>

      <div className="plans">
        {(plans.data ?? []).map((p) => (
          <PlanCard key={p.id} plan={p} editable={editable} />
        ))}
      </div>
    </section>
  );
}
