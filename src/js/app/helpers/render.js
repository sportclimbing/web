let lazyBackgroundObserver = null;

function get_lazy_background_observer() {
    if (!('IntersectionObserver' in window)) {
        return null;
    }

    if (!lazyBackgroundObserver) {
        lazyBackgroundObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                const element = entry.target;
                const bgSrc = element.dataset.bgSrc;

                if (bgSrc) {
                    set_background_image_now(element, bgSrc);
                } else {
                    observer.unobserve(element);
                }
            });
        }, {
            rootMargin: '200px 0px',
        });
    }

    return lazyBackgroundObserver;
}

function set_background_image_now(element, url) {
    if (!element || !url) {
        return;
    }

    element.dataset.bgSrc = url;
    element.style.backgroundImage = `url(${url})`;

    const observer = get_lazy_background_observer();

    if (observer) {
        observer.unobserve(element);
    }
}

function release_lazy_backgrounds(root) {
    if (!root || typeof root.querySelectorAll !== 'function') {
        return;
    }

    const observer = get_lazy_background_observer();

    if (!observer) {
        return;
    }

    if (root.classList && root.classList.contains('lazy-background')) {
        observer.unobserve(root);
    }

    root.querySelectorAll('.lazy-background').forEach((element) => observer.unobserve(element));
}

function set_round_details(clone, round) {
    if (!clone || !round) {
        return;
    }

    set_round_name(clone.querySelector('.round-name'), round);
    set_round_time(clone.querySelector('.round-time'), round);
    set_round_stream_button(clone.querySelector('[data-action="round-stream"]'), round);
    set_round_stream_button(clone.querySelector('.youtube-play-button'), round);
}

function set_next_event_countdown(round, isStreaming) {
    if (isStreaming || !event_is_upcoming(round)) {
        stop_next_event_countdown();

        return;
    }

    start_next_event_countdown(round);
}
function set_next_event(round, event, isStreaming) {
    const nextEventContainer = document.querySelector('.next-event');
    const nextEventTitle = document.getElementById('next-event-title');
    const nextStatusBadgeLabel = document.getElementById('next-event-status-badge-label');
    const nextWatchButton = document.getElementById('next-event-watch-button');
    const nextDetailsButton = document.getElementById('next-event-details-button');
    const nextCountdown = document.getElementById('next-event-countdown');
    const nextEventLeagueName = document.getElementById('next-event-league-name');

    if (!nextEventContainer) {
        return;
    }

    nextEventContainer.hidden = false;

    if (nextStatusBadgeLabel) {
        nextStatusBadgeLabel.textContent = `${isStreaming ? 'Live Now' : 'Coming Up Next'}${round.name ? `: ${round.name}` : ''}`;
    }

    if (nextEventTitle) {
        nextEventTitle.textContent = event.name;
    }

    if (nextCountdown) {
        nextCountdown.classList.toggle('hidden', isStreaming);
        nextCountdown.hidden = isStreaming;
    }

    if (nextWatchButton) {
        const streamUrl = round.stream_url || '';
        nextWatchButton.classList.toggle('hidden', !isStreaming || !streamUrl);
        nextWatchButton.dataset.roundStreamUrl = streamUrl;
    }

    if (nextDetailsButton) {
        nextDetailsButton.dataset.eventId = event.id;
        if (event.page_path) {
            nextDetailsButton.href = event.page_path;
        }
    }

    if (nextEventLeagueName) {
        const leagueName = typeof event.league_name === 'string' ? event.league_name.trim() : '';
        nextEventLeagueName.textContent = leagueName;
        nextEventLeagueName.hidden = !leagueName;
    }

    set_next_event_countdown(round, isStreaming);
}

function set_round_stream_metadata(element, round) {
    if (!element) {
        return;
    }

    const roundContainer = element.closest('.event-round-card, .ifsc-event') || element;

    roundContainer.dataset.roundName = round.name || '';
    roundContainer.dataset.roundStartsAt = round.starts_at || '';
    roundContainer.dataset.roundEndsAt = round.ends_at || '';
}

function set_round_stream_button(element, round) {
    if (!element) {
        return;
    }

    const tagName = element.tagName;
    const streamUrl = round.stream_url || '';
    const fallbackUrl = streamUrl || STREAMS_FALLBACK_URL;

    set_round_stream_metadata(element, round);
    if (streamUrl) {
        element.dataset.roundStreamUrl = streamUrl;
    } else {
        element.removeAttribute('data-round-stream-url');
    }

    if (tagName === 'A') {
        element.setAttribute('href', fallbackUrl);

        return;
    }

    element.removeAttribute('href');
}

function round_from_stream_button(element) {
    const roundContainer = element instanceof Element ? (element.closest('.event-round-card, .ifsc-event') || element) : null;

    const eventContainer = element instanceof Element ? element.closest('.ifsc-league-card') : null;

    return {
        name: roundContainer ? (roundContainer.dataset.roundName || '') : '',
        event_name: eventContainer ? (eventContainer.dataset.eventName || '') : '',
        starts_at: roundContainer ? (roundContainer.dataset.roundStartsAt || '') : '',
        ends_at: roundContainer ? (roundContainer.dataset.roundEndsAt || '') : '',
    };
}

function round_stream_url_from_target(target) {
    if (!(target instanceof Element) || !target.hasAttribute('data-round-stream-url')) {
        return '';
    }

    return target.dataset.roundStreamUrl || '';
}

