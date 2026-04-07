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

function lazy_set_background_image(element, url) {
    if (!element || !url) {
        return;
    }

    element.classList.add('lazy-background');
    element.dataset.bgSrc = url;
    element.style.backgroundImage = '';

    const observer = get_lazy_background_observer();

    if (!observer) {
        set_background_image_now(element, url);

        return;
    }

    observer.observe(element);
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

function youtube_cover_url(videoId, frame = 0) {
    return `https://img.youtube.com/vi/${videoId}/${frame}.jpg`;
}

function set_round_details(clone, round, isNextEvent) {
    if (!clone || !round) {
        return;
    }

    set_round_name(clone.querySelector('.round-name'), round);
    set_round_date(clone.querySelector('.round-date'), round);
    set_round_time(clone.querySelector('.round-time'), round);
    set_round_youtube_cover(clone.querySelector('.youtube-thumbnail'), round, isNextEvent);
    set_round_stream_button(clone.querySelector('[data-action="round-stream"]'), round);
    set_round_stream_button(clone.querySelector('.youtube-play-button'), round);
}

function set_round_action_buttons_visibility(clone, isStreaming) {
    if (!clone) {
        return;
    }

    const resultsButton = clone.querySelector('.button-results');
    const reminderButton = clone.querySelector('.button-reminder');

    if (isStreaming) {
        if (resultsButton) {
            resultsButton.style.setProperty('display', 'inline-grid', 'important');
        }
        if (reminderButton) {
            reminderButton.style.setProperty('display', 'none', 'important');
        }

        return;
    }

    if (resultsButton) {
        resultsButton.style.setProperty('display', 'none', 'important');
    }
    if (reminderButton) {
        reminderButton.style.setProperty('display', 'inline-grid', 'important');
    }
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
    schedule_fit_event_name_titles();
}

function set_youtube_cover_rotation(element, initialFrame = 0) {
    let interval = null;
    let frame = initialFrame;

    const stop_rotation = () => {
        if (interval) {
            window.clearInterval(interval);
            interval = null;
        }
    };

    element.onmouseover = () => {
        if (interval) {
            stop_rotation();
        }

        interval = window.setInterval(() => {
            frame += 1;

            if (frame > 3) {
                frame = 1;
            }

            set_youtube_cover(element, frame);
        }, 500);
    };

    element.onmouseout = () => {
        stop_rotation();
        frame = initialFrame;
        set_youtube_cover(element, initialFrame);
    };
}

function set_round_youtube_cover(element, round, isNextEvent) {
    if (!element || !round) {
        return;
    }

    const youtubeVideoId = video_id_from_stream(round);
    const coverUrl = youtube_cover_url(youtubeVideoId, 0);

    element.dataset.youtubeVideoId = youtubeVideoId;
    if (isNextEvent) {
        set_background_image_now(element, coverUrl);
    } else {
        lazy_set_background_image(element, coverUrl);
    }

    if (event_is_streaming(round) || event_is_upcoming(round)) {
        element.onmouseover = null;
        element.onmouseout = null;

        return;
    }

    set_youtube_cover_rotation(element, 0);
}

function set_youtube_cover(element, counter) {
    const youtubeVideoId = element.dataset.youtubeVideoId;

    if (!youtubeVideoId) {
        return;
    }

    set_background_image_now(element, youtube_cover_url(youtubeVideoId, counter));
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

    return {
        name: roundContainer ? (roundContainer.dataset.roundName || '') : '',
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

function set_round_date(element, round) {
    if (!element || !round) {
        return;
    }

}

function set_round_time(element, round) {
    if (!element || !round) {
        return;
    }


    const localTimeTooltip = round_local_time_tooltip(round);

    if (localTimeTooltip) {
        element.setAttribute('title', localTimeTooltip);
        return;
    }

    element.removeAttribute('title');
}

function set_round_name(element, round) {
    if (!element || !round) {
        return;
    }

    element.innerText = round.name;
}

function round_local_time_tooltip(round) {
    const startsAt = String(round && round.starts_at ? round.starts_at : '');
    const match = /T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/.exec(startsAt);

    if (!match) {
        return '';
    }

    const hour = match[1];
    const minute = match[2];
    const second = match[3] || '00';
    const offset = match[4];
    let utcOffset = '+0';

    if (offset !== 'Z') {
        const sign = offset.charAt(0);
        const rawHours = offset.slice(1, 3);
        const rawMinutes = offset.slice(4, 6);
        const hourOffset = String(parseInt(rawHours, 10));

        utcOffset = rawMinutes === '00' ? `${sign}${hourOffset}` : `${sign}${hourOffset}:${rawMinutes}`;
    }

    return `Local Time: ${hour}:${minute}:${second} (UTC ${utcOffset})`;
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
