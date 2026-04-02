const DEFAULT_SEASON = '2026';
const EVENT_TIMEZONE = 'Europe/Madrid';
const TOOLTIP_TEMPLATE = '<div class="tooltip sync-tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>';
const SEASON_SELECTOR = 'select[name="season-selector"]';
const MOBILE_VIEWPORT_MEDIA_QUERY = '(max-width: 500px)';
const MONTH_NAV_LEFT_CSS_VAR = '--season-month-nav-left';

let config;

const set_local_timezone_message = () => {
    const timezoneElement = document.getElementById('footer-timezone-name');
    let timezone = EVENT_TIMEZONE;

    try {
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (detectedTimezone) {
            timezone = detectedTimezone;
        }
    } catch (_error) {
        timezone = EVENT_TIMEZONE;
    }

    timezoneElement.textContent = timezone;
};

let selectedEvent = null;
let visibleEventIds = new Set();
let seasonTimeline = {
    liveRound: null,
    liveEvent: null,
    nextRound: null,
    nextEvent: null,
    liveRoundKey: '',
    nextRoundKey: '',
    seasonHasUpcomingEvents: false,
};
let monthNavigationFrameId = null;
let monthNavHorizontalFrameId = null;

const is_mobile_viewport = () => window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches;

const clear_element_children = (element) => {
    if (!element) {
        return;
    }

    while (element.lastElementChild) {
        element.removeChild(element.lastElementChild);
    }
};

const reset_next_event = () => {
    const nextEventContainer = document.querySelector('.next-event');
    const nextEventDividers = document.querySelectorAll('.next-event-divider');
    const nextEventDetails = document.getElementById('next-event-details');
    const nextEventTitle = document.getElementById('next-event-title');

    stop_next_event_countdown();

    if (nextEventDetails) {
        release_lazy_backgrounds(nextEventDetails);
        clear_element_children(nextEventDetails);
    }

    if (nextEventTitle) {
        nextEventTitle.innerText = '';
    }

    if (nextEventContainer) {
        nextEventContainer.style.display = 'none';
    }

    nextEventDividers.forEach((divider) => {
        divider.style.display = 'none';
    });
};

const next_event_round_from_element = (roundElement) => {
    if (!(roundElement instanceof HTMLElement)) {
        return null;
    }

    const streamTrigger = roundElement.querySelector('.youtube-play-button, [data-action="round-stream"]');

    if (!(streamTrigger instanceof HTMLElement)) {
        return null;
    }

    const startsAt = roundElement.dataset.roundStartsAt || '';
    const endsAt = roundElement.dataset.roundEndsAt || '';

    if (!startsAt || !endsAt) {
        return null;
    }

    const startsAtTimestamp = Date.parse(startsAt);
    const endsAtTimestamp = Date.parse(endsAt);

    if (Number.isNaN(startsAtTimestamp) || Number.isNaN(endsAtTimestamp)) {
        return null;
    }

    const roundNameElement = roundElement.querySelector('.round-name');
    const roundName = roundElement.dataset.roundName
        || (roundNameElement && roundNameElement.textContent ? roundNameElement.textContent.trim() : '');
    const roundKey = roundElement.dataset.roundKey || '';
    const streamUrl = streamTrigger.hasAttribute('data-round-stream-url')
        ? (streamTrigger.dataset.roundStreamUrl || '')
        : '';

    return {
        name: roundName,
        kind: roundElement.dataset.roundKind || '',
        disciplines: parse_round_metadata_tokens(roundElement.dataset.roundDisciplines),
        categories: parse_round_metadata_tokens(roundElement.dataset.roundCategories),
        starts_at: startsAt,
        ends_at: endsAt,
        stream_url: streamUrl,
        roundKey,
        startsAtTimestamp,
    };
};

const next_event_details_from_card = (eventCard) => {
    if (!(eventCard instanceof HTMLElement)) {
        return null;
    }

    const rawEventId = eventCard.dataset.eventId || '';
    const parsedEventId = parseInt(rawEventId, 10);

    if (Number.isNaN(parsedEventId)) {
        return null;
    }

    const eventNameElement = eventCard.querySelector('.event-name');
    const startListElement = eventCard.querySelector('.event-start-list');
    const startListTrigger = startListElement ? startListElement.querySelector('.event-start-list-trigger') : null;
    const pendingStartListCopy = startListElement && startListElement.textContent
        ? startListElement.textContent.trim()
        : '';

    return {
        id: parsedEventId,
        name: eventNameElement && eventNameElement.textContent ? eventNameElement.textContent.trim() : '',
        season: String(get_selected_season() || ''),
        start_list: [],
        nextEventStartListTrigger: startListTrigger || null,
        nextEventStartListHasAvatars: Boolean(startListElement && startListElement.classList.contains('event-start-list-has-avatars')),
        nextEventStartListPendingText: pendingStartListCopy || '📋 Start List: Pending',
    };
};