function round_fallback_url_from_target(target) {
    return target.href || STREAMS_FALLBACK_URL;
}

function set_round_time(element, round) {
    if (!element || !round) {
        return;
    }

    const startsAtRaw = round.starts_at || '';

    if (!startsAtRaw) {
        return;
    }

    const start = new Date(startsAtRaw);

    if (Number.isNaN(start.getTime())) {
        return;
    }

    element.textContent = make_time_fmt(get_selected_timezone()).format(start);

    const venueTime = venue_time_from_iso(startsAtRaw);

    if (venueTime) {
        element.title = `Venue: ${venueTime}`;
    } else {
        element.removeAttribute('title');
    }
}

function set_round_name(element, round) {
    if (!element || !round) {
        return;
    }

    element.innerText = round.name;
}

const TIMEZONE_STORAGE_KEY = 'ifsc_timezone';

function get_selected_timezone() {
    try {
        return localStorage.getItem(TIMEZONE_STORAGE_KEY) || '';
    } catch (_) {
        return '';
    }
}

function set_selected_timezone(tz) {
    try {
        if (tz) {
            localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
        } else {
            localStorage.removeItem(TIMEZONE_STORAGE_KEY);
        }
    } catch (_) {
        // ignore
    }
}

function make_date_fmt(tz) {
    const opts = { day: 'numeric', month: 'short' };
    if (tz) opts.timeZone = tz;
    return new Intl.DateTimeFormat('en-US', opts);
}

function make_time_fmt(tz) {
    const opts = { hour: '2-digit', minute: '2-digit', hour12: true };
    if (tz) opts.timeZone = tz;
    return new Intl.DateTimeFormat('en-US', opts);
}

function has_non_default_filters() {
    try {
        if (localStorage.getItem(TIMEZONE_STORAGE_KEY)) {
            return true;
        }
    } catch (_) {
        // ignore
    }

    const configRaw = localStorage.getItem('config');

    if (!configRaw) {
        return false;
    }

    try {
        const config = JSON.parse(configRaw);

        return CONFIG_CHECKBOX_BINDINGS.some(({ path }) =>
            read_nested_value(config, path) !== read_nested_value(DEFAULT_CONFIG, path)
        );
    } catch (_) {
        // ignore
    }

    return false;
}

function update_filter_badge() {
    const active = has_non_default_filters();

    document.querySelectorAll('.filters-button').forEach((button) => {
        button.classList.toggle('has-filter-changes', active);
    });
}

function setup_timezone_selector() {
    const selector = document.getElementById('timezone-selector');

    if (!selector) {
        return;
    }

    const saved = get_selected_timezone();

    if (saved) {
        selector.value = saved;
    }

    selector.addEventListener('change', () => {
        set_selected_timezone(selector.value);
        localize_round_times();
        update_filter_badge();
    });
}

function venue_time_from_iso(isoString) {
    const match = /T(\d{2}):(\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})$/.exec(isoString);

    if (!match) {
        return '';
    }

    const hour = parseInt(match[1], 10);
    const minute = match[2];
    const offset = match[3];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = String(hour % 12 || 12).padStart(2, '0');

    let utcLabel = 'UTC';

    if (offset !== 'Z') {
        const sign = offset[0];
        const offsetHours = parseInt(offset.slice(1, 3), 10);
        const offsetMinutes = offset.slice(4, 6);
        utcLabel = `UTC${sign}${offsetHours}${offsetMinutes !== '00' ? ':' + offsetMinutes : ''}`;
    }

    return `${hour12}:${minute} ${ampm} (${utcLabel})`;
}

function localize_round_times() {
    const tz = get_selected_timezone();
    const dateFmt = make_date_fmt(tz);
    const timeFmt = make_time_fmt(tz);

    document.querySelectorAll('.event-round-card').forEach((card) => {
        const startsAtRaw = card.dataset.roundStartsAt || '';
        const endsAtRaw = card.dataset.roundEndsAt || '';

        if (!startsAtRaw) {
            return;
        }

        const start = new Date(startsAtRaw);

        if (Number.isNaN(start.getTime())) {
            return;
        }

        const dateEl = card.querySelector('.round-date');
        const timeEl = card.querySelector('.round-time');
        const endTimeEl = card.querySelector('.round-end-time');

        if (dateEl) {
            dateEl.textContent = dateFmt.format(start).toUpperCase();
        }

        if (timeEl) {
            timeEl.textContent = timeFmt.format(start);
        }

        if (endTimeEl && endsAtRaw) {
            const end = new Date(endsAtRaw);

            if (!Number.isNaN(end.getTime())) {
                endTimeEl.textContent = ` - ${timeFmt.format(end)}`;
            }
        }

        if (timeEl) {
            const venueTime = venue_time_from_iso(startsAtRaw);

            if (venueTime) {
                timeEl.title = `Venue: ${venueTime}`;
            }
        }
    });
}

function set_favicon(liveEvent) {
    let favicon;
    const title = document.title.replace(/^Live now:\s.*?\s\|\s/, '');

    if (liveEvent) {
        document.title = `Live now: ${liveEvent.name} | ${title}`;
        favicon = 'img/favicon-live.png';
    } else {
        document.title = title;
        favicon = 'img/favicon.png';
    }

    let elementById = document.getElementById('favicon');

    if (elementById.href !== favicon) {
        elementById.href = favicon
    }
}
