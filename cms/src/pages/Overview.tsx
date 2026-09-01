import { Link } from 'react-router-dom';
import {
  useChannels, useLastPublication, usePendingChanges, usePlans,
} from '../lib/queries';

/** What the site is currently carrying, and anything that would stop it
 *  being published. The same two conditions the publish endpoint refuses on,
 *  surfaced before you press the button rather than after.
 *
 *  Visitor and subscription figures join this later; they need tables that
 *  do not exist yet. */
export default function Overview() {
  const channels = useChannels();
  const plans = usePlans();
  const last = useLastPublication();
  const pending = usePendingChanges(last.data?.published_at ?? null);

  if (channels.isLoading || plans.isLoading) {
    return <p className="eyebrow">Loading</p>;
  }
  if (channels.error) return <p className="error">{String(channels.error)}</p>;

  const live = (channels.data ?? []).filter((c) => c.is_active);
  const activePlans = (plans.data ?? []).filter((p) => p.is_active);

  const noLogo = live.filter((c) => !c.logo_path || !c.logo_w || !c.logo_h);
  const emptyPlans = activePlans.filter((p) => p.plan_channels.length === 0);
  const unpublished = pending.data ?? 0;

  const figures = [
    { label: 'Channels live', value: live.length,
      meta: `${(channels.data ?? []).length - live.length} inactive`, to: '/channels' },
    { label: 'In the strip', value: live.filter((c) => c.in_slider).length,
      meta: 'header marquee', to: '/slider' },
    { label: 'Plans', value: activePlans.length,
      meta: activePlans.map((p) => p.name_en).join(' · '), to: '/plans' },
  ];

  return (
    <section>
      <div className="head">
        <h1 className="head__title">Overview</h1>
      </div>

      <div className="figures">
        {figures.map((f) => (
          <Link key={f.label} to={f.to} className="figure">
            <span className="figure__value">{f.value}</span>
            <span className="eyebrow">{f.label}</span>
            <span className="figure__meta">{f.meta}</span>
          </Link>
        ))}
      </div>

      <div className="head" style={{ marginTop: 28 }}>
        <h2 className="head__title" style={{ fontSize: '1rem' }}>Attention</h2>
      </div>

      <div className="panel">
        {noLogo.length === 0 && emptyPlans.length === 0 && unpublished === 0 && (
          <p className="notice">
            <span className="state state--ok">Clear</span>
            Everything is published and nothing is missing.
          </p>
        )}

        {noLogo.length > 0 && (
          <Link to="/channels" className="notice notice--link">
            <span className="state state--fault">Blocks publish</span>
            {noLogo.length} channel{noLogo.length === 1 ? '' : 's'} without a usable
            logo — {noLogo.map((c) => c.slug).join(', ')}
          </Link>
        )}

        {emptyPlans.length > 0 && (
          <Link to="/plans" className="notice notice--link">
            <span className="state state--fault">Blocks publish</span>
            {emptyPlans.length} plan{emptyPlans.length === 1 ? '' : 's'} carrying no
            channels — {emptyPlans.map((p) => p.slug).join(', ')}
          </Link>
        )}

        {unpublished > 0 && (
          <p className="notice">
            <span className="state state--standby">Queued</span>
            {unpublished} change{unpublished === 1 ? '' : 's'} saved but not yet on
            the live site.
          </p>
        )}
      </div>
    </section>
  );
}
