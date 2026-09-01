/* Runs the pgTAP suites against the hosted database.
 *
 * `supabase test db` needs the local Docker stack, which this project does
 * not use. This does the same job over a plain Postgres connection: each
 * suite opens a transaction, asserts, and rolls back, so nothing it does
 * survives the run.
 *
 *   node supabase/tests/run.mjs            # every suite
 *   node supabase/tests/run.mjs rls        # only suites matching "rls"
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in,');
  console.error('then run with:  node --env-file=.env supabase/tests/run.mjs');
  process.exit(1);
}

const filter = process.argv[2] ?? '';
const files = (await readdir(HERE))
  .filter((f) => f.endsWith('.test.sql') && f.includes(filter))
  .sort();

if (!files.length) {
  console.error(`No suites matched "${filter}".`);
  process.exit(1);
}

let failed = 0;

for (const file of files) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const sql = await readFile(join(HERE, file), 'utf8');
  console.log(`\n── ${file} ${'─'.repeat(Math.max(0, 60 - file.length))}`);

  try {
    // A suite is one multi-statement script; pg hands back one result per
    // statement, and the TAP lines are single-column rows scattered among them.
    const results = await client.query(sql);
    const sets = Array.isArray(results) ? results : [results];

    for (const set of sets) {
      for (const row of set.rows ?? []) {
        const line = String(Object.values(row)[0] ?? '');
        if (!line) continue;
        console.log(line);
        if (line.startsWith('not ok')) failed++;
      }
    }
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    failed++;
    // The transaction is aborted; roll it back so the connection closes clean.
    await client.query('rollback').catch(() => {});
  } finally {
    await client.end();
  }
}

console.log(failed ? `\n${failed} failing assertion(s).` : '\nAll suites passed.');
process.exit(failed ? 1 : 0);
