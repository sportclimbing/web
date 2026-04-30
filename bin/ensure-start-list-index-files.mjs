#!/usr/bin/env node
/**
 * Post-build script: converts flat start-list modal files into index.html
 * inside directories so they work with trailing slashes on GitHub Pages.
 *
 * Astro generates flat files like:
 *   dist/modals/start-list/2026/1524
 *
 * But with trailingSlash: 'always', the URL is:
 *   /modals/start-list/2026/1524/
 *
 * GitHub Pages needs:
 *   dist/modals/start-list/2026/1524/index.html
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync, renameSync } from 'fs';
import { join } from 'path';

const distDir = new URL('../dist', import.meta.url).pathname;
const baseDir = join(distDir, 'modals', 'start-list');

if (!existsSync(baseDir)) {
  console.log('No start-list directory found, skipping.');
  process.exit(0);
}

let converted = 0;

const seasonDirs = readdirSync(baseDir).filter((name) => {
  const p = join(baseDir, name);
  return statSync(p).isDirectory();
});

for (const season of seasonDirs) {
  const seasonDir = join(baseDir, season);
  const entries = readdirSync(seasonDir);

  for (const entry of entries) {
    const entryPath = join(seasonDir, entry);
    if (statSync(entryPath).isFile()) {
      const targetDir = join(seasonDir, entry);
      const targetFile = join(targetDir, 'index.html');

      // Read content before removing the file
      const content = readFileSync(entryPath);
      unlinkSync(entryPath);
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(targetFile, content);
      converted++;
    }
  }
}

console.log(`Converted ${converted} start-list modal files to directory-based structure.`);
