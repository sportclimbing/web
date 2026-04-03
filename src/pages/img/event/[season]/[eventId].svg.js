import { getAllSeasons, getSeasonEventsPayload } from '../../../../lib/events-data';
import { build_event_og_image_svg } from '../../../../lib/og-images';

const normalized_event_id = (value) => String(value ?? '').trim();

export function getStaticPaths() {
  return getAllSeasons().flatMap((seasonValue) => {
    const season = String(seasonValue);
    const payload = getSeasonEventsPayload(season);
    const events = Array.isArray(payload?.events) ? payload.events : [];

    return events
      .map((event) => {
        const eventId = normalized_event_id(event?.id);

        if (!eventId) {
          return null;
        }

        return {
          params: {
            season,
            eventId,
          },
          props: {
            season,
            event,
          },
        };
      })
      .filter(Boolean);
  });
}

export function GET({ props }) {
  const season = String(props?.season || '').trim();
  const event = props?.event || null;
  const eventId = normalized_event_id(event?.id);

  if (!season || !event || !eventId) {
    return new Response('Not found', { status: 404 });
  }

  const image = build_event_og_image_svg({ season, event });

  return new Response(image, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
