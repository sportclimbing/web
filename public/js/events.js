dayjs.extend(window.dayjs_plugin_relativeTime);
dayjs.extend(window.dayjs_plugin_isBetween);

const DEFAULT_SEASON = '2026';
const EVENT_TIMEZONE = 'Europe/Madrid';
const EVENTS_CACHE_OPTIONS = { cache: 'no-cache' };
const TOOLTIP_TEMPLATE = '<div class="tooltip sync-tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner"></div></div>';
const SEASON_SELECTOR = 'select[name="season-selector"]';
const STRUCTURED_DATA_EVENTS_SCRIPT_ID = 'structured-data-events';
const MOBILE_VIEWPORT_MEDIA_QUERY = '(max-width: 500px)';

let config;

const month_index_from_starts_at = (startsAt) => {
    const match = /^(\d{4})-(\d{2})-/.exec(startsAt || '');

    if (!match) {
        return null;
    }

    const monthIndex = parseInt(match[2], 10) - 1;

    if (monthIndex < 0 || monthIndex > 11) {
        return null;
    }

    return monthIndex;
};

const set_footer_copyright_year = () => {
    const yearElement = document.getElementById('footer-copyright-year');

    if (!yearElement) {
        return;
    }

    yearElement.textContent = String(new Date().getFullYear());
};

const set_local_timezone_message = () => {
    const timezoneElement = document.getElementById('footer-timezone-name');

    if (!timezoneElement) {
        return;
    }

    timezoneElement.textContent = EVENT_TIMEZONE;
};

let selectedSeason = get_selected_season();
let selectedEvent = get_selected_event();
let filteredEventsById = new Map();
let lastEventsVersionBySeason = new Map();
let pendingHashEventNavigation = Boolean(selectedEvent);
let seasonTimeline = {
    liveRound: null,
    liveEvent: null,
    nextRound: null,
    nextEvent: null,
    seasonHasUpcomingEvents: false,
};
let monthNavigationFrameId = null;

const is_mobile_viewport = () => window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches;

const clear_element_children = (element) => {
    if (!element) {
        return;
    }

    while (element.lastElementChild) {
        element.removeChild(element.lastElementChild);
    }
};

const update_season_label = (season) => {
    const heroKicker = document.getElementById('hero-kicker');

    if (heroKicker) {
        heroKicker.textContent = `Live Schedule ${season}`;
    }
};

const render_footer_season_links = (seasons) => {
    const seasonNav = document.getElementById('footer-seasons-nav');

    if (!seasonNav) {
        return;
    }

    const sortedSeasons = [...seasons].sort((a, b) => Number(a) - Number(b));

    clear_element_children(seasonNav);

    sortedSeasons.forEach((season) => {
        const link = document.createElement('a');
        link.className = 'footer-season-link';
        link.href = `/#/season/${season}`;
        link.dataset.seasonLink = '';
        link.dataset.season = season;
        link.textContent = season;
        seasonNav.appendChild(link);
    });

    update_footer_season_links(selectedSeason);
};

const sync_season_selector = (season) => {
    const seasonSelector = document.querySelector(SEASON_SELECTOR);

    if (!seasonSelector || !season || seasonSelector.value === season) {
        return;
    }

    seasonSelector.value = season;
};

const update_footer_season_links = (season) => {
    const seasonLinks = document.querySelectorAll('[data-season-link]');
    const normalizedSeason = String(season);

    seasonLinks.forEach((link) => {
        const isActive = link.dataset.season === normalizedSeason;

        link.classList.toggle('is-active', isActive);

        if (isActive) {
            link.setAttribute('aria-current', 'page');
            return;
        }

        link.removeAttribute('aria-current');
    });
};

const ensure_structured_data_events_script = () => {
    let script = document.getElementById(STRUCTURED_DATA_EVENTS_SCRIPT_ID);

    if (script) {
        return script;
    }

    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = STRUCTURED_DATA_EVENTS_SCRIPT_ID;
    document.head.appendChild(script);

    return script;
};

const update_structured_data_events = async (season) => {
    const script = ensure_structured_data_events_script();
    const path = `structured-data/events_${season}.json`;

    try {
        const response = await fetch(path, EVENTS_CACHE_OPTIONS);

        if (!response.ok) {
            throw new Error(`Structured data not found at ${path}`);
        }

        script.textContent = await response.text();
    } catch (error) {
        console.warn(error);
        script.textContent = '{}';
        return;
    }
};

