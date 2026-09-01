/* Assembles what Vercel serves.
 *
 * One Vercel project answers on two hostnames, and Vercel checks the
 * filesystem before it applies rewrites — so neither site can sit at the
 * output root, or it would win "/" for both. Each gets a folder, and
 * vercel.json routes by Host:
 *
 *   dist/site/     televizio.ge      the static marketing site, copied as-is
 *   dist/cmsapp/   cms.televizio.ge  the built admin panel
 *
 * The CMS is built with base '/cmsapp/', so its asset URLs are already
 * absolute and correct without a rewrite of their own.
 */
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SITE_FILES = [
  'index.html', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'assets',
];

const run = (cmd, args, env) =>
  execFileSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });

await rm('dist', { recursive: true, force: true });
await mkdir('dist/site', { recursive: true });

for (const entry of SITE_FILES) {
  if (!existsSync(entry)) {
    throw new Error(`Expected ${entry} at the repo root — the marketing site is incomplete.`);
  }
  await cp(entry, `dist/site/${entry}`, { recursive: true });
}
console.log(`copied ${SITE_FILES.length} entries into dist/site`);

// Vite inlines these at build time. Both are public: they ship inside the
// JavaScript every visitor downloads, and are safe there because row-level
// security denies anon everything. They come from the variables the
// Supabase–Vercel integration already set on the project.
const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY
  ?? process.env.SUPABASE_PUBLISHABLE_KEY
  ?? process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'No Supabase URL/key in the environment. Expected SUPABASE_URL and ' +
    'SUPABASE_PUBLISHABLE_KEY (set by the Vercel–Supabase integration), ' +
    'or VITE_ equivalents locally.',
  );
}

run('npm', ['run', 'build', '--workspace', 'cms'], {
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY: key,
});

await cp('cms/dist', 'dist/cmsapp', { recursive: true });
console.log('copied the CMS build into dist/cmsapp');
console.log('\ndist/site   -> televizio.ge\ndist/cmsapp -> cms.televizio.ge');
