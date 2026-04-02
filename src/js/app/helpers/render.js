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

    element.classList.add('lazy-background');
    element.dataset.bgSrc = url;
    element.dataset.bgLoaded = '1';
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
    delete element.dataset.bgLoaded;
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

function set_round_details(clone, round) {
    set_round_name(clone.querySelector('.round-name'), round);
    set_round_date(clone.querySelector('.round-date'), round);
    set_round_time(clone.querySelector('.round-time'), round);
    set_round_youtube_cover(clone.querySelector('.youtube-thumbnail'), round);
    set_round_stream_button(clone.querySelector('[data-action="round-stream"]'), round);
    set_round_stream_button(clone.querySelector('.youtube-play-button'), round);
}

function set_round_action_buttons_visibility(clone, isStreaming) {
    const resultsButton = clone.querySelector('.button-results');
    const reminderButton = clone.querySelector('.button-reminder');

    if (isStreaming) {
        resultsButton.style.setProperty('display', 'inline-grid', 'important');
        reminderButton.style.setProperty('display', 'none', 'important');

        return;
    }

    resultsButton.style.setProperty('display', 'none', 'important');
    reminderButton.style.setProperty('display', 'inline-grid', 'important');
}

function remove_next_event_starts_in_label(clone) {
    const startsIn = clone.querySelector('.round-starts-in');

    if (startsIn) {
        startsIn.remove();
    }
}

function set_next_event_countdown(round, isStreaming) {
    if (isStreaming || !event_is_upcoming(round)) {
        stop_next_event_countdown();

        return;
    }

    start_next_event_countdown(round);
}

function set_next_event_start_list(clone, event) {
    const roundCopy = clone.querySelector('.round-copy');
    const normalizedEvent = event || {};
    const startList = Array.isArray(normalizedEvent.start_list) ? normalizedEvent.start_list : [];
    const providedStartListTrigger = normalizedEvent.nextEventStartListTrigger instanceof Element
        ? normalizedEvent.nextEventStartListTrigger.cloneNode(true)
        : null;
    const providedPendingText = typeof normalizedEvent.nextEventStartListPendingText === 'string'
        ? normalizedEvent.nextEventStartListPendingText.trim()
        : '';

    if (!roundCopy) {
        return;
    }

    const startListWrapper = document.createElement('div');
    startListWrapper.className = 'next-event-start-list event-start-list';
    startListWrapper.classList.toggle('event-start-list-has-avatars', Boolean(normalizedEvent.nextEventStartListHasAvatars));

    if (providedStartListTrigger) {
        if (!providedStartListTrigger.dataset.eventName) {
            providedStartListTrigger.dataset.eventName = normalizedEvent.name || '';
        }

        startListWrapper.appendChild(providedStartListTrigger);
        roundCopy.appendChild(startListWrapper);

        return;
    }

    if (!startList.length) {
        const pendingLine = document.createElement('h6');
        pendingLine.className = 'round-date';
        pendingLine.innerText = providedPendingText || '📋 Start List: Pending';
        startListWrapper.appendChild(pendingLine);
        roundCopy.appendChild(startListWrapper);

        return;
    }

    const button = build_event_start_list_button(normalizedEvent.id, startList, normalizedEvent.season, NEXT_EVENT_START_LIST_AVATAR_LIMIT);
    button.dataset.eventName = normalizedEvent.name || '';
    startListWrapper.appendChild(button);
    roundCopy.appendChild(startListWrapper);
}

function set_next_event(round, event, isStreaming) {
    const nextEventContainer = document.querySelector('.next-event');
    const nextEventDividers = document.querySelectorAll('.next-event-divider');
    const eventDetails = document.querySelector('#next-event-details');
    const template = document.getElementById('ifsc-event');

    if (!nextEventContainer || !eventDetails || !template) {
        return;
    }

    nextEventContainer.style.display = 'block';

    nextEventDividers.forEach((divider) => {
        divider.style.display = 'block';
    });

    release_lazy_backgrounds(eventDetails);
    remove_all_children(eventDetails);
    const clone = template.content.cloneNode(true);

    set_round_action_buttons_visibility(clone, isStreaming);
    set_round_details(clone, round);
    remove_next_event_starts_in_label(clone);
    set_next_event_start_list(clone, event);

    if (isStreaming) {
        clone.querySelector('.button-results').href = `https://ifsc.results.info/event/${event.id}`;
    }

    eventDetails.append(clone);
    set_next_event_countdown(round, isStreaming);
    schedule_next_event_mobile_countdown_height_sync();

    const title = isStreaming ? '🔴 Now Streaming' : 'Next Event';

    const nextEventTitle = document.getElementById('next-event-title');

    if (nextEventTitle) {
        nextEventTitle.textContent = `${title}: ${event.name}`;
    }
}

function video_id_from_stream(round) {
    const youtubeVideoId = extract_youtube_video_id(round.stream_url);

    if (youtubeVideoId) {
        return youtubeVideoId;
    }

    return round.categories.includes('women') ? 'MQeQs6K_T5g' : 'emrHdLsJTk4';
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

function set_round_youtube_cover(element, round) {
    const youtubeVideoId = video_id_from_stream(round);
    element.dataset.youtubeVideoId = youtubeVideoId;
    lazy_set_background_image(element, youtube_cover_url(youtubeVideoId, 0));

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

function round_from_stream_button(element) {
    const roundContainer = element instanceof Element ? (element.closest('.event-round-card, .ifsc-event') || element) : null;

    return {
        name: roundContainer ? (roundContainer.dataset.roundName || '') : '',
        starts_at: roundContainer ? (roundContainer.dataset.roundStartsAt || '') : '',
        ends_at: roundContainer ? (roundContainer.dataset.roundEndsAt || '') : '',
    };
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
    element.innerText = '📅 ' + dayjs(round.starts_at).format('ddd, D MMMM, YYYY');
}

function set_round_time(element, round) {
    element.innerText = '⏰ ' + dayjs(round.starts_at).format('hh:mm A');
}

function set_round_name(element, round) {
    element.innerText = round.name;
}

function set_favicon(liveEvent) {
    let favicon;
    let title = document.title.split(' | ');
    title = title[title.length - 1];

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
