import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { ANON, SERVICE, URL_, configured } from './env';

/* End-to-end proofs for the public lookup. These need a deployed function
   and credentials; the rules themselves are covered without either in
   tests/shared/lookup.test.ts. */

const NO = `TAP-${Date.now()}`;
const PHONE = '+995 555 12 34 78';

describe.skipIf(!configured)('lookup', () => {
  let subscriberId: string | null = null;

  beforeAll(async () => {
    const admin = createClient(URL_!, SERVICE!);
    const { data } = await admin.from('subscribers')
      .insert({ subscriber_no: NO, full_name: 'Lookup Test', phone: PHONE })
      .select('id').single();
    subscriberId = data?.id ?? null;

    // Start from a clean slate so an earlier run's failures do not trip the
    // rate limit before these tests get going.
    await admin.from('lookup_attempts').delete().gte('created_at', '1970-01-01');
  });

  afterAll(async () => {
    const admin = createClient(URL_!, SERVICE!);
    if (subscriberId) await admin.from('subscribers').delete().eq('id', subscriberId);
    await admin.from('lookup_attempts').delete().gte('created_at', '1970-01-01');
  });

  const call = (body: unknown) =>
    fetch(`${URL_}/functions/v1/lookup`, {
      method: 'POST',
      headers: { apikey: ANON!, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('cannot be used to discover which numbers exist', async () => {
    const unknown = await call({ subscriber_no: 'TAP-does-not-exist', phone_last4: '0000' });
    const wrongDigits = await call({ subscriber_no: NO, phone_last4: '0000' });

    expect(unknown.status).toBe(wrongDigits.status);
    expect(await unknown.text()).toBe(await wrongDigits.text());
  });

  it('answers a correct pair', async () => {
    const res = await call({ subscriber_no: NO, phone_last4: '3478' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscriber_no).toBe(NO);
    expect(body.status).toBe('none');   // created without a subscription
  });

  it('returns nothing personal', async () => {
    const body = await (await call({ subscriber_no: NO, phone_last4: '3478' })).json();
    const text = JSON.stringify(body);
    expect(text).not.toContain('995');
    expect(text).not.toContain('Lookup Test');
    for (const k of ['phone', 'phone_last4', 'email', 'address', 'notes', 'id']) {
      expect(Object.keys(body)).not.toContain(k);
    }
  });

  it('rate limits after five failures from one address', async () => {
    for (let i = 0; i < 5; i++) {
      await call({ subscriber_no: NO, phone_last4: '0001' });
    }
    const sixth = await call({ subscriber_no: NO, phone_last4: '3478' });
    expect(sixth.status).toBe(429);
  });
});
