/* Credentials for the integration tests, resolved the same way
   supabase/env.mjs resolves them — either the names in .env.example or the
   ones the Vercel–Supabase integration writes.

   Run with:  node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/functions
   or:        npm run test:api
*/
const PLACEHOLDERS = ['FILL_ME', 'YOUR', '[SENSITIVE]'];

function first(...names: string[]): string | null {
  for (const n of names) {
    const v = process.env[n];
    if (v && !PLACEHOLDERS.some((p) => v.includes(p))) return v;
  }
  return null;
}

export const URL_ = first('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
export const ANON = first('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY',
                          'NEXT_PUBLIC_SUPABASE_ANON_KEY');
export const SERVICE = first('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_KEY',
                             'SUPABASE_SERVICE_ROLE_KEY');

/** These suites talk to deployed edge functions. Without credentials there is
 *  nothing to talk to, so they skip rather than fail — but loudly, because a
 *  silently skipped security test is worse than no test. */
export const configured = Boolean(URL_ && ANON && SERVICE);

if (!configured) {
  console.warn(
    '\n  ! tests/functions skipped: no Supabase credentials in the environment.' +
    '\n    Run `npm run test:api` after filling .env and deploying the functions.\n',
  );
}
