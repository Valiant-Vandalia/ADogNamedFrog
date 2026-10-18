#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('..', import.meta.url));
const testFiles = readdirSync(new URL('../tests/', import.meta.url))
  .filter(name => name.endsWith('.test.mjs'))
  .sort()
  .map(name => `tests/${name}`);

const commands = [
  ['scripts/build-site.mjs'],
  ['scripts/site-audit.mjs'],
  ['--test', ...testFiles],
  ['--check', 'script.js'],
  ['--check', 'frog-quest.js'],
  ['--check', 'frog-quest-systems.mjs'],
  ['--check', 'sunny-valley-map.mjs']
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
