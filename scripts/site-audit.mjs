#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const jsonMode = process.argv.includes('--json');
const liveMode = process.argv.includes('--live');
const results = [];

const record = (name, ok, detail) => results.push({ name, ok: Boolean(ok), detail });
const readText = path => readFile(resolve(root, path), 'utf8');
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1] ?? null;
const digest = value => createHash('sha256').update(value).digest('hex');

async function exists(path) {
  try {
    await access(resolve(root, path), fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function jpegSize(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    const isSof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isSof) return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    if (!length || length < 2) break;
    offset += 2 + length;
  }
  return null;
}

function pngSize(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function webpSize(buffer) {
  if (buffer.subarray(0, 4).toString() !== 'RIFF' || buffer.subarray(8, 12).toString() !== 'WEBP') return null;
  const chunk = buffer.subarray(12, 16).toString();
  if (chunk === 'VP8X') {
    const width = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16);
    const height = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16);
    return { width, height };
  }
  if (chunk === 'VP8L' && buffer[20] === 0x2f) {
    const bits = (buffer[21] | (buffer[22] << 8) | (buffer[23] << 16) | (buffer[24] << 24)) >>> 0;
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  if (chunk === 'VP8 ') {
    for (let i = 20; i + 9 < Math.min(buffer.length, 80); i += 1) {
      if (buffer[i] === 0x9d && buffer[i + 1] === 0x01 && buffer[i + 2] === 0x2a) {
        return {
          width: buffer.readUInt16LE(i + 3) & 0x3fff,
          height: buffer.readUInt16LE(i + 5) & 0x3fff
        };
      }
    }
  }
  return null;
}

async function imageSize(path) {
  const buffer = await readFile(resolve(root, path));
  switch (extname(path).toLowerCase()) {
    case '.jpg':
    case '.jpeg': return jpegSize(buffer);
    case '.png': return pngSize(buffer);
    case '.webp': return webpSize(buffer);
    default: return null;
  }
}

function localReference(value) {
  if (!value || /^(?:https?:|mailto:|tel:|data:|#)/i.test(value)) return null;
  return value.split(/[?#]/)[0].replace(/^\.\//, '');
}

async function auditLocal() {
  const required = ['index.html', 'game.html', '404.html', 'robots.txt', 'sitemap.xml', 'script.js', 'styles.css', '_config.yml'];
  for (const path of required) record(`required:${path}`, await exists(path), path);

  const [index, game, robots, sitemap] = await Promise.all([
    readText('index.html'), readText('game.html'), readText('robots.txt'), readText('sitemap.xml')
  ]);
  const publishFiles = JSON.parse(await readText('site-files.json'));
  const pagesConfig = await readText('_config.yml');

  record('homepage:canonical', /<link rel="canonical" href="https:\/\/adognamedfrog\.com\/">/.test(index), 'canonical homepage URL');
  record('homepage:description', /<meta name="description" content="[^"]+">/.test(index), 'meta description present');
  record('homepage:og-image-alt', /<meta property="og:image:alt" content="Cover of A Dog Named Frog by Joshua Allen Lanham">/.test(index), 'social image has descriptive alternative text');
  record('homepage:book-only', !/Frog(?:'|’)?s Quest|game\.html|frog-quest|fishing game/i.test(index), 'no retired game promotion');
  record('homepage:current-email', /mailto:joshualanham55@gmail\.com/.test(index) && !/ADogNamedFrog@VandaliaVirtual\.com/i.test(index), 'current public contact only');

  const amazonLinks = [...index.matchAll(/href="([^"]*amazon\.com[^"]+)"/g)].map(match => match[1]);
  record('homepage:amazon-links', amazonLinks.length > 0 && amazonLinks.every(link => link.includes('B0BH33T6S3')), `${amazonLinks.length} links use approved ASIN`);

  const jsonLdText = index.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  try {
    const jsonLd = JSON.parse(jsonLdText ?? '');
    record('homepage:json-ld', jsonLd['@type'] === 'Book' && jsonLd.isbn === '9798849208596' && jsonLd.numberOfPages === 35, 'Book schema, ISBN, and current paperback page count');
  } catch (error) {
    record('homepage:json-ld', false, `invalid JSON-LD: ${error.message}`);
  }

  record('game:noindex', /name="robots" content="noindex, nofollow, noarchive"/.test(game), 'retired route is no-index');
  record('game:redirect', /http-equiv="refresh" content="0;url=\.\/"/.test(game) && /window\.location\.replace\("\.\/"\)/.test(game), 'retired route returns to homepage');
  record('game:not-marketed', !/frog-quest\.js|frog-quest\.css|data-game-|<canvas|Play Frog(?:'|’)?s Quest/i.test(game), 'no playable wrapper');

  record('robots:sitemap', /Sitemap: https:\/\/adognamedfrog\.com\/sitemap\.xml/.test(robots), 'absolute sitemap URL');
  record('sitemap:homepage-only', /<loc>https:\/\/adognamedfrog\.com\/<\/loc>/.test(sitemap) && !/game\.html|frog-quest/i.test(sitemap), 'approved public URL only');
  record('404:root-link', /<a href="\/">Return home<\/a>/.test(await readText('404.html')), 'nested missing pages return to the homepage');
  record(
    'publish:allowlist',
    publishFiles.length === 20 && !publishFiles.some(path => /(?:^|\/)(?:tests|scripts|vendor|production|game)(?:\/|$)|frog-quest|GAME_PROGRESS|WEEKLY_SITE_WORKFLOW/i.test(path)),
    `${publishFiles.length} explicit production files; internal source excluded`
  );
  record(
    'publish:legacy-pages-exclusions',
    ['assets/game', 'assets/production', 'frog-quest.js', 'tests', 'vendor', 'SITE_MAINTENANCE.md'].every(path => pagesConfig.includes(`- ${path}`)) && !(await exists('.nojekyll')),
    'legacy branch publishing applies the internal-file exclusions'
  );

  const publicSources = await Promise.all(['index.html', 'game.html', '404.html', 'styles.css', 'script.js', 'robots.txt', 'sitemap.xml'].map(async path => [path, await readText(path)]));
  const leakage = /(?:\/Users\/|\/home\/|file:\/\/|agent_attachment|workspace\/scratch)/i;
  const leakedFiles = publicSources.filter(([, content]) => leakage.test(content)).map(([path]) => path);
  record('public:no-local-paths', leakedFiles.length === 0, leakedFiles.length ? leakedFiles.join(', ') : 'no machine-local references');

  const tags = [...index.matchAll(/<(?:img|script|link)\b[^>]*>/gi)].map(match => match[0]);
  const refs = new Set();
  for (const tag of tags) {
    const value = attr(tag, 'src') ?? attr(tag, 'href');
    const path = localReference(value);
    if (path) refs.add(path);
  }
  const missing = [];
  for (const path of refs) if (!(await exists(path))) missing.push(path);
  record('assets:references', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : `${refs.size} local references resolve`);

  const imageTags = [...index.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
  const dimensionProblems = [];
  for (const tag of imageTags) {
    const src = localReference(attr(tag, 'src'));
    const width = Number(attr(tag, 'width'));
    const height = Number(attr(tag, 'height'));
    if (!src || !width || !height) {
      dimensionProblems.push(`${src ?? 'unknown image'}: missing declared dimensions`);
      continue;
    }
    const actual = await imageSize(src);
    if (!actual) {
      dimensionProblems.push(`${src}: unsupported image format`);
      continue;
    }
    if (actual.width !== width || actual.height !== height) {
      dimensionProblems.push(`${src}: declared ${width}x${height}, actual ${actual.width}x${actual.height}`);
    }
  }
  record('images:intrinsic-dimensions', dimensionProblems.length === 0, dimensionProblems.length ? dimensionProblems.join('; ') : `${imageTags.length} image declarations match`);
}

async function auditLive() {
  const base = 'https://adognamedfrog.com';
  const routes = ['/', '/robots.txt', '/sitemap.xml', '/game.html'];
  for (const route of routes) {
    try {
      const response = await fetch(`${base}${route}`, { redirect: 'manual' });
      const body = await response.text();
      record(`live:${route}`, response.status === 200, `HTTP ${response.status}`);
      if (route === '/') record('live:homepage-book-only', !/Frog(?:'|’)?s Quest|game\.html|frog-quest|fishing game/i.test(body), 'no retired game promotion');
      if (route === '/game.html') record('live:game-noindex', /noindex, nofollow, noarchive/.test(body), 'retired route remains no-index');
    } catch (error) {
      record(`live:${route}`, false, error.message);
    }
  }

  for (const route of ['/frog-quest.js', '/GAME_PROGRESS.md', '/tests/public-site.test.mjs', '/assets/game/environment/v3/barnyard.webp']) {
    try {
      const response = await fetch(`${base}${route}`, { redirect: 'manual' });
      record(`live:private:${route}`, response.status === 404, `HTTP ${response.status}`);
    } catch (error) {
      record(`live:private:${route}`, false, error.message);
    }
  }

  for (const route of ['/index.html', '/styles.css', '/script.js']) {
    try {
      const [local, response] = await Promise.all([readFile(resolve(root, route.slice(1))), fetch(`${base}${route}`)]);
      const remote = Buffer.from(await response.arrayBuffer());
      record(`live:artifact:${route}`, response.status === 200 && digest(local) === digest(remote), response.status === 200 ? 'SHA-256 matches release source' : `HTTP ${response.status}`);
    } catch (error) {
      record(`live:artifact:${route}`, false, error.message);
    }
  }

  try {
    const response = await fetch('http://adognamedfrog.com/', { redirect: 'manual' });
    const location = response.headers.get('location') ?? '';
    record('live:https-redirect', [301, 302, 307, 308].includes(response.status) && location.startsWith('https://adognamedfrog.com/'), `HTTP ${response.status}${location ? ` to ${location}` : ''}`);
  } catch (error) {
    record('live:https-redirect', false, error.message);
  }
}

await auditLocal();
if (liveMode) await auditLive();

const failed = results.filter(result => !result.ok);
const report = {
  generatedAt: new Date().toISOString(),
  mode: liveMode ? 'local+live' : 'local',
  passed: results.length - failed.length,
  failed: failed.length,
  checks: results
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  for (const result of results) process.stdout.write(`${result.ok ? 'PASS' : 'FAIL'} ${result.name} — ${result.detail}\n`);
  process.stdout.write(`\n${report.passed}/${results.length} checks passed\n`);
}

if (failed.length) process.exitCode = 1;
