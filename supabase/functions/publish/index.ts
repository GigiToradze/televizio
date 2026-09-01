import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildSnapshot } from '../_shared/snapshot.ts';
import { validateContent } from '../_shared/validate.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { cors, json } from '../_shared/cors.ts';
import type { SnapshotInput } from '../_shared/types.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const caller = await requireAdmin(req, ['owner', 'editor']);
  if (caller instanceof Response) return caller;

  const db = createClient(URL_, SERVICE);

  const [cats, chans, plans, settings] = await Promise.all([
    db.from('categories').select('slug, name_ka, name_en, sort_order'),
    db.from('channels').select(
      `slug, name_ka, name_en, logo_path, logo_w, logo_h, sort_order,
       in_slider, slider_order,
       channel_categories ( sort_order, categories ( slug ) ),
       plan_channels ( plans ( slug, is_active ) )`,
    ).eq('is_active', true),
    db.from('plans').select(
      `slug, name_ka, name_en, price, currency, period_ka, period_en,
       badge_ka, badge_en, is_featured, total_label, sort_order,
       plan_features ( text_ka, text_en, sort_order )`,
    ).eq('is_active', true),
    db.from('site_settings').select('key, value_text, value_num'),
  ]);

  const failed = [cats, chans, plans, settings].find((r) => r.error);
  if (failed) return json({ error: failed.error!.message }, 500);

  // A channel may be linked to a plan that has since been deactivated; the
  // snapshot must not advertise it.
  const activePlans = new Set((plans.data ?? []).map((p) => p.slug));

  const input: SnapshotInput = {
    logoBaseUrl: `${URL_}/storage/v1/object/public/logos/`,
    categories: cats.data ?? [],
    channels: (chans.data ?? []).map((c) => ({
      slug: c.slug, name_ka: c.name_ka, name_en: c.name_en,
      logo_path: c.logo_path, logo_w: c.logo_w, logo_h: c.logo_h,
      sort_order: c.sort_order, in_slider: c.in_slider, slider_order: c.slider_order,
      cats: (c.channel_categories ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((cc) => cc.categories.slug),
      plans: (c.plan_channels ?? [])
        .map((pc) => pc.plans.slug)
        .filter((slug: string) => activePlans.has(slug)),
    })),
    plans: (plans.data ?? []).map((p) => ({
      ...p,
      features: (p.plan_features ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((f) => ({ ka: f.text_ka, en: f.text_en })),
    })),
    settings: settings.data ?? [],
  };

  const problems = validateContent(input);
  if (problems.length) return json({ problems }, 400);

  const publishedAt = new Date().toISOString();
  const snapshot = buildSnapshot(input, publishedAt);
  const body = JSON.stringify(snapshot);

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const hash = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  const up = await db.storage.from('site').upload('content.json', body, {
    contentType: 'application/json',
    cacheControl: '60',       // short: a publish should show up within a minute
    upsert: true,
  });
  if (up.error) return json({ error: up.error.message }, 500);

  await db.from('publications').insert({
    published_by: caller.id,
    snapshot_hash: hash,
    channel_count: snapshot.channels.length,
    plan_count: snapshot.plans.length,
  });

  await db.from('audit_log').insert({
    admin_id: caller.id, action: 'publish', entity: 'snapshot', entity_id: hash,
  });

  return json({
    published_at: publishedAt,
    channel_count: snapshot.channels.length,
    plan_count: snapshot.plans.length,
    hash,
  });
});
