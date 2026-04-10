import fs from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

const ROOT = process.cwd();
const INPUT = 'src/styles/modals.css';
const OUTPUT = 'public/css/modals.css';
const SHOULD_MINIFY = process.argv.includes('--minify');

const src = await fs.readFile(path.join(ROOT, INPUT), 'utf8');
const result = await transform(src, {
  loader: 'css',
  minify: SHOULD_MINIFY,
});

await fs.writeFile(path.join(ROOT, OUTPUT), result.code, 'utf8');
console.log(`Wrote ${OUTPUT} (${SHOULD_MINIFY ? 'minified' : 'unminified'})`);
