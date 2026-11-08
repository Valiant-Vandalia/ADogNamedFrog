import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage remains a book-only purchase flow', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /Frog(?:'|’)?s Quest|game\.html|frog-quest|fishing game/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/adognamedfrog\.com\/">/);
  assert.match(html, /<meta property="og:image:alt" content="Cover of A Dog Named Frog by Joshua Allen Lanham">/);
  assert.match(html, /mailto:joshualanham55@gmail\.com/);
  assert.match(html, /"numberOfPages":35/);
  assert.match(html, /<strong>35 pages<\/strong><span>Paperback print length<\/span>/);
  assert.doesNotMatch(html, /children ask to hear again|Little-reader approved|Grown-ups appreciate/i);

  const amazonLinks = [...html.matchAll(/href="([^"]*amazon\.com[^"]+)"/g)].map(match => match[1]);
  assert.ok(amazonLinks.length >= 1, 'homepage should include an Amazon destination');
  assert.ok(amazonLinks.every(link => {
    const url = new URL(link);
    if (url.pathname === '/review/create-review') return url.searchParams.get('asin') === 'B0BH33T6S3';
    return url.pathname.match(/\/dp\/([^/]+)\/?$/)?.[1] === 'B0BH33T6S3';
  }), 'every Amazon product and review link must use ASIN B0BH33T6S3');
});

test('signed hardcover preorder allows only the approved Google Forms destinations', async () => {
  const html = await read('index.html');
  const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
  const embed = 'https://docs.google.com/forms/d/e/1FAIpQLSeHxMgFS23b1r3WMx5izlJ5OOk1C2rusSCcZbYggFf_m6jEPg/viewform?embedded=true';
  const link = 'https://forms.gle/gPDmhC3WAnELLVjj6';
  const iframes = [...html.matchAll(/<iframe\b[^>]*>/gi)].map(match => match[0]);
  assert.equal(iframes.length, 1);
  for (const [name, value] of Object.entries({ src: embed, title: 'Signed hardcover preorder form', width: '100%', height: '900', loading: 'lazy' })) {
    assert.equal(attr(iframes[0], name), value);
  }
  const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map(match => match[0]);
  const fallback = anchors.filter(tag => attr(tag, 'href') === link);
  assert.equal(fallback.length, 1);
  assert.equal(attr(fallback[0], 'target'), '_blank');
  assert.equal(attr(fallback[0], 'rel'), 'noopener');
  assert.match(attr(fallback[0], 'class'), /\bbutton\b/);
  const externalLinks = anchors.map(tag => attr(tag, 'href')).filter(href => /^https?:/i.test(href ?? ''));
  assert.ok(externalLinks.every(href => href === link || href === 'https://www.wsaz.com/2022/11/07/bookmark-monday-dog-named-frog/' || new URL(href).origin === 'https://www.amazon.com'), 'no other new external links');
  assert.match(html, /Available in paperback and Kindle editions on Amazon\./);
  assert.doesNotMatch(html, /1088264654|9781088264652|Get the special hardcover edition/);
  const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1]);
  assert.equal(jsonLd.bookFormat, 'https://schema.org/Paperback');
  assert.equal(jsonLd.isbn, '9798849208596');
  assert.ok(!('workExample' in jsonLd));
});

test('retired public game route remains a no-index redirect while source is retained', async () => {
  const [html, source] = await Promise.all([read('game.html'), read('frog-quest.js')]);
  assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(html, /rel="canonical" href="https:\/\/adognamedfrog\.com\/"/);
  assert.match(html, /http-equiv="refresh" content="0;url=\.\/"/);
  assert.match(html, /window\.location\.replace\("\.\/"\)/);
  assert.match(html, /href="\.\/"/);
  assert.doesNotMatch(html, /frog-quest\.js|frog-quest\.css|data-game-|<canvas|Play Frog(?:'|’)?s Quest/i);
  assert.match(source, /sunny-valley-map\.mjs/, 'retained game source should remain present');
});

test('search-engine control files expose only the approved homepage', async () => {
  const [robots, sitemap] = await Promise.all([read('robots.txt'), read('sitemap.xml')]);
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/adognamedfrog\.com\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/adognamedfrog\.com\/<\/loc>/);
  assert.doesNotMatch(sitemap, /game\.html|frog-quest/i);
});

test('nested 404 pages return visitors to the site root', async () => {
  const html = await read('404.html');
  assert.match(html, /<a href="\/">Return home<\/a>/);
  assert.doesNotMatch(html, /href="\.\/"/);
});

test('production artifact is an explicit book-site allowlist', async () => {
  const files = JSON.parse(await read('site-files.json'));
  assert.equal(files.length, 20);
  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('robots.txt'));
  assert.ok(files.includes('sitemap.xml'));
  for (const path of files) {
    assert.doesNotMatch(path, /(?:^|\/)(?:tests|scripts|vendor|production|game)(?:\/|$)|frog-quest|GAME_PROGRESS|WEEKLY_SITE_WORKFLOW/i);
  }
});

test('mobile purchase bar waits until the hero has passed and no-script content stays visible', async () => {
  const [html, css, script] = await Promise.all([read('index.html'), read('styles.css'), read('script.js')]);
  assert.match(html, /<noscript><style>\.reveal\{opacity:1;transform:none\}/);
  assert.match(html, /class="mobile-buy" data-mobile-buy/);
  assert.match(css, /\.mobile-buy:not\(\.is-visible\)\{display:none\}/);
  assert.match(script, /hero\.getBoundingClientRect\(\)\.bottom <= 72/);
  assert.match(script, /classList\.toggle\('is-visible', heroHasPassed\)/);
});

test('primary green meets AA contrast on the cream background', async () => {
  const css = await read('styles.css');
  assert.match(css, /--green:#397a47/);
});

test('legacy GitHub Pages builds exclude retained internal source', async () => {
  const config = await read('_config.yml');
  for (const path of ['assets/game', 'assets/production', 'frog-quest.js', 'tests', 'vendor', 'SITE_MAINTENANCE.md']) {
    assert.match(config, new RegExp(`- ${path.replace('.', '\\.').replace('/', '\\/')}`));
  }
});
