import { beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { ANON, SERVICE, URL_, configured } from './env';

const EDITOR = { email: 'editor@televizio.ge', password: 'test-password-1' };

describe.skipIf(!configured)('publish', () => {
  beforeAll(async () => {
    const admin = createClient(URL_!, SERVICE!);
    const { data } = await admin.auth.admin.createUser({
      email: EDITOR.email, password: EDITOR.password, email_confirm: true,
    });
    let id = data?.user?.id;
    if (!id) {
      const { data: found } = await admin.auth.admin.listUsers();
      id = found.users.find((u) => u.email === EDITOR.email)?.id;
    }
    if (id) {
      await admin.from('admins').upsert({
        id, email: EDITOR.email, name: 'Editor', role: 'editor',
      });
    }
  });

  async function editorToken() {
    const db = createClient(URL_!, ANON!);
    const { data, error } = await db.auth.signInWithPassword(EDITOR);
    if (error) throw error;
    return data.session!.access_token;
  }

  async function publish(token?: string) {
    return fetch(`${URL_}/functions/v1/publish`, {
      method: 'POST',
      headers: {
        apikey: ANON!,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  it('refuses a caller with no session', async () => {
    expect((await publish()).status).toBe(403);
  });

  it('writes a snapshot for an editor', async () => {
    const res = await publish(await editorToken());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channel_count).toBe(13);
    expect(body.plan_count).toBe(3);
    expect(body.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('puts the document where the site will look for it', async () => {
    const res = await fetch(`${URL_}/storage/v1/object/public/site/content.json`);
    expect(res.status).toBe(200);
    const snap = await res.json();
    expect(snap.version).toBe(1);
    expect(snap.channels).toHaveLength(13);
    expect(snap.channels[0].slug).toBe('1tv');
    expect(snap.plans.map((p: { slug: string }) => p.slug))
      .toEqual(['basic', 'standard', 'premium']);
  });

  it('records the publish in the history', async () => {
    const admin = createClient(URL_!, SERVICE!);
    const { data } = await admin.from('publications').select('*');
    expect(data!.length).toBeGreaterThan(0);
  });

  it('refuses and explains when a channel has no logo', async () => {
    const admin = createClient(URL_!, SERVICE!);
    await admin.from('channels').update({ logo_path: null }).eq('slug', 'cnn');
    try {
      const res = await publish(await editorToken());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.problems[0].slug).toBe('cnn');
    } finally {
      // Put it back whatever happened — this runs against the real project.
      await admin.from('channels')
        .update({ logo_path: 'channels/cnn.png' }).eq('slug', 'cnn');
    }
  });
});
