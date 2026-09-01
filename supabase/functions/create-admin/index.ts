import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/auth.ts';
import { cors, json } from '../_shared/cors.ts';

const ROLES = ['owner', 'editor', 'support'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const caller = await requireAdmin(req, ['owner']);
  if (caller instanceof Response) return caller;

  const { email, name, role } = await req.json().catch(() => ({}));
  if (!email || !name || !ROLES.includes(role)) {
    return json({ error: 'email, name and a role of owner/editor/support are required' }, 400);
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // An invite rather than a password: the new admin sets their own, and no
  // password is ever typed into this form or sent over it.
  const { data, error } = await db.auth.admin.inviteUserByEmail(email);
  if (error || !data.user) return json({ error: error?.message ?? 'invite failed' }, 400);

  const { error: rowError } = await db.from('admins')
    .insert({ id: data.user.id, email, name, role });
  if (rowError) return json({ error: rowError.message }, 400);

  await db.from('audit_log').insert({
    admin_id: caller.id, action: 'create', entity: 'admin', entity_id: data.user.id,
    diff: { email, name, role },
  });

  return json({ id: data.user.id });
});
