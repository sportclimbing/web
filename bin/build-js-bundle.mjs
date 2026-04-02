import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_FILES = [
  'src/lib/round-schedule-status.js',
  'src/js/app/helpers/core.js',
  'src/js/app/helpers/render.js',
  'src/js/app/helpers/modals-and-start-list.js',
  'src/js/app/events/state.js',
  'src/js/app/events/render-and-layout.js',
  'src/js/app/events/navigation-and-tooltips.js',
  'src/js/app/bootstrap/init.js',
];
const OUTPUT_FILE = 'public/js/app.js';
const SHOULD_MINIFY = process.argv.includes('--minify');

const readSource = async (filePath) => {
  const fullPath = path.join(ROOT, filePath);
  const source = await fs.readFile(fullPath, 'utf8');

  return `/* ${filePath} */\n${source.trimEnd()}`;
};

const buildBundle = async () => {
  const parts = await Promise.all(SOURCE_FILES.map(readSource));
  const concatenated = `${parts.join('\n\n')}\n`;

  if (!SHOULD_MINIFY) {
    return concatenated;
  }

  const terser = await import('terser');
  const result = await terser.minify(concatenated, {
    compress: true,
    mangle: false,
    format: {
      comments: false,
    },
  });

  if (!result.code) {
    throw new Error('Failed to minify JavaScript bundle');
  }

  return `${result.code}\n`;
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
