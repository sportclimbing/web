import fs from 'node:fs';
import path from 'node:path';

const EVENTS_DIR = path.join(process.cwd(), 'public', 'events');
const SEASONS_FILE = path.join(EVENTS_DIR, 'seasons.json');

const eventsCache = new Map();

const parseJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const seasonsJson = parseJsonFile(SEASONS_FILE);
const seasons = Array.isArray(seasonsJson.seasons) ? seasonsJson.seasons.map(String) : [];

export const getAllSeasons = () => [...seasons];

export const getLatestSeason = () => {
  const sorted = [...seasons].sort((a, b) => Number(b) - Number(a));

  return sorted[0] || '2026';
};

export const getSeasonEventsPayload = (season) => {
  const normalizedSeason = String(season);

  if (!eventsCache.has(normalizedSeason)) {
    const filePath = path.join(EVENTS_DIR, `events_${normalizedSeason}.json`);
    const payload = parseJsonFile(filePath);
    eventsCache.set(normalizedSeason, payload);
  }

  return eventsCache.get(normalizedSeason);
};
