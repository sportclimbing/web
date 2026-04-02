const EVENT_ID_PATTERN = /-(\d+)$/;

const normalize_slug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalize_event_id = (event) => {
  const rawId = String(event?.id ?? '').trim();
  const parsedId = Number.parseInt(rawId, 10);

  if (Number.isNaN(parsedId)) {
    return '';
  }

  return String(parsedId);
};

export const build_event_page_slug_id_segment = (event) => {
  const eventId = normalize_event_id(event);

  if (!eventId) {
    return '';
  }

  const slug = normalize_slug(event?.slug) || normalize_slug(event?.name) || 'event';
  const eventIdSuffix = `-${eventId}`;
  const slugWithoutDuplicatedId = slug.endsWith(eventIdSuffix)
    ? slug.slice(0, -eventIdSuffix.length)
    : slug;
  const normalizedSlug = slugWithoutDuplicatedId || slug;

  return `${normalizedSlug}-${eventId}`;
};

export const build_event_page_path = (season, event) => {
  const normalizedSeason = encodeURIComponent(String(season || '').trim());
  const slugIdSegment = build_event_page_slug_id_segment(event);

  if (!normalizedSeason || !slugIdSegment) {
    return '';
  }

  return `/season/${normalizedSeason}/event/${slugIdSegment}`;
};

export const event_id_from_slug_id_segment = (slugIdSegment) => {
  const match = EVENT_ID_PATTERN.exec(String(slugIdSegment || '').trim());

  if (!match) {
    return '';
  }

  return match[1];
};
