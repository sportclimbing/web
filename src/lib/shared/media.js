const YOUTUBE_VIDEO_ID_PATTERN = /youtu(\.be|be\.com)\/(live\/|watch\?v=)?(?<video_id>[a-zA-Z0-9_-]{10,})/;
const DEFAULT_MENS_VIDEO_ID = 'emrHdLsJTk4';
const DEFAULT_WOMENS_VIDEO_ID = 'MQeQs6K_T5g';

export const extract_youtube_video_id = (url) => {
  const match = String(url || '').match(YOUTUBE_VIDEO_ID_PATTERN);

  if (match) {
    return match.groups.video_id;
  }

  return null;
};

export const youtube_thumbnail_local_path = (videoId) => {
  const normalizedVideoId = String(videoId || '').trim();
  return `/images/thumb/${normalizedVideoId}.webp`;
};

export const youtube_thumbnail_remote_path = (videoId, variant = 0) => {
  const normalizedVideoId = String(videoId || '').trim();
  const normalizedVariant = String(variant);
  return `https://img.youtube.com/vi/${normalizedVideoId}/${normalizedVariant}.jpg`;
};

export const photo_filename_from_url_build = (photoUrl) => {
  const url = String(photoUrl || '').trim();

  if (!url) {
    return '';
  }

  let pathname = '';

  try {
    pathname = new URL(url).pathname || '';
  } catch (_error) {
    pathname = url.split(/[?#]/)[0] || '';
  }

  const pathParts = pathname.split('/').filter(Boolean);

  if (!pathParts.length) {
    return '';
  }

  const fileName = pathParts[pathParts.length - 1];

  if (!fileName || fileName === '.' || fileName === '..') {
    return '';
  }

  const extensionIndex = fileName.lastIndexOf('.');
  const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;

  if (!baseName || baseName === '.' || baseName === '..') {
    return '';
  }

  return `${baseName}.webp`;
};

const normalize_athlete_name_part = (value) => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '';
  }

  return normalized
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const athlete_id_from_photo_url_build = (photoUrl) => {
  const url = String(photoUrl || '').trim();
  const match = url.match(/\/athletes\/(\d+)\/photo/);
  return match ? match[1] : null;
};

export const athlete_photo_filename_from_name_build = (athlete) => {
  const firstName = normalize_athlete_name_part(athlete?.first_name);
  const lastName = normalize_athlete_name_part(athlete?.last_name);
  const baseName = `${firstName}-${lastName}`.replace(/^-+|-+$/g, '');

  if (baseName) {
    return `${baseName}.webp`;
  }

  const athleteId = String(athlete?.athlete_id ?? '').trim();

  if (/^\d+$/.test(athleteId)) {
    return `athlete-${athleteId}.webp`;
  }

  return '';
};

export const athlete_photo_local_sources_build = (athlete) => {
  const remotePhotoUrl = typeof athlete?.photo_url === 'string' ? athlete.photo_url.trim() : '';

  if (!remotePhotoUrl) {
    return null;
  }

  const preferredFileName = athlete_photo_filename_from_name_build(athlete);

  if (!preferredFileName) {
    return null;
  }

  return {
    src: `/img/athletes/${preferredFileName}`,
    fallbackSrc: remotePhotoUrl,
  };
};

export const video_id_from_stream = (round) => {
  const youtubeVideoId = extract_youtube_video_id(round.stream_url);

  if (youtubeVideoId) {
    return youtubeVideoId;
  }

  return round.categories.includes('women') ? DEFAULT_WOMENS_VIDEO_ID : DEFAULT_MENS_VIDEO_ID;
}
