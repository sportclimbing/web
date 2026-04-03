import fs from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

const ROOT = process.cwd();
const SOURCE_FILES = [
  'src/lib/shared/media.js',
  'src/js/app/helpers/core.js',
  'src/js/app/helpers/render.js',
  'src/js/app/helpers/modals-and-start-list.js',
  'src/js/app/events/state.js',
  'src/js/app/events/render-and-layout.js',
  'src/js/app/events/navigation-and-tooltips.js',
  'src/js/app/bootstrap/init.js',
];
const SHARED_SOURCE_FILES = new Set([
  'src/lib/shared/media.js',
]);
const OUTPUT_FILE = 'public/js/app.js';
const SHOULD_MINIFY = process.argv.includes('--minify');

const source_for_browser_bundle = (filePath, source) => {
  if (!SHARED_SOURCE_FILES.has(filePath)) {
    return source;
  }

  return source
    .replace(/^export\s+(?=(function|const|let|class)\b)/gm, '')
    .replace(/^export\s*\{[^}]+\};?\s*$/gm, '');
};

const readSource = async (filePath) => {
  const fullPath = path.join(ROOT, filePath);
  const source = await fs.readFile(fullPath, 'utf8');
  const normalizedSource = source_for_browser_bundle(filePath, source);

  return `/* ${filePath} */\n${normalizedSource.trimEnd()}`;
};

const buildBundle = async () => {
  const parts = await Promise.all(SOURCE_FILES.map(readSource));
  const concatenated = `${parts.join('\n\n')}\n`;

  const result = await transform(concatenated, {
    loader: 'js',
    minifyIdentifiers: false,
    minifySyntax: SHOULD_MINIFY,
    minifyWhitespace: SHOULD_MINIFY,
    legalComments: SHOULD_MINIFY ? 'none' : 'inline',
  });

  if (!result.code) {
    throw new Error('Failed to build JavaScript bundle');
  }

  return `${result.code.trimEnd()}\n`;
};

const writeBundle = async () => {
  const outputPath = path.join(ROOT, OUTPUT_FILE);
  const bundle = await buildBundle();

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, bundle, 'utf8');

  const modeLabel = SHOULD_MINIFY ? 'minified' : 'unminified';
  console.log(`Wrote ${OUTPUT_FILE} (${modeLabel})`);
};

writeBundle().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
