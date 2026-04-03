const YOUTUBE_VIDEO_ID_PATTERN = /youtu(\.be|be\.com)\/(live\/|watch\?v=)?(?<video_id>[a-zA-Z0-9_-]{10,})/;

export const extract_youtube_video_id = (url) => {
  const match = String(url || '').match(YOUTUBE_VIDEO_ID_PATTERN);

  if (match) {
    return match.groups.video_id;
  }

  return null;
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

  return `${baseName}.jpg`;
};

export const video_id_from_stream = (round) => {
  const youtubeVideoId = extract_youtube_video_id(round.stream_url);

  if (youtubeVideoId) {
    return youtubeVideoId;
  }

  return round.categories.includes('women') ? 'MQeQs6K_T5g' : 'emrHdLsJTk4';
}
