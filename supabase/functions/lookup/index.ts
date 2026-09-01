import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';
import {
  MAX_FAILURES, REFUSED, WINDOW_MINUTES, overLimit, parseRequest, summarise,
} from '../_shared/lookup.ts';

/* The public subscription lookup.
 *
 * The browser never queries a subscriber table — anon has no privilege on
 * one at all. This runs with the service key and hands back nine fields.
 *
 * Every refusal returns the same body and the same status, so the form
 * cannot be used to find out which subscriber numbers exist. Timing is not
 * equalised; someone measuring microseconds could still distinguish the two
 * paths, which the rate limit is there to make expensive rather than
 * impossible.
 */

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** No raw IP is stored. Salting with the UTC date means the identifier
 *  stops correlating at midnight, which is all a daily rate limit needs. */
async function hashIp(ip: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(`${ip}|${day}`),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
  const ipHash = await hashIp(ip);

  const db = createClient(URL_, SERVICE);

  // Counted before the subscriber table is touched at all, so a caller who
  // is over the limit cannot make the database do work.
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await db
    .from('lookup_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('success', false)
    .gte('created_at', since);

  if (overLimit(count ?? 0)) {
    return json({ error: 'too_many', retry_after_minutes: WINDOW_MINUTES }, 429);
  }

  const { subscriberNo, digits, valid } = parseRequest(
    await req.json().catch(() => null),
  );

  const log = (success: boolean) =>
    db.from('lookup_attempts').insert({
      subscriber_no_attempted: subscriberNo || null,
      ip_hash: ipHash,
      success,
    });

  if (!valid) {
    await log(false);
    return json(REFUSED, 404);
  }

  const { data: subscriber } = await db
    .from('subscribers')
    .select('id, subscriber_no, phone_last4, status')
    .eq('subscriber_no', subscriberNo)
    .maybeSingle();

  if (!subscriber || subscriber.phone_last4 !== digits) {
    await log(false);
    return json(REFUSED, 404);
  }

  const { data: current } = await db
    .from('subscriptions')
    .select('started_on, due_on, status, device_count, plans ( name_ka, name_en )')
    .eq('subscriber_id', subscriber.id)
    .order('due_on', { ascending: false })
    .limit(1)
    .maybeSingle();

  await log(true);

  const today = new Date().toISOString().slice(0, 10);
  return json(summarise(
    { subscriber_no: subscriber.subscriber_no, status: subscriber.status },
    current
      ? {
          started_on: current.started_on,
          due_on: current.due_on,
          status: current.status,
          device_count: current.device_count,
          plan_name_ka: current.plans?.name_ka ?? null,
          plan_name_en: current.plans?.name_en ?? null,
        }
      : null,
    today,
  ));
});