const fetch_seasons = (async () => {
    update_season_label(selectedSeason);
    update_footer_season_links(selectedSeason);

    const response = await fetch(`events/seasons.json`);
    const jsonData = await response.json();
    const seasons = Array.isArray(jsonData.seasons) ? jsonData.seasons : [];
    const seasonSelector = document.querySelector(SEASON_SELECTOR);

    render_footer_season_links(seasons);

    if (!seasonSelector) {
        return;
    }

    seasons.forEach((season) => {
        let option = document.createElement('option');
        option.value = season;
        option.innerText = season;

        if (season === selectedSeason) {
            option.selected = true;
        }

        seasonSelector.appendChild(option);
    });

    sync_season_selector(selectedSeason);
});

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

const compute_season_timeline = (events) => {
    const entries = [];

    events.forEach((event) => {
        event.rounds.forEach((round) => {
            entries.push({ event, round });
        });
    });

    entries.sort((a, b) => new Date(a.round.starts_at) - new Date(b.round.starts_at));

    const timelineEntries = entries.filter(({ round }) => !round_is_non_speed_qualification(round));
    const liveEntry = timelineEntries.find(({ round }) => event_is_streaming(round)) || null;
    const nextEntry = timelineEntries.find(({ round }) => event_is_upcoming(round)) || null;

    return {
        liveRound: liveEntry ? liveEntry.round : null,
        liveEvent: liveEntry ? liveEntry.event : null,
        nextRound: liveEntry ? null : (nextEntry ? nextEntry.round : null),
        nextEvent: liveEntry ? null : (nextEntry ? nextEntry.event : null),
        seasonHasUpcomingEvents: Boolean(liveEntry || nextEntry),
    };
};

const compute_next_event_timeline = (filteredEvents, allEvents) => {
    const filteredTimeline = compute_season_timeline(filteredEvents);

    if (filteredTimeline.liveRound || filteredTimeline.nextRound) {
        return filteredTimeline;
    }

    return compute_season_timeline(allEvents);
};

const render_event_rounds = (eventId) => {
    const parsedEventId = parseInt(eventId, 10);

    if (Number.isNaN(parsedEventId)) {
        return;
    }

    const eventElement = document.getElementById(`event-${parsedEventId}`);

    if (!eventElement || eventElement.dataset.roundsRendered === '1') {
        return;
    }

    const event = filteredEventsById.get(parsedEventId);
    const roundsList = eventElement.getElementsByTagName('ul')[0];
    const roundTemplate = document.getElementById('ifsc-event');
    const poster = document.querySelector(`#heading_${parsedEventId} .event-poster`);

    if (!event || !roundsList || !roundTemplate) {
        return;
    }

    event.rounds.forEach((round) => {
        let clone = roundTemplate.content.cloneNode(true);
        const streamButton = $('.round-stream-button', clone);
        const startsIn = clone.querySelector('.js-starts-in');
        clone.querySelector('.ifsc-event').classList.add('event-round-card');

        set_round_details(clone, round);

        if (event_is_streaming(round)) {
            if (startsIn) {
                startsIn.innerText = `🔴 Live Now`;
            }
            clone.querySelector('.button-results').style.setProperty('display', 'inline-grid', 'important');
            clone.querySelector('.button-results').href = `https://ifsc.results.info/event/${event.id}`;
        } else if (event_is_upcoming(round)) {
            const isNextRound = !seasonTimeline.liveRound && seasonTimeline.nextRound === round;

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
                if (poster) {
                    poster.classList.add('bw');
                }
            }

            clone.querySelector('.button-reminder').style.setProperty('display', 'inline-grid', 'important');

            if (!round.stream_url) {
                streamButton.hide();
            }

            clone.querySelector('.button-results').style.setProperty('display', 'none', 'important');
        } else {
            if (startsIn) {
                startsIn.innerText = `🏁 ${pretty_finished_ago(round)}`;
            }
            clone.querySelector('.button-results').style.setProperty('display', 'inline-grid', 'important');
            clone.querySelector('.button-results').href = `https://ifsc.results.info/event/${event.id}`;
        }

        roundsList.appendChild(clone);
    });

    eventElement.dataset.roundsRendered = '1';
};

const get_events_version = (headers) => headers.get('etag') || headers.get('last-modified');

