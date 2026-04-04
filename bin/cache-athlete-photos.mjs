#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const DEFAULT_IMAGE_SIZE = 128;
const DEFAULT_IMAGE_QUALITY = 82;
const DEFAULT_HTTP_TIMEOUT_MS = 20_000;
const DEFAULT_CONCURRENCY = 8;

const usage = (scriptPath) => `Usage:
  node ${scriptPath} [--events-dir <path>] [--images-dir <path>] [--image-size <px>] [--concurrency <count>]

Arguments:
  --events-dir         Directory containing events_YYYY.json (default: events)
  --images-dir         Output directory for local images (default: public/img/athletes)
  --image-size         Square output size in px (default: 128; min: 32, max: 1024)
  --concurrency        Parallel download/resize workers (default: 8)
  --help, -h           Show this help

Example:
  node ${scriptPath} --events-dir events --images-dir public/img/athletes --image-size 128 --concurrency 8
`;

const normalize_athlete_id = (athleteId) => {
  if (typeof athleteId === 'number' && Number.isFinite(athleteId) && Number.isInteger(athleteId) && athleteId >= 0) {
    return String(athleteId);
  }

  if (typeof athleteId !== 'string') {
    return '';
  }

  const athleteIdString = athleteId.trim();

  if (!athleteIdString) {
    return '';
  }

  return /^\d+$/.test(athleteIdString) ? athleteIdString : '';
};

const normalize_athlete_name_part = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const raw = value.trim();

  if (!raw) {
    return '';
  }

  let normalized = raw.normalize('NFKD').replace(/\p{M}+/gu, '');
  normalized = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return normalized;
};

