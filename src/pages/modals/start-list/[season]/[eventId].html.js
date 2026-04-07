import { getAllSeasons, getSeasonEventsPayload } from '../../../../lib/events-data';
import { build_start_list_modal_fragment } from '../../../../lib/start-list-modal-fragments';

export function getStaticPaths() {
  const paths = [];

  getAllSeasons().forEach((season) => {
    const payload = getSeasonEventsPayload(season);
    const events = Array.isArray(payload?.events) ? payload.events : [];

    events.forEach((event) => {
      const eventId = event?.id === undefined || event?.id === null ? '' : String(event.id);

      if (!eventId) {
        return;
      }

      paths.push({
        params: {
          season: String(season),
          eventId,
        },
        props: {
          fragment: build_start_list_modal_fragment({
            eventName: event?.name || '',
            startList: Array.isArray(event?.start_list) ? event.start_list : [],
            eventId,
          }),
        },
      });
    });
  });

  return paths;
}

export function GET({ props }) {
  return new Response(String(props?.fragment || ''), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