const fetch_events_for_selected_season = async ({ skipUnchanged = false } = {}) => {
    const eventsUrl = `events/events_${selectedSeason}.json`;

    if (skipUnchanged) {
        const headResponse = await fetch(eventsUrl, {
            method: 'HEAD',
            cache: EVENTS_CACHE_OPTIONS.cache,
        });
        const currentVersion = get_events_version(headResponse.headers);
        const previousVersion = lastEventsVersionBySeason.get(selectedSeason);

        if (currentVersion && previousVersion === currentVersion) {
            return null;
        }
    }

    const response = await fetch(eventsUrl, EVENTS_CACHE_OPTIONS);
    const jsonData = await response.json();
    const currentVersion = get_events_version(response.headers);

    if (currentVersion) {
        lastEventsVersionBySeason.set(selectedSeason, currentVersion);
    }

    return jsonData;
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
        set_next_event(seasonTimeline.nextRound, seasonTimeline.nextEvent);
    }
};

const hide_static_event_fallback = () => {
    const fallback = document.getElementById('static-event-fallback');

    if (fallback) {
        fallback.setAttribute('hidden', 'hidden');
    }
};

const clear_accordion = (accordion) => {
    release_lazy_backgrounds(accordion);
    clear_element_children(accordion);
};

const build_event_card = (leagueTemplate, event) => {
    const clone = leagueTemplate.content.cloneNode(true);
    const leagueCard = clone.querySelector('.ifsc-league-card');
    const eventStartMonth = month_index_from_starts_at(event.starts_at);

    set_event_name(clone.querySelector('.event-name'), event);
    set_event_date(clone.querySelector('.event-date'), event);
    set_event_country(clone.querySelector('.event-country'), event);
    set_event_discipline(clone.querySelector('.event-disciplines'), event);
    set_event_streams(clone.querySelector('.event-status'), event);
    set_event_page(clone.querySelector('.event-page'), event);
    set_event_start_list(clone.querySelector('.event-start-list'), event);
    set_event_schedule_status(clone.querySelector('.event-schedule-status'), event);
    set_event_poster(clone.querySelector('.event-poster'), event);

    const eventPanel = clone.getElementById('event-n');
    const heading = clone.getElementById('heading_id');
    const eventNameButton = clone.querySelector('.event-name');
    const eventWatchButton = clone.querySelector('.event-watch-button');
    const headingId = `heading_${event.id}`;
    const eventToggleId = `event-toggle-${event.id}`;
    const panelId = `event-${event.id}`;

    if (leagueCard && eventStartMonth !== null) {
        leagueCard.dataset.eventStartMonth = String(eventStartMonth);
    }

    heading.id = headingId;
    eventNameButton.id = eventToggleId;
    eventNameButton.setAttribute('aria-controls', panelId);
    eventPanel.setAttribute('aria-labelledby', eventToggleId);
    eventPanel.id = panelId;
    eventPanel.dataset.roundsRendered = '0';
    eventWatchButton.setAttribute('data-target', `#${panelId}`);
    eventWatchButton.setAttribute('aria-controls', panelId);

    return clone;
};

const append_no_results_message = (accordion) => {
    const div = document.createElement('div');
    div.className = 'no-results';
    div.innerHTML = '<span class="no-results-icon" aria-hidden="true">⚠️</span><span class="no-results-text">No results. Please adjust filters above!</span>';

    accordion.appendChild(div);
};

const render_event_cards = (events, leagueTemplate, accordion) => {
    let roundCount = 0;

    events.forEach((event) => {
        if (event.rounds.length === 0) {
            return;
        }

        filteredEventsById.set(event.id, event);
        roundCount += event.rounds.length;
        accordion.appendChild(build_event_card(leagueTemplate, event));
    });

    if (roundCount === 0) {
        append_no_results_message(accordion);
    }
};

const restore_open_accordion_panel = (currentOpenId, allCollapsed) => {
    const selectedEventElement = document.getElementById(`event-${selectedEvent}`);

    if (allCollapsed) {
        return null;
    }

    if (currentOpenId) {
        const currentOpenElement = document.getElementById(currentOpenId);

        if (currentOpenElement) {
            currentOpenElement.classList.add('show');
            return currentOpenId.replace('event-', '');
        }
    }

    if (selectedEventElement) {
        selectedEventElement.classList.add('show');
        return selectedEvent;
    }

    return null;
};

