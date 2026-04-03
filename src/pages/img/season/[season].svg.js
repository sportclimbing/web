import { getAllSeasons, getSeasonEventsPayload } from '../../../lib/events-data';
import { build_season_og_image_svg } from '../../../lib/og-images';

export function getStaticPaths() {
  return getAllSeasons().map((seasonValue) => {
    const season = String(seasonValue);
    const payload = getSeasonEventsPayload(season);
    const events = Array.isArray(payload?.events) ? payload.events : [];

    return {
      params: { season },
      props: {
        season,
        eventCount: events.length,
      },
    };
  });
}

export function GET({ props }) {
  const season = String(props?.season || '').trim();
  const eventCount = Number(props?.eventCount || 0);

  if (!season) {
    return new Response('Not found', { status: 404 });
  }

  const image = build_season_og_image_svg({ season, eventCount });

  return new Response(image, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
