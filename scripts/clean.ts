#!/usr/bin/env node

import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';

const rootDir = cwd();
const items = process.argv.slice(2);

for (const item of items) {
  const target = join(rootDir, item);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`[clean] Removed: ${target}`);
  } else {
    console.log(`[clean] Not found: ${target}`);
  }
}
