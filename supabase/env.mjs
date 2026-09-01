/* Resolves Supabase credentials from the environment.
 *
 * Accepts two naming schemes: the ones in .env.example, and the ones the
 * Vercel–Supabase integration writes (which `vercel env pull` brings down).
 * Whichever is present wins, so either route works without editing scripts.
 */

// `vercel env pull` writes the literal text [SENSITIVE] for any variable
// marked sensitive in Vercel — those are write-only and never come back.
// Treat such a value as absent rather than trying to authenticate with it.
const PLACEHOLDERS = ['FILL_ME', 'YOUR', '[SENSITIVE]'];

const FIRST = (...names) => {
  for (const n of names) {
    const v = process.env[n];
    if (v && !PLACEHOLDERS.some((p) => v.includes(p))) return v;
  }
  return null;
};

export const env = {
  url: FIRST('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
  // New-format keys first: a project with the new API keys enabled rejects
  // the legacy anon JWT with a 401.
  anonKey: FIRST('SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
                 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  serviceKey: FIRST('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_KEY',
                    'SUPABASE_SERVICE_ROLE_KEY'),
  // pgTAP wraps each suite in a transaction, so a transaction-mode pooler
  // will not do. Prefer the non-pooling URL, then whatever else is offered.
  databaseUrl: FIRST('DATABASE_URL', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_URL'),
};

env.projectRef = FIRST('SUPABASE_PROJECT_REF')
  ?? env.url?.match(/https:\/\/([^.]+)\.supabase\./)?.[1]
  ?? null;

/** Names the first missing credential, or null when everything is present. */
export function missing() {
  const needed = {
    'Supabase URL': env.url,
    'anon key': env.anonKey,
    'service role key': env.serviceKey,
    'database URL': env.databaseUrl,
  };
  return Object.entries(needed).filter(([, v]) => !v).map(([k]) => k);
}