const collect_visible_round_candidates_from_dom = () => {
    const roundElements = Array.from(document.querySelectorAll('#accordion .ifsc-league-card[data-event-id]:not([hidden]) .event-round-card[data-round-key]:not([hidden])'));
    const cachedEventsById = new Map();

    return roundElements.map((roundElement, domIndex) => {
        const eventCard = roundElement.closest('.ifsc-league-card[data-event-id]');

        if (!(eventCard instanceof HTMLElement)) {
            return null;
        }

        const eventId = eventCard.dataset.eventId || '';

        if (!eventId) {
            return null;
        }

        let event = cachedEventsById.get(eventId);

        if (!event) {
            event = next_event_details_from_card(eventCard);

            if (!event) {
                return null;
            }

            cachedEventsById.set(eventId, event);
        }

        const round = next_event_round_from_element(roundElement);

        if (!round) {
            return null;
        }

        return {
            event,
            round,
            roundKey: round.roundKey || (roundElement.dataset.roundKey || ''),
            domIndex,
        };
    }).filter(Boolean);
};

const ranked_visible_round_candidates = () => collect_visible_round_candidates_from_dom()
    .filter(({ round }) => !round_is_non_speed_qualification(round))
    .sort((a, b) => a.round.startsAtTimestamp - b.round.startsAtTimestamp || a.domIndex - b.domIndex);

const compute_dom_season_timeline = () => {
    const candidates = ranked_visible_round_candidates();
    const liveCandidate = candidates.find(({ round }) => event_is_streaming(round)) || null;
    const nextCandidate = liveCandidate ? null : (candidates.find(({ round }) => event_is_upcoming(round)) || null);

    return {
        liveRound: liveCandidate ? liveCandidate.round : null,
        liveEvent: liveCandidate ? liveCandidate.event : null,
        nextRound: nextCandidate ? nextCandidate.round : null,
        nextEvent: nextCandidate ? nextCandidate.event : null,
        liveRoundKey: liveCandidate ? liveCandidate.roundKey : '',
        nextRoundKey: nextCandidate ? nextCandidate.roundKey : '',
        seasonHasUpcomingEvents: Boolean(liveCandidate || nextCandidate),
    };
};

const get_next_event_from_visible_rounds = () => {
    const timeline = compute_dom_season_timeline();

    return timeline.liveEvent || timeline.nextEvent || null;
};

const create_round_reminder_button = () => {
    const reminderButton = document.createElement('a');
    reminderButton.className = 'ifsc-action-button ifsc-action-button-primary button-reminder';
    reminderButton.href = 'https://github.com/sportclimbing/ifsc-calendar/wiki';
    reminderButton.rel = 'noopener';
    reminderButton.role = 'button';
    reminderButton.target = '_blank';
    reminderButton.dataset.bsToggle = 'modal';
    reminderButton.dataset.bsTarget = '#calendar-modal';
    reminderButton.textContent = '📆 Set Reminder';

    return reminderButton;
};

const create_round_results_button = (eventId) => {
    const resultsButton = document.createElement('a');
    resultsButton.className = 'ifsc-action-button ifsc-action-button-primary button-results';
    resultsButton.href = `https://ifsc.results.info/event/${eventId}`;
    resultsButton.role = 'button';
    resultsButton.target = '_blank';
    resultsButton.rel = 'noopener';
    resultsButton.textContent = '🏆 Results';

    return resultsButton;
};

const ensure_round_action_button = (roundElement, type, eventId) => {
    if (!(roundElement instanceof HTMLElement)) {
        return null;
    }

    const selector = type === 'results' ? '.button-results' : '.button-reminder';
    const watchButton = roundElement.querySelector('.watch-button');

    if (!(watchButton instanceof HTMLElement)) {
        return null;
    }

    const existingButton = watchButton.querySelector(selector);

    if (existingButton instanceof HTMLElement) {
        if (type === 'results') {
            existingButton.href = `https://ifsc.results.info/event/${eventId}`;
        }

        return existingButton;
    }

    const createdButton = type === 'results'
        ? create_round_results_button(eventId)
        : create_round_reminder_button();

    watchButton.appendChild(createdButton);

    return createdButton;
};

