import fs from 'node:fs';
import path from 'node:path';

const VERSION_JSON_PATH = path.join(process.cwd(), 'public', 'version.json');

const readAssetVersion = () => {
  try {
    const raw = fs.readFileSync(VERSION_JSON_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const version = typeof parsed?.version === 'string' ? parsed.version.trim() : '';

    return version || 'astro';
  } catch (_error) {
    return 'astro';
  }
};

export const siteAssetVersion = readAssetVersion();
