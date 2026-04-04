#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const DEFAULT_EVENTS_DIR = 'events';
const DEFAULT_IMAGES_DIR = 'public/images/thumb';
const DEFAULT_IMAGE_WIDTH = 480;
const DEFAULT_IMAGE_HEIGHT = 270;
const DEFAULT_IMAGE_QUALITY = 64;
const DEFAULT_HTTP_TIMEOUT_MS = 20_000;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_FALLBACK_VIDEO_IDS = ['emrHdLsJTk4', 'MQeQs6K_T5g'];
const OUTPUT_SETTINGS_FILE = '.thumb-settings.json';
const OUTPUT_IMAGE_EXTENSION = 'webp';
const YOUTUBE_THUMBNAIL_VARIANTS = [
  'maxresdefault.jpg',
  'sddefault.jpg',
  'hqdefault.jpg',
  'mqdefault.jpg',
  'default.jpg',
];
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;

const usage = (scriptPath) => `Usage:
  node ${scriptPath} [--events-dir <path>] [--images-dir <path>] [--image-width <px>] [--image-height <px>]

Arguments:
  --events-dir    Directory containing events_YYYY.json files (default: ${DEFAULT_EVENTS_DIR})
  --images-dir    Output directory for thumbnails (default: ${DEFAULT_IMAGES_DIR})
  --image-width   Output image width in px (default: ${DEFAULT_IMAGE_WIDTH})
  --image-height  Output image height in px (default: ${DEFAULT_IMAGE_HEIGHT})
  --help, -h      Show this help

Example:
  node ${scriptPath} --events-dir events --images-dir public/images/thumb --image-width 480 --image-height 270
`;

const parse_positive_integer = (rawValue, fallbackValue) => {
  const value = Number.parseInt(String(rawValue || ''), 10);

  if (!Number.isFinite(value) || value <= 0) {
    return fallbackValue;
  }

  return value;
};

const parse_cli_arguments = () => {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      'events-dir': { type: 'string' },
      'images-dir': { type: 'string' },
      'image-width': { type: 'string' },
      'image-height': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (parsed.values.help) {
    console.log(usage(path.basename(process.argv[1] || 'bin/cache-youtube-thumbnails.mjs')));
    return null;
  }

  return {
    eventsDir: path.resolve(process.cwd(), parsed.values['events-dir'] || DEFAULT_EVENTS_DIR),
    imagesDir: path.resolve(process.cwd(), parsed.values['images-dir'] || DEFAULT_IMAGES_DIR),
    imageWidth: parse_positive_integer(parsed.values['image-width'], DEFAULT_IMAGE_WIDTH),
    imageHeight: parse_positive_integer(parsed.values['image-height'], DEFAULT_IMAGE_HEIGHT),
  };
};

const normalize_video_id = (rawValue) => {
  const value = String(rawValue || '').trim();

  if (!YOUTUBE_VIDEO_ID_PATTERN.test(value)) {
    return null;
  }

  return value;
};

const video_id_from_stream_url = (streamUrl) => {
  const normalized = String(streamUrl || '').trim();

  if (!normalized) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalized);
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');

    if (hostname === 'youtu.be') {
      return normalize_video_id(parsedUrl.pathname.split('/').filter(Boolean)[0] || '');
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'youtube-nocookie.com') {
      const queryVideoId = normalize_video_id(parsedUrl.searchParams.get('v') || '');

      if (queryVideoId) {
        return queryVideoId;
      }

      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);

      if (!pathParts.length) {
        return null;
      }

      if (pathParts[0] === 'watch') {
        return normalize_video_id(pathParts[1] || '');
      }

      if (['live', 'embed', 'shorts', 'v'].includes(pathParts[0])) {
        return normalize_video_id(pathParts[1] || '');
      }
    }
  } catch (_error) {
    const fallbackMatch = normalized.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/))(?<videoId>[A-Za-z0-9_-]{10,})/i);

    if (fallbackMatch?.groups?.videoId) {
      return normalize_video_id(fallbackMatch.groups.videoId);
    }
  }

  return null;
};

const read_json_file = async (filePath) => {
  const source = await fs.readFile(filePath, 'utf8');
  return JSON.parse(source);
};

const youtube_thumbnail_url = (videoId, variant) => `https://i.ytimg.com/vi/${videoId}/${variant}`;