const decode_events_file = async (eventsFile) => {
  let contents = '';

  try {
    contents = await fs.readFile(eventsFile, 'utf8');
  } catch (_error) {
    throw new Error(`Could not read events file: ${eventsFile}`);
  }

  let payload = null;

  try {
    payload = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Could not parse ${eventsFile}: ${error.message}`);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`Events payload is not a JSON object: ${eventsFile}`);
  }

  return payload;
};

const fetch_binary = async (url) => {
  const normalizedUrl = String(url ?? '').trim();

  if (!normalizedUrl) {
    throw new Error('Photo URL is empty');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_HTTP_TIMEOUT_MS);

  try {
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'image/*',
        'User-Agent': 'ifsc.stream-athlete-photo-cache/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Unexpected HTTP status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Download failed: timeout');
    }

    if (error instanceof Error && error.message.startsWith('Unexpected HTTP status')) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Download failed';
    throw new Error(`Download failed: ${message}`);
  } finally {
    clearTimeout(timeoutId);
  }
};

const save_resized_square_webp = async (binary, destination, size, quality) => {
  try {
    await sharp(binary)
      .rotate()
      .resize(size, size, {
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: false,
      })
      .webp({
        quality,
      })
      .toFile(destination);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unsupported or invalid image format';
    throw new Error(message);
  }
};

const start_list_photo_entries = (payload) => {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const entries = [];

  for (const event of events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      continue;
    }

    const startList = Array.isArray(event.start_list) ? event.start_list : [];

    for (const athlete of startList) {
      if (!athlete || typeof athlete !== 'object' || Array.isArray(athlete)) {
        continue;
      }

      const athleteId = normalize_athlete_id(athlete.athlete_id);
      const photoUrl = typeof athlete.photo_url === 'string' ? athlete.photo_url.trim() : '';

      if (!photoUrl) {
        continue;
      }

      entries.push({
        athlete_id: athleteId,
        first_name: typeof athlete.first_name === 'string' ? athlete.first_name.trim() : '',
        last_name: typeof athlete.last_name === 'string' ? athlete.last_name.trim() : '',
        photo_url: photoUrl,
      });
    }
  }

  return entries;
};

const local_filename_from_athlete_name = (firstName, lastName, athleteId) => {
  const firstNameNormalized = normalize_athlete_name_part(firstName);
  const lastNameNormalized = normalize_athlete_name_part(lastName);
  let baseName = `${firstNameNormalized}-${lastNameNormalized}`.replace(/^-+|-+$/g, '');

  if (!baseName) {
    baseName = athleteId ? `athlete-${athleteId}` : 'athlete';
  }

  if (baseName.includes('\u0000')) {
    throw new Error('Invalid athlete name for filename');
  }

  return `${baseName}.webp`;
};

const discover_event_files = async (eventsDirectory) => {
  let entries = [];

  try {
    entries = await fs.readdir(eventsDirectory, { withFileTypes: true });
  } catch (_error) {
    throw new Error(`No events_YYYY.json files found in ${eventsDirectory}`);
  }

  const eventFiles = entries
    .filter((entry) => entry.isFile() && /^events_.*\.json$/.test(entry.name))
    .map((entry) => path.join(eventsDirectory, entry.name))
    .sort();

  if (eventFiles.length === 0) {
    throw new Error(`No events_YYYY.json files found in ${eventsDirectory}`);
  }

  const eventFileBySeason = new Map();

  for (const eventFile of eventFiles) {
    const match = /events_(\d{4})\.json$/.exec(path.basename(eventFile));

    if (!match) {
      continue;
    }

    eventFileBySeason.set(match[1], eventFile);
  }

  if (eventFileBySeason.size === 0) {
    throw new Error(`No valid events_YYYY.json files found in ${eventsDirectory}`);
  }

  return Array.from(eventFileBySeason.entries()).sort((a, b) => Number(b[0]) - Number(a[0]));
};

const trim_trailing_slashes = (value) => {
  return String(value ?? '').replace(/[\\/]+$/g, '');
};

const parse_positive_integer = (value, label) => {
  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
};

const parse_cli_arguments = () => {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      'events-dir': { type: 'string' },
      'images-dir': { type: 'string' },
      'image-size': { type: 'string' },
      concurrency: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (parsed.values.help) {
    console.log(usage(process.argv[1] || 'bin/cache-athlete-photos.mjs'));
    return null;
  }

  const imageSize = parse_positive_integer(parsed.values['image-size'] ?? DEFAULT_IMAGE_SIZE, 'Image size');

  if (imageSize < 32 || imageSize > 1024) {
    throw new Error('Image size must be between 32 and 1024 pixels');
  }

  const concurrency = parse_positive_integer(parsed.values.concurrency ?? DEFAULT_CONCURRENCY, 'Concurrency');

  return {
    eventsDirectory: trim_trailing_slashes(parsed.values['events-dir'] ?? 'events'),
    imagesDirectory: trim_trailing_slashes(parsed.values['images-dir'] ?? 'public/img/athletes'),
    imageSize,
    concurrency,
  };
};

const run_parallel = async (items, concurrency, worker) => {
  const queue = [...items];
  const workers = [];

  const run_worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();

      if (item === undefined) {
        return;
      }

      await worker(item);
    }
  };

  for (let index = 0; index < concurrency; index += 1) {
    workers.push(run_worker());
  }

  await Promise.all(workers);
};

const main = async () => {
  let eventsDirectory = 'events';
  let imagesDirectory = 'public/img/athletes';
  let imageSize = DEFAULT_IMAGE_SIZE;
  let concurrency = DEFAULT_CONCURRENCY;

  try {
    const cli = parse_cli_arguments();

    if (cli === null) {
      process.exit(0);
    }

    eventsDirectory = cli.eventsDirectory;
    imagesDirectory = cli.imagesDirectory;
    imageSize = cli.imageSize;
    concurrency = cli.concurrency;
  } catch (error) {
    console.error(error.message);
    console.error(usage(process.argv[1] || 'bin/cache-athlete-photos.mjs'));
    process.exit(1);
  }

  let eventFileBySeason = [];

  try {
    eventFileBySeason = await discover_event_files(eventsDirectory);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const photoCandidates = new Map();
  let deduplicatedByFilenameCount = 0;
  let invalidFilenameCount = 0;

  for (const [season, eventsFile] of eventFileBySeason) {
    let payload = null;

    try {
      payload = await decode_events_file(eventsFile);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }

    for (const entry of start_list_photo_entries(payload)) {
      const photoUrl = entry.photo_url;
      const athleteId = entry.athlete_id;
      const firstName = entry.first_name;
      const lastName = entry.last_name;
      let fileName = '';

      try {
        fileName = local_filename_from_athlete_name(firstName, lastName, athleteId);
      } catch (error) {
        invalidFilenameCount += 1;
        console.error(`[!] Skipping athlete ${athleteId} (${firstName} ${lastName}): ${error.message}`);
        continue;
      }

      if (!photoCandidates.has(fileName)) {
        photoCandidates.set(fileName, {
          season,
          athlete_id: athleteId,
          photo_url: photoUrl,
          file_name: fileName,
        });
        continue;
      }

      const existing = photoCandidates.get(fileName);

      if (existing.athlete_id !== '' && athleteId !== '' && existing.athlete_id !== athleteId) {
        const nameBase = path.parse(fileName).name;
        const fileNameWithId = `${nameBase}-${athleteId}.webp`;

        if (!photoCandidates.has(fileNameWithId)) {
          photoCandidates.set(fileNameWithId, {
            season,
            athlete_id: athleteId,
            photo_url: photoUrl,
            file_name: fileNameWithId,
          });
          continue;
        }
      }

      if (existing.photo_url !== photoUrl) {
        deduplicatedByFilenameCount += 1;
      }

      if (existing.athlete_id === '' && athleteId !== '') {
        existing.athlete_id = athleteId;
      }
    }
  }

  const candidateCount = photoCandidates.size;

  if (candidateCount === 0) {
    console.log(`[+] No start-list athlete photos found in ${eventFileBySeason.length} events_YYYY.json files.`);
    process.exit(0);
  }

  let writtenCount = 0;
  let downloadedCount = 0;
  let failedCount = 0;

  try {
    await fs.mkdir(imagesDirectory, { recursive: true });
  } catch (_error) {
    console.error(`Could not create output directory: ${imagesDirectory}`);
    process.exit(1);
  }

  await run_parallel(Array.from(photoCandidates.values()), concurrency, async (candidate) => {
    const season = candidate.season;
    const athleteId = candidate.athlete_id;
    const photoUrl = candidate.photo_url;
    const destinationFileName = candidate.file_name;

    try {
      const destination = path.join(imagesDirectory, destinationFileName);
      const binary = await fetch_binary(photoUrl);

      await save_resized_square_webp(binary, destination, imageSize, DEFAULT_IMAGE_QUALITY);
      writtenCount += 1;
      downloadedCount += 1;

      const label = athleteId !== '' ? `athlete ${athleteId}` : `photo ${destinationFileName}`;
      console.log(`[+] Cached ${label} (season ${season}) -> ${destination}`);
    } catch (error) {
      failedCount += 1;
      const label = athleteId !== '' ? `athlete ${athleteId}` : `photo URL ${photoUrl}`;
      console.error(`[!] Could not cache ${label} (season ${season}): ${error.message}`);
    }
  });

  if (writtenCount === 0) {
    console.error(`[!] Failed to cache all ${candidateCount} athlete photos.`);
    process.exit(1);
  }

  const seasonCount = eventFileBySeason.length;
  console.log(`[+] Cached ${writtenCount}/${candidateCount} unique photos across ${seasonCount} seasons (${downloadedCount} downloaded, ${failedCount} failed, ${deduplicatedByFilenameCount} filename duplicates omitted, ${invalidFilenameCount} invalid filename entries skipped).`);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
