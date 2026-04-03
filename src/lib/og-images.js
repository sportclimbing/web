const SVG_WIDTH = 1200;
const SVG_HEIGHT = 630;

const escape_xml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const truncate_text = (value, limit) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
};

const format_iso_date = (value, timeZone = 'UTC') => {
  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(date);
};

const base_svg = ({ title, subtitle, detail }) => {
  const safeTitle = escape_xml(truncate_text(title, 70));
  const safeSubtitle = escape_xml(truncate_text(subtitle, 96));
  const safeDetail = escape_xml(truncate_text(detail, 110));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1020" />
      <stop offset="100%" stop-color="#2f1140" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff5f6d" />
      <stop offset="100%" stop-color="#e6007e" />
    </linearGradient>
  </defs>
  <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="url(#bg)" />
  <circle cx="1030" cy="110" r="180" fill="rgba(255, 95, 109, 0.15)" />
  <circle cx="140" cy="540" r="220" fill="rgba(81, 196, 255, 0.10)" />
  <rect x="84" y="96" width="324" height="46" rx="23" fill="url(#accent)" />
  <text x="112" y="127" fill="#fff" font-size="24" font-weight="700" font-family="Montserrat, Arial, sans-serif">ifsc.stream</text>
  <text x="84" y="255" fill="#f6f8fb" font-size="66" font-weight="800" font-family="Montserrat, Arial, sans-serif">${safeTitle}</text>
  <text x="84" y="342" fill="#d8deea" font-size="36" font-weight="500" font-family="Montserrat, Arial, sans-serif">${safeSubtitle}</text>
  <text x="84" y="414" fill="#b7c2d8" font-size="30" font-weight="500" font-family="Montserrat, Arial, sans-serif">${safeDetail}</text>
  <text x="84" y="562" fill="#ff8fc4" font-size="30" font-weight="700" font-family="Montserrat, Arial, sans-serif">World Climbing Schedule &amp; Live Streams</text>
</svg>
`;
};

const format_disciplines = (disciplines) => {
  const list = (Array.isArray(disciplines) ? disciplines : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`);

  if (list.length === 0) {
    return 'All disciplines';
  }

  return list.join(' • ');
};

export const build_season_og_image_svg = ({ season, eventCount }) => {
  const normalizedSeason = String(season || '').trim() || 'Season';
  const normalizedEventCount = Number.isFinite(Number(eventCount)) ? Number(eventCount) : 0;

  return base_svg({
    title: `World Climbing Season ${normalizedSeason}`,
    subtitle: `${normalizedEventCount} events • Full calendar and stream schedule`,
    detail: 'Boulder • Lead • Speed',
  });
};

export const build_event_og_image_svg = ({ season, event }) => {
  const eventName = String(event?.name || '').trim() || 'World Climbing Event';
  const location = [event?.location, event?.country]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
  const eventTimeZone = String(event?.timezone || '').trim() || 'UTC';
  const startsAt = format_iso_date(event?.starts_at, eventTimeZone);
  const endsAt = format_iso_date(event?.ends_at, eventTimeZone);
  const dateRange = startsAt && endsAt ? `${startsAt} - ${endsAt}` : startsAt || endsAt || '';
  const seasonLabel = String(season || '').trim();
  const subtitleParts = [location, dateRange, seasonLabel ? `Season ${seasonLabel}` : '']
    .filter(Boolean);

  return base_svg({
    title: eventName,
    subtitle: subtitleParts.join(' • ') || 'World Climbing competition event',
    detail: format_disciplines(event?.disciplines),
  });
};
