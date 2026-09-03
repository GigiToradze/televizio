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
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const SITE_FILES = [
  'index.html', 'lookup.html', 'privacy.html', 'terms.html',
  'favicon.ico', 'robots.txt', 'sitemap.xml',
  'assets',
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

await stampAssets('dist/site');

/* Asset URLs in the markup are stable names — assets/css/style.css is
 * assets/css/style.css forever — so a browser holding an old copy has no
 * reason to ask for a new one, and a deploy lands fresh HTML against stale
 * CSS and JS. www is proxied through Cloudflare, which rewrites Vercel's
 * "max-age=0, must-revalidate" on static files to its own four-hour browser
 * TTL, so that window is real: only a hard reload gets past it.
 *
 * Stamping every URL with a hash of the file's bytes ends it. A changed
 * asset becomes a URL the browser has never seen, so it fetches it — no
 * revalidation, no cache rules to get right, nothing to purge.
 */
async function stampAssets(root) {
  const STAMPED = /\.(css|js|woff2?|png|jpe?g|webp|svg|ico|mp4|webm)$/i;

  async function walk(dir) {
    const found = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      found.push(...(entry.isDirectory() ? await walk(full) : [full]));
    }
    return found;
  }

  const hash = (bytes) => createHash('md5').update(bytes).digest('hex').slice(0, 8);
  // The site-root-relative, forward-slashed form the HTML and CSS write.
  const urlOf = (file) => path.relative(root, file).split(path.sep).join('/');

  const files = (await walk(path.join(root, 'assets'))).filter((f) => STAMPED.test(f));
  const version = new Map();
  for (const file of files) version.set(urlOf(file), hash(await readFile(file)));

  // The CSS reaches the fonts and star.svg by relative url(). Those have to
  // carry the same version the HTML's <link rel=preload> does, or the
  // preloaded font is fetched a second time under its bare name and the
  // preload is wasted. Rewrite the CSS first, then re-hash it, so its own
  // URL reflects the edit.
  for (const file of files.filter((f) => f.endsWith('.css'))) {
    const dir = path.posix.dirname(urlOf(file));
    const before = await readFile(file, 'utf8');
    const after = before.replace(/url\((['"]?)([^)'"]+)\1\)/g, (whole, quote, ref) => {
      const bare = ref.split('?')[0];
      const target = path.posix.normalize(path.posix.join(dir, bare));
      const v = version.get(target);
      return v ? `url(${quote}${bare}?v=${v}${quote})` : whole;
    });
    if (after === before) continue;
    await writeFile(file, after);
    version.set(urlOf(file), hash(after));
  }

  // Longest path first, so a short path that prefixes a longer one cannot
  // claim the match. An existing ?v= is replaced rather than doubled.
  const known = [...version.keys()].sort((a, b) => b.length - a.length);
  const reference = new RegExp(
    `(${known.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(\\?v=[0-9a-f]+)?`,
    'g',
  );

  let stamped = 0;
  for (const page of (await readdir(root)).filter((f) => f.endsWith('.html'))) {
    const file = path.join(root, page);
    const before = await readFile(file, 'utf8');
    const after = before.replace(reference, (_, asset) => {
      stamped += 1;
      return `${asset}?v=${version.get(asset)}`;
    });
    if (after !== before) await writeFile(file, after);
  }
  console.log(`stamped ${stamped} asset URLs with a content hash`);
}

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