const expand_and_scroll_to_event_panel = (eventId) => {
    if (!eventId) {
        return false;
    }

    const eventPanel = document.getElementById(`event-${eventId}`);

    if (!eventPanel) {
        return false;
    }

    const $eventPanel = $(eventPanel);
    const heading = document.getElementById(`heading_${eventId}`) || eventPanel.closest('.ifsc-league-card') || eventPanel;
    const scroll_to_panel = () => {
        window.requestAnimationFrame(() => {
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    if ($eventPanel.length && !$eventPanel.hasClass('show')) {
        $eventPanel.one('shown.bs.collapse', () => {
            render_event_rounds(eventId);
            scroll_to_panel();
        });

        const triggerSelector = `.event-name[data-target="#event-${eventId}"], .event-watch-button[data-target="#event-${eventId}"]`;
        const trigger = document.querySelector(triggerSelector);

        if (trigger) {
            trigger.click();
        } else {
            $eventPanel.collapse('show');
        }

        if (!$eventPanel.hasClass('show')) {
            eventPanel.classList.add('show');
        }

        window.setTimeout(scroll_to_panel, 0);
        return true;
    }

    eventPanel.classList.add('show');
    render_event_rounds(eventId);
    scroll_to_panel();
    return true;
};

const refresh = (async (options = {}) => {
    const jsonData = await fetch_events_for_selected_season(options);

    if (!jsonData) {
        return;
    }

    const allEvents = jsonData.events || [];
    const events = apply_search_filters(jsonData);
    const nextEvent = get_next_event(events);
    const leagueTemplate = document.getElementById('ifsc-league');
    const accordion = document.getElementById('accordion');

    if (!leagueTemplate || !accordion) {
        return;
    }

    const { currentOpenId, allCollapsed } = get_accordion_state(accordion);
    const hashEventId = get_selected_event();

    if (hashEventId) {
        selectedEvent = hashEventId;
    }

    if (!selectedEvent && nextEvent) {
        selectedEvent = nextEvent.id;
    }

    filteredEventsById = new Map();
    seasonTimeline = compute_next_event_timeline(events, allEvents);
    clear_event_start_list_modal_data();
    update_next_event_panel();
    clear_accordion(accordion);
    render_event_cards(events, leagueTemplate, accordion);
    setup_start_list_avatar_tooltips();
    update_month_navigation_state();
    hide_static_event_fallback();
    update_structured_data_events(selectedSeason).then();

    const eventIdToRender = restore_open_accordion_panel(currentOpenId, allCollapsed);

    if (eventIdToRender !== null) {
        render_event_rounds(eventIdToRender);
    }

    if (pendingHashEventNavigation && selectedEvent) {
        const didNavigate = expand_and_scroll_to_event_panel(selectedEvent);
        pendingHashEventNavigation = !didNavigate;
    }

    set_favicon(seasonTimeline.liveRound);
});

const setup_season_header_toggle = () => {
    const seasonHeader = document.querySelector('.season-header');
    const $navbarHeader = $('#navbarHeader');

    if (!$navbarHeader.length || !seasonHeader) {
        return;
    }

    const set_open_state = (isOpen) => {
        seasonHeader.classList.toggle('is-open', isOpen);
    };

    set_open_state($navbarHeader.hasClass('show'));
    $navbarHeader.on('show.bs.collapse shown.bs.collapse', () => set_open_state(true));
    $navbarHeader.on('hide.bs.collapse hidden.bs.collapse', () => set_open_state(false));
};

const reset_collapsed_rounds = (eventElement) => {
    release_lazy_backgrounds(eventElement);

    const roundsList = eventElement.getElementsByTagName('ul')[0];

    if (!roundsList) {
        return;
    }

    clear_element_children(roundsList);
    eventElement.dataset.roundsRendered = '0';
};

const update_event_route = (eventId) => {
    const parsedEventId = parseInt(eventId, 10);

    if (Number.isNaN(parsedEventId)) {
        return;
    }

    selectedEvent = parsedEventId;

    const targetUrl = `/#/season/${selectedSeason}/event/${parsedEventId}`;
    const currentUrl = `${window.location.pathname}${window.location.hash}`;

    if (currentUrl === targetUrl) {
        return;
    }

    if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', targetUrl);
        return;
    }

    window.location = targetUrl;
};

const update_season_route = () => {
    const targetUrl = `/#/season/${selectedSeason}`;
    const currentUrl = `${window.location.pathname}${window.location.hash}`;

    if (currentUrl === targetUrl) {
        return;
    }

    if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', targetUrl);
        return;
    }

    window.location = targetUrl;
};

const handle_event_name_click = (event) => {
    const panelTarget = event.currentTarget.getAttribute('data-target') || '';
    const eventId = panelTarget.replace('#event-', '');

    if (!eventId) {
        return;
    }

    update_event_route(eventId);
};

const handle_event_watch_button_click = (event) => {
    const panelTarget = event.currentTarget.getAttribute('data-target') || '';
    const eventId = panelTarget.replace('#event-', '');

    if (!eventId) {
        return;
    }

    update_event_route(eventId);
};

const handle_event_panel_hidden = (eventElement, accordionElement) => {
    reset_collapsed_rounds(eventElement);

    window.setTimeout(() => {
        if (!accordionElement) {
            return;
        }

        const hasOpenPanels = Boolean(accordionElement.querySelector('.collapse.show, .collapse.collapsing'));

        if (hasOpenPanels) {
            return;
        }

        selectedEvent = null;
        update_season_route();
    }, 0);
};

const setup_accordion_handlers = () => {
    const $accordion = $('#accordion');
    const accordionElement = $accordion.get(0);

    $accordion.on('click', '.event-name', handle_event_name_click);
    $accordion.on('click', '.event-watch-button', handle_event_watch_button_click);
    $accordion.on('show.bs.collapse', '.collapse', function () {
        render_event_rounds(this.id.replace('event-', ''));
    });
    $accordion.on('hidden.bs.collapse', '.collapse', function () {
        handle_event_panel_hidden(this, accordionElement);
    });
    $accordion.on('click', '.js-round-stream', handle_round_stream_click);
    $accordion.on('click', '.event-start-list-trigger', handle_start_list_trigger_click);
    $('.next-event').on('click', '.js-round-stream', handle_round_stream_click);
    $('.next-event').on('click', '.event-start-list-trigger', handle_start_list_trigger_click);
};

const setup_layout_handlers = () => {
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            schedule_fit_mobile_hero_title();
            schedule_next_event_mobile_countdown_height_sync();
        });
    }

    addEventListener('resize', () => {
        schedule_fit_mobile_hero_title();
        schedule_next_event_mobile_countdown_height_sync();
    });
};

