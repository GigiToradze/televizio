import { beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { ANON, SERVICE, URL_, configured } from './env';

describe.skipIf(!configured)('create-admin', () => {
  // The suite makes its own owner and editor rather than relying on whoever
  // happens to be in the database.
  beforeAll(async () => {
    const admin = createClient(URL_!, SERVICE!);
    for (const [email, role] of [
      ['owner@televizio.ge', 'owner'],
      ['editor@televizio.ge', 'editor'],
    ] as const) {
      const { data } = await admin.auth.admin.createUser({
        email, password: 'test-password-1', email_confirm: true,
      });
      let id = data?.user?.id;
      if (!id) {
        const { data: found } = await admin.auth.admin.listUsers();
        id = found.users.find((u) => u.email === email)?.id;
      }
      if (id) await admin.from('admins').upsert({ id, email, name: role, role });
    }
  });

  async function tokenFor(email: string, password: string) {
    const db = createClient(URL_!, ANON!);
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session!.access_token;
  }

  async function call(token: string | undefined, body: unknown) {
    return fetch(`${URL_}/functions/v1/create-admin`, {
      method: 'POST',
      headers: {
        apikey: ANON!,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it('refuses an anonymous caller', async () => {
    const res = await call(undefined, { email: 'x@y.z', name: 'X', role: 'editor' });
    expect(res.status).toBe(403);
  });

  it('refuses an editor — only an owner provisions admins', async () => {
    const token = await tokenFor('editor@televizio.ge', 'test-password-1');
    const res = await call(token, { email: 'x@y.z', name: 'X', role: 'editor' });
    expect(res.status).toBe(403);
  });

  it('rejects a role that is not one of the three', async () => {
    const token = await tokenFor('owner@televizio.ge', 'test-password-1');
    const res = await call(token, { email: 'y@z.z', name: 'Y', role: 'superuser' });
    expect(res.status).toBe(400);
  });

  it('creates an admin for an owner', async () => {
    const token = await tokenFor('owner@televizio.ge', 'test-password-1');
    const email = `support-${Date.now()}@televizio.ge`;
    const res = await call(token, { email, name: 'Support', role: 'support' });
    expect(res.status).toBe(200);

    const admin = createClient(URL_!, SERVICE!);
    const { data } = await admin.from('admins').select('role').eq('email', email).single();
    expect(data!.role).toBe('support');
  });
});