const fetch_buffer_with_timeout = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_HTTP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'image/*',
        'User-Agent': 'ifsc.stream-youtube-thumbnail-cache/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
      return null;
    }

    return buffer;
  } catch (_error) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetch_youtube_thumbnail = async (videoId) => {
  for (const variant of YOUTUBE_THUMBNAIL_VARIANTS) {
    const url = youtube_thumbnail_url(videoId, variant);
    const buffer = await fetch_buffer_with_timeout(url);

    if (buffer) {
      return buffer;
    }
  }

  return null;
};

const write_resized_thumbnail = async (sourceBuffer, outputFile, width, height) => {
  const resizedBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize(width, height, {
      fit: 'cover',
      position: 'center',
      withoutEnlargement: false,
    })
    .webp({
      quality: DEFAULT_IMAGE_QUALITY,
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer();

  await fs.writeFile(outputFile, resizedBuffer);
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

const collect_video_ids = async (eventsDir) => {
  const entries = await fs.readdir(eventsDir, { withFileTypes: true });
  const eventFiles = entries
    .filter((entry) => entry.isFile() && /^events_\d{4}\.json$/.test(entry.name))
    .map((entry) => path.join(eventsDir, entry.name))
    .sort();
  const videoIds = new Set();

  for (const eventsFile of eventFiles) {
    const payload = await read_json_file(eventsFile);
    const events = Array.isArray(payload?.events) ? payload.events : [];

    for (const event of events) {
      const rounds = Array.isArray(event?.rounds) ? event.rounds : [];

      for (const round of rounds) {
        const videoId = video_id_from_stream_url(round?.stream_url);

        if (videoId) {
          videoIds.add(videoId);
        }
      }
    }
  }

  for (const fallbackVideoId of DEFAULT_FALLBACK_VIDEO_IDS) {
    videoIds.add(fallbackVideoId);
  }

  return {
    eventFiles,
    videoIds: Array.from(videoIds).sort(),
  };
};

const main = async () => {
  const cliArguments = parse_cli_arguments();

  if (!cliArguments) {
    return;
  }

  const { eventsDir, imagesDir, imageWidth, imageHeight } = cliArguments;

  const { eventFiles, videoIds } = await collect_video_ids(eventsDir);

  if (!eventFiles.length) {
    throw new Error(`No events_YYYY.json files found in ${eventsDir}`);
  }

  await fs.mkdir(imagesDir, { recursive: true });

  const outputSettingsPath = path.join(imagesDir, OUTPUT_SETTINGS_FILE);
  const outputSettings = {
    width: imageWidth,
    height: imageHeight,
    quality: DEFAULT_IMAGE_QUALITY,
    format: OUTPUT_IMAGE_EXTENSION,
    effort: 6,
    smartSubsample: true,
    version: 3,
  };
  let shouldRefreshExisting = false;

  try {
    const existingSettingsRaw = await fs.readFile(outputSettingsPath, 'utf8');
    const existingSettings = JSON.parse(existingSettingsRaw);
    shouldRefreshExisting = JSON.stringify(existingSettings) !== JSON.stringify(outputSettings);
  } catch (_error) {
    shouldRefreshExisting = true;
  }

  if (shouldRefreshExisting) {
    console.log('Output settings changed, refreshing existing thumbnails');
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  await run_parallel(videoIds, DEFAULT_CONCURRENCY, async (videoId) => {
    const outputFile = path.join(imagesDir, `${videoId}.${OUTPUT_IMAGE_EXTENSION}`);
    const legacyJpegFile = path.join(imagesDir, `${videoId}.jpg`);

    try {
      const existing = await fs.stat(outputFile).catch(() => null);

      if (!shouldRefreshExisting && existing?.isFile() && existing.size > 0) {
        await fs.rm(legacyJpegFile, { force: true });
        skipped += 1;
        return;
      }

      const sourceBuffer = await fetch_youtube_thumbnail(videoId);

      if (!sourceBuffer) {
        failed += 1;
        console.warn(`WARN thumbnail download failed for ${videoId}`);
        return;
      }

      await write_resized_thumbnail(sourceBuffer, outputFile, imageWidth, imageHeight);
      await fs.rm(legacyJpegFile, { force: true });
      downloaded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`WARN thumbnail processing failed for ${videoId}: ${message}`);
    }
  });

  await fs.writeFile(outputSettingsPath, `${JSON.stringify(outputSettings, null, 2)}\n`, 'utf8');

  console.log(`Processed ${videoIds.length} YouTube thumbnails from ${eventFiles.length} events files`);
  console.log(`Downloaded: ${downloaded}, skipped existing: ${skipped}, failed: ${failed}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
