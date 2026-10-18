#!/usr/bin/env node

import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '_site');
const files = JSON.parse(await readFile(resolve(root, 'site-files.json'), 'utf8'));
const forbidden = /(?:\/Users\/|\/home\/|file:\/\/|localhost|127\.0\.0\.1|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|drive\.google\.com)/i;

if (!Array.isArray(files) || files.length === 0 || new Set(files).size !== files.length) {
  throw new Error('site-files.json must be a nonempty list of unique paths');
}

await rm(output, { recursive: true, force: true });

for (const relativePath of files) {
  if (relativePath.startsWith('/') || relativePath.includes('..')) throw new Error(`unsafe publish path: ${relativePath}`);
  const source = resolve(root, relativePath);
  const destination = resolve(output, relativePath);
  const sourceStat = await stat(source);
  if (!sourceStat.isFile()) throw new Error(`publish entry is not a file: ${relativePath}`);

  if (/\.(?:html|css|js|svg|xml|txt)$/i.test(relativePath) || relativePath === 'CNAME') {
    const content = await readFile(source, 'utf8');
    if (forbidden.test(content)) throw new Error(`private or local reference in publish file: ${relativePath}`);
  }

  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

process.stdout.write(`Built ${files.length} allowlisted files in _site\n`);
