/* Verifies the Supabase credentials without ever printing them.
 *
 *   node --env-file=.env supabase/check-env.mjs
 */
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { env, missing } from './env.mjs';

const gaps = missing();
if (gaps.length) {
  console.log(`Missing: ${gaps.join(', ')}`);
  console.log('Fill them in .env, or run `npx vercel env pull .env`.');
  process.exit(1);
}

console.log(`project    ${env.projectRef}`);
console.log(`url        ${env.url}`);
console.log(`anon key   ${env.anonKey.length} chars`);
console.log(`service    ${env.serviceKey.length} chars`);
console.log(`database   ${env.databaseUrl.replace(/:\/\/[^@]*@/, '://***@')}`);

let bad = false;

console.log('\n--- database ---');
const client = new pg.Client({ connectionString: env.databaseUrl });
try {
  await client.connect();
  const who = await client.query('select current_user, current_database() as db');
  console.log(`connected as ${who.rows[0].current_user} to ${who.rows[0].db}`);

  // pgTAP suites roll back, so the connection must survive a transaction.
  await client.query('begin');
  await client.query('rollback');
  console.log('transactions work (pgTAP suites will run)');

  const tap = await client.query(
    "select default_version, installed_version from pg_available_extensions where name = 'pgtap'");
  console.log(tap.rowCount
    ? `pgtap available ${tap.rows[0].default_version}, installed: ${tap.rows[0].installed_version ?? 'not yet'}`
    : 'pgtap NOT AVAILABLE');

  const tables = await client.query(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public'");
  console.log(`public tables already present: ${tables.rows[0].n}`);
} catch (e) {
  console.log(`DB FAILED: ${e.message}`);
  bad = true;
} finally {
  await client.end().catch(() => {});
}

console.log('\n--- rest api ---');
try {
  const res = await fetch(`${env.url}/rest/v1/`, { headers: { apikey: env.anonKey } });
  console.log(`anon key -> ${res.status} ${res.statusText}`);
  if (res.status >= 400) bad = true;
} catch (e) {
  console.log(`REST FAILED: ${e.message}`);
  bad = true;
}

console.log('\n--- service key ---');
try {
  const db = createClient(env.url, env.serviceKey);
  const { data, error } = await db.auth.admin.listUsers();
  if (error) throw error;
  console.log(`works; ${data.users.length} existing auth user(s)`);
} catch (e) {
  console.log(`SERVICE KEY FAILED: ${e.message}`);
  bad = true;
}

console.log(bad ? '\nSomething above is wrong.' : '\nAll credentials good.');
process.exit(bad ? 1 : 0);