const handle_hash_change = () => {
    const season = get_selected_season();
    const event = get_selected_event();

    selectedSeason = season;
    sync_season_selector(season);
    update_footer_season_links(season);
    update_season_label(season);
    selectedEvent = null;
    pendingHashEventNavigation = Boolean(event);
    refresh().then();
    schedule_fit_mobile_hero_title();
};

const setup_filter_handlers = () => {
    $('#video-modal').on('hide.bs.modal', () => {
        $('#youtube-video').attr('src', 'about:blank');
    });

    $('#event-not-started-modal').on('hide.bs.modal', () => {
        stop_event_not_started_countdown();
    });

    $('#save-filters').on('click', () => {
        config = load_config_from_modal();
        refresh().then();
        window.localStorage.setItem('config', JSON.stringify(config));
    });

    $('input[type="checkbox"]').on('change', () => refresh());
};

const setup_tracking_pixel = () => {
    if (document.location.hostname !== 'ifsc.stream') {
        return;
    }

    const normalize = (referrer) => encodeURIComponent(referrer.replace('https://', '').replace(/\/$/, ''));
    const img = new Image();
    img.src = 'https://calendar.ifsc.stream/pixel.gif' + (document.referrer ? `?r=${normalize(document.referrer)}` : '');
    img.width = 1;
    img.height = 1;

    document.body.appendChild(img);
};

const setup_season_picker_click_target = () => {
    const seasonLabel = document.querySelector('.season-label');
    const seasonSelect = document.querySelector(SEASON_SELECTOR);

    if (!seasonLabel || !seasonSelect) {
        return;
    }

    seasonLabel.addEventListener('click', (event) => {
        event.preventDefault();
        seasonSelect.focus();

        if (typeof seasonSelect.showPicker === 'function') {
            seasonSelect.showPicker();
            return;
        }

        seasonSelect.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window,
        }));
    });
};

