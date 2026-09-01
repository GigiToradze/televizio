import { createClient } from 'jsr:@supabase/supabase-js@2';
import { json } from './cors.ts';

export type Caller = { id: string; role: string };

/** Resolve the bearer token to an admin, or hand back the refusal to return.
 *
 *  The role comes from the admins table rather than the JWT, so revoking
 *  someone takes effect immediately instead of when their token expires.
 */
export async function requireAdmin(
  req: Request,
  allowed: string[],
): Promise<Caller | Response> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'forbidden' }, 403);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: user } = await admin.auth.getUser(token);
  if (!user?.user) return json({ error: 'forbidden' }, 403);

  const { data: row } = await admin
    .from('admins').select('id, role').eq('id', user.user.id).maybeSingle();

  if (!row || !allowed.includes(row.role)) return json({ error: 'forbidden' }, 403);
  return { id: row.id, role: row.role };
}