const render_event_rounds = (eventId) => {
    const parsedEventId = parseInt(eventId, 10);

    if (Number.isNaN(parsedEventId)) {
        return;
    }

    const eventElement = document.getElementById(`event-${parsedEventId}`);

    if (!eventElement) {
        return;
    }

    const roundsList = eventElement.getElementsByTagName('ul')[0];
    const poster = document.querySelector(`#heading_${parsedEventId} .event-poster`);

    if (!roundsList) {
        return;
    }

    const roundElements = Array.from(roundsList.querySelectorAll('.event-round-card[data-round-key]'));
    let posterShouldBeBw = false;

    roundElements.forEach((roundElement) => {
        if (roundElement.hidden) {
            return;
        }

        const round = next_event_round_from_element(roundElement);

        if (!round) {
            return;
        }

        const roundKey = round.roundKey || (roundElement.dataset.roundKey || '');

        const streamButton = roundElement.querySelector('[data-action="round-stream"]');
        const startsIn = roundElement.querySelector('.round-starts-in');
        let resultsButton = roundElement.querySelector('.button-results');
        let reminderButton = roundElement.querySelector('.button-reminder');

        set_round_details(roundElement, round);

        if (event_is_streaming(round)) {
            resultsButton = ensure_round_action_button(roundElement, 'results', parsedEventId) || resultsButton;

            if (startsIn) {
                startsIn.innerText = '🔴 Live Now';
            }

            if (resultsButton) {
                resultsButton.style.setProperty('display', 'inline-grid', 'important');
                resultsButton.href = `https://ifsc.results.info/event/${parsedEventId}`;
            }

            if (reminderButton) {
                reminderButton.style.setProperty('display', 'none', 'important');
            }

            if (streamButton) {
                streamButton.style.display = '';
            }

            return;
        }

        if (event_is_upcoming(round)) {
            reminderButton = ensure_round_action_button(roundElement, 'reminder', parsedEventId) || reminderButton;
            const isNextRound = !seasonTimeline.liveRoundKey
                && Boolean(seasonTimeline.nextRoundKey)
                && seasonTimeline.nextRoundKey === roundKey;

            if (startsIn) {
                if (round_is_non_speed_qualification(round)) {
                    startsIn.innerText = '🟡 Qualification will not be streamed';
                } else if (isNextRound) {
                    startsIn.innerText = `🟢 Next Event (starts ${pretty_starts_in(round)})`;
                } else {
                    startsIn.innerText = `⌛ Starts ${pretty_starts_in(round)}`;
                }
            }

            if (!isNextRound) {
                posterShouldBeBw = true;
            }

            if (reminderButton) {
                reminderButton.style.setProperty('display', 'inline-grid', 'important');
            }

            if (resultsButton) {
                resultsButton.style.setProperty('display', 'none', 'important');
            }

            if (streamButton) {
                streamButton.style.display = '';
            }

            return;
        }

        if (startsIn) {
            startsIn.innerText = `🏁 ${pretty_finished_ago(round)}`;
        }

        resultsButton = ensure_round_action_button(roundElement, 'results', parsedEventId) || resultsButton;

        if (resultsButton) {
            resultsButton.style.setProperty('display', 'inline-grid', 'important');
            resultsButton.href = `https://ifsc.results.info/event/${parsedEventId}`;
        }

        if (reminderButton) {
            reminderButton.style.setProperty('display', 'none', 'important');
        }

        if (streamButton) {
            streamButton.style.display = '';
        }
    });

    if (poster) {
        poster.classList.toggle('bw', posterShouldBeBw);
    }
};

const get_accordion_state = (accordion) => {
    const currentOpenElement = accordion.querySelector('.show');
    const currentOpenId = currentOpenElement ? currentOpenElement.getAttribute('id') : null;
    const allCollapsed = accordion.childElementCount > 0 && !currentOpenId;

    return {
        currentOpenId,
        allCollapsed,
    };
};

const update_next_event_panel = () => {
    reset_next_event();

    if (seasonTimeline.liveRound && seasonTimeline.liveEvent) {
        set_next_event(seasonTimeline.liveRound, seasonTimeline.liveEvent, true);
        return;
    }

    if (seasonTimeline.nextRound && seasonTimeline.nextEvent) {
        set_next_event(seasonTimeline.nextRound, seasonTimeline.nextEvent, false);
    }
};

const hide_static_event_fallback = () => {
    const fallback = document.getElementById('static-event-fallback');

    if (fallback) {
        fallback.setAttribute('hidden', 'hidden');
    }
};