const setup_tooltips = () => {
    $(document).on('click', '.button-reminder', function () {
        this.blur();
    });

    if (is_mobile_viewport()) {
        return;
    }

    const tooltipOptions = {
        container: 'body',
        placement: 'bottom',
        trigger: 'hover',
        template: TOOLTIP_TEMPLATE,
    };

    $('.calendar-sync-tooltip').tooltip(tooltipOptions);
    $('.footer-action-tooltip').tooltip(tooltipOptions);

    $('.calendar-sync-tooltip, .footer-action-tooltip').on('click', function () {
        $(this).tooltip('hide');
        this.blur();
    });
};

const setup_start_list_avatar_tooltips = () => {
    $('.event-start-list-avatar-tooltip').tooltip('dispose');

    if (is_mobile_viewport()) {
        return;
    }

    $('.event-start-list-avatar-tooltip').tooltip({
        container: 'body',
        placement: 'bottom',
        trigger: 'hover',
        template: TOOLTIP_TEMPLATE,
    });
};

const setup_theme_handlers = (systemThemeQuery) => {
    $('#theme-toggle').on('click', () => {
        toggle_theme();

        if (!is_mobile_viewport()) {
            $('#theme-toggle').tooltip('hide');
        }
    });

    if (typeof systemThemeQuery.addEventListener === 'function') {
        systemThemeQuery.addEventListener('change', sync_system_theme);
    } else if (typeof systemThemeQuery.addListener === 'function') {
        systemThemeQuery.addListener(sync_system_theme);
    }
};

const setup_season_navigation = () => {
    $(SEASON_SELECTOR).on('change', (event) => {
        const season = event.target.value;

        selectedSeason = season;
        sync_season_selector(season);
        update_footer_season_links(season);
        update_season_label(season);
        window.location = `#/season/${season}`;
    });
};

const setup_footer_season_navigation = () => {
    $(document).on('click', '[data-season-link]', (event) => {
        const season = event.currentTarget.dataset.season;
        const isModifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.which === 2;

        if (!season || isModifiedClick) {
            return;
        }

        event.preventDefault();
        selectedSeason = season;
        sync_season_selector(season);
        update_footer_season_links(season);
        update_season_label(season);
        window.location = `#/season/${season}`;
    });
};

const scroll_to_first_event_starting_in_month = (monthIndex) => {
    const firstEventInMonth = document.querySelector(`#accordion .ifsc-league-card[data-event-start-month="${monthIndex}"]`);

    if (!firstEventInMonth) {
        return;
    }

    firstEventInMonth.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
};

const get_month_index_from_dataset_value = (monthIndexValue) => {
    if (monthIndexValue === undefined) {
        return null;
    }

    const monthIndex = parseInt(monthIndexValue, 10);

    if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
        return null;
    }

    return monthIndex;
};

const set_active_month_navigation_link = (monthIndex) => {
    const monthNav = document.getElementById('season-month-nav');
    const activeMonthIndex = monthIndex === null ? null : String(monthIndex);

    if (!monthNav) {
        return;
    }

    monthNav.querySelectorAll('.season-month-nav-link[data-month-index]').forEach((button) => {
        const isActive = activeMonthIndex !== null && button.dataset.monthIndex === activeMonthIndex;
        button.classList.toggle('is-active', isActive);

        if (isActive) {
            button.setAttribute('aria-current', 'true');
            return;
        }

        button.removeAttribute('aria-current');
    });
};

const get_active_month_index_from_visible_events = () => {
    const cards = Array.from(document.querySelectorAll('#accordion .ifsc-league-card[data-event-start-month]'));

    if (cards.length === 0) {
        return null;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const referenceLine = Math.min(Math.max(Math.round(viewportHeight * 0.2), 88), 220);

    for (const card of cards) {
        const rect = card.getBoundingClientRect();

        if (rect.top <= referenceLine && rect.bottom > referenceLine) {
            return get_month_index_from_dataset_value(card.dataset.eventStartMonth);
        }
    }

    for (const card of cards) {
        const rect = card.getBoundingClientRect();

        if (rect.top < viewportHeight && rect.bottom > 0) {
            return get_month_index_from_dataset_value(card.dataset.eventStartMonth);
        }
    }

    const lastCard = cards[cards.length - 1];

    if (lastCard.getBoundingClientRect().bottom <= referenceLine) {
        return get_month_index_from_dataset_value(lastCard.dataset.eventStartMonth);
    }

    return null;
};

const sync_active_month_navigation_link = () => {
    set_active_month_navigation_link(get_active_month_index_from_visible_events());
};

const schedule_month_navigation_sync = () => {
    if (monthNavigationFrameId !== null) {
        return;
    }

    monthNavigationFrameId = window.requestAnimationFrame(() => {
        monthNavigationFrameId = null;
        sync_active_month_navigation_link();
    });
};

const update_month_navigation_state = () => {
    const monthNav = document.getElementById('season-month-nav');

    if (!monthNav) {
        return;
    }

    const monthsWithEvents = new Set(
        Array.from(document.querySelectorAll('#accordion .ifsc-league-card[data-event-start-month]'))
            .map((card) => card.dataset.eventStartMonth)
            .filter((monthIndex) => monthIndex !== undefined)
    );

    monthNav.querySelectorAll('.season-month-nav-link[data-month-index]').forEach((button) => {
        const hasEvents = monthsWithEvents.has(button.dataset.monthIndex);
        button.classList.toggle('is-empty', !hasEvents);
        button.setAttribute('aria-disabled', hasEvents ? 'false' : 'true');
    });

    sync_active_month_navigation_link();
};

const setup_month_navigation = () => {
    const monthNav = document.getElementById('season-month-nav');

    if (!monthNav) {
        return;
    }

    monthNav.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;

        if (!target) {
            return;
        }

        const trigger = target.closest('[data-month-index]');

        if (!trigger) {
            return;
        }

        const monthIndex = parseInt(trigger.dataset.monthIndex, 10);

        if (Number.isNaN(monthIndex)) {
            return;
        }

        event.preventDefault();
        scroll_to_first_event_starting_in_month(monthIndex);
    });

    addEventListener('scroll', schedule_month_navigation_sync, { passive: true });
    addEventListener('resize', schedule_month_navigation_sync);
};

(() => {
    restore_theme();
    restore_config();
    set_footer_copyright_year();
    set_local_timezone_message();
    schedule_fit_mobile_hero_title();

    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');

    fetch_seasons().then();
    refresh().then(() => {
        window.setInterval(() => refresh({ skipUnchanged: true }), 1000 * 60);
        schedule_fit_mobile_hero_title();
    });

    setup_season_header_toggle();
    setup_accordion_handlers();
    config = load_config_from_modal();
    setup_layout_handlers();
    addEventListener('hashchange', handle_hash_change);
    setup_filter_handlers();
    setup_tracking_pixel();
    setup_season_picker_click_target();
    setup_tooltips();
    setup_theme_handlers(systemThemeQuery);
    setup_season_navigation();
    setup_footer_season_navigation();
    setup_month_navigation();

    /*
    fetch('http://ip-api.com/json').then(async (response) => {
        let json = await response.json();
        let blocked = [
            "AD",
            "AL",
            "AM",
            "AR",
            "AT",
            "AZ",
            "BA",
            "BE",
            "BG",
            "BO",
            "BR",
            "BY",
            "BZ",
            "CH",
            "CL",
            "CO",
            "CR",
            "CY",
            "CZ",
            "DE",
            "DK",
            "EC",
            "EE",
            "ES",
            "FI",
            "FR",
            "GB",
            "GE",
            "GF",
            "GR",
            "GT",
            "GY",
            "HN",
            "HR",
            "HU",
            "IE",
            "IL",
            "IS",
            "IT",
            "KG",
            "KZ",
            "LI",
            "LT",
            "LU",
            "LV",
            "MC",
            "MD",
            "ME",
            "MK",
            "MT",
            "MX",
            "NI",
            "NL",
            "NO",
            "PA",
            "PE",
            "PL",
            "PT",
            "PY",
            "RO",
            "RS",
            "RU",
            "SE",
            "SI",
            "SK",
            "SM",
            "SR",
            "SV",
            "TJ",
            "TM",
            "TR",
            "UA",
            "UY",
            "UZ",
            "VA",
            "VE"
        ];

        const regionButton = $('.blocked-region')

        if (blocked.includes(json.countryCode)) {
            window.setTimeout(() => {
                let regionBlocked = $('.blocked');
                const message = window.screen.width > 500 ? 'Unsupported Region' : 'Unsupported Region';
                $('.notification').html(message);
                regionButton.show();

                $("p:first", regionBlocked).html(`Live Streams are Geo-Blocked in <strong>${json.country}</strong>!`);
            }, 3000);
        } else {
            regionButton.hide();
        }
    })
    */
})();
