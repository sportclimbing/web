function policy_feature_names(policy) {
    if (!policy) {
        return [];
    }

    if (typeof policy.features === 'function') {
        return Array.from(policy.features());
    }

    if (typeof policy.allowedFeatures === 'function') {
        return Array.from(policy.allowedFeatures());
    }

    return [];
}

function iframe_allow_feature_supported(featureName) {
    const iframe = document.createElement('iframe');
    const policies = [
        iframe.permissionsPolicy,
        iframe.featurePolicy,
        document.permissionsPolicy,
        document.featurePolicy,
    ];

    for (const policy of policies) {
        const featureNames = policy_feature_names(policy);

        if (featureNames.length) {
            return featureNames.includes(featureName);
        }
    }

    return false;
}

function handle_watch_event(e) {
    const round = round_from_stream_button(e.currentTarget);
    const streamUrl = round_stream_url_from_target(e.currentTarget);
    const youTubeVideoId = extract_youtube_video_id(streamUrl);

    if (!youTubeVideoId) {
        return;
    }

    e.preventDefault();

    const showChat = event_is_streaming(round) || event_is_upcoming(round);
    const liveChat = document.getElementById('live-chat');
    const chatToggle = document.getElementById('chat-toggle');
    const youtubeVideo = document.getElementById('youtube-video');
    const youtubeVideoTitle = document.getElementById('youtube-video-title');
    const videoModalElement = document.getElementById('video-modal');

    if (liveChat) {
        liveChat.style.display = showChat ? 'block' : 'none';
    }

    if (chatToggle) {
        chatToggle.style.display = showChat ? 'block' : 'none';
    }

    if (youtubeVideo) {
        const requestedAllowFeatures = ['autoplay', 'clipboard-write', 'picture-in-picture', 'web-share'];
        const allowFeatures = requestedAllowFeatures.filter((featureName) => iframe_allow_feature_supported(featureName));

        youtubeVideo.setAttribute('allow', allowFeatures.join('; '));
        youtubeVideo.setAttribute('src', `${YOUTUBE_EMBED_BASE_URL}/${youTubeVideoId}?autoplay=1`);
    }

    if (youtubeVideoTitle) {
        youtubeVideoTitle.textContent = `${round.name}`;
    }

    if (videoModalElement) {
        open_modal(videoModalElement);
    }
}

function event_not_started_countdown_parts(startsAt) {
    if (!startsAt) {
        return null;
    }

    const eventStart = dayjs(startsAt);

    if (!eventStart.isValid()) {
        return null;
    }

    const diffInMilliseconds = Math.max(0, eventStart.valueOf() - Date.now());
    const totalMinutes = Math.floor(diffInMilliseconds / (60 * 1000));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    return { days, hours, minutes };
}

function countdown_elements(prefix) {
    return {
        countdown: document.getElementById(`${prefix}-countdown`),
        label: document.getElementById(`${prefix}-countdown-label`),
        daysElement: document.getElementById(`${prefix}-countdown-days`),
        hoursElement: document.getElementById(`${prefix}-countdown-hours`),
        minutesElement: document.getElementById(`${prefix}-countdown-minutes`),
    };
}

function hide_countdown(prefix) {
    const countdown = document.getElementById(`${prefix}-countdown`);

    if (countdown) {
        countdown.hidden = true;
    }

    if (prefix === 'next-event') {
        const nextEvent = document.querySelector('.next-event');

        if (nextEvent) {
            nextEvent.classList.remove('next-event-has-countdown');
            nextEvent.style.removeProperty('--next-event-mobile-media-height');
        }
    }
}

function render_countdown(startsAt, prefix) {
    const {
        countdown,
        label,
        daysElement,
        hoursElement,
        minutesElement,
    } = countdown_elements(prefix);

    if (!countdown || !daysElement || !hoursElement || !minutesElement) {
        return;
    }

    const countdownParts = event_not_started_countdown_parts(startsAt);

    if (!countdownParts) {
        hide_countdown(prefix);

        return;
    }

    daysElement.innerText = String(countdownParts.days);
    hoursElement.innerText = String(countdownParts.hours).padStart(2, '0');
    minutesElement.innerText = String(countdownParts.minutes).padStart(2, '0');
    if (label) {
        label.innerText = countdownParts.days || countdownParts.hours || countdownParts.minutes ? 'Starts in' : 'Starting now';
    }
    countdown.hidden = false;

    if (prefix === 'next-event') {
        const nextEvent = document.querySelector('.next-event');

        if (nextEvent) {
            nextEvent.classList.add('next-event-has-countdown');
        }
    }
}

function render_event_not_started_countdown(startsAt) {
    render_countdown(startsAt, 'event-not-started');
}

function render_next_event_countdown(startsAt) {
    render_countdown(startsAt, 'next-event');
}

function stop_event_not_started_countdown() {
    if (eventNotStartedCountdownIntervalId) {
        window.clearInterval(eventNotStartedCountdownIntervalId);
        eventNotStartedCountdownIntervalId = null;
    }

    hide_countdown('event-not-started');
}

function stop_next_event_countdown() {
    if (nextEventCountdownIntervalId) {
        window.clearInterval(nextEventCountdownIntervalId);
        nextEventCountdownIntervalId = null;
    }

    hide_countdown('next-event');
}

function start_event_not_started_countdown(round) {
    const startsAt = round.starts_at || '';

    stop_event_not_started_countdown();
    render_event_not_started_countdown(startsAt);

    if (!event_not_started_countdown_parts(startsAt)) {
        return;
    }

    eventNotStartedCountdownIntervalId = window.setInterval(() => {
        render_event_not_started_countdown(startsAt);
    }, 60 * 1000);
}

function start_next_event_countdown(round) {
    const startsAt = round.starts_at || '';

    stop_next_event_countdown();
    render_next_event_countdown(startsAt);
}

function handle_watch_event_no_url(e) {
    const round = round_from_stream_button(e.currentTarget);
    e.preventDefault();

    if (event_is_upcoming(round) && !event_is_streaming(round)) {
        start_event_not_started_countdown(round);
        const eventNotStartedModal = document.getElementById('event-not-started-modal');

        if (eventNotStartedModal) {
            const eventName = document.getElementById('event-not-started-modal-event');
            const eventLeague = document.getElementById('event-not-started-modal-league');

            if (eventName) {
                eventName.innerText = round.name || '';
            }

            if (eventLeague) {
                eventLeague.innerText = round.event_name || '';
            }

            open_modal(eventNotStartedModal);
        }
    } else {
        stop_event_not_started_countdown();
        const fallbackUrl = round_fallback_url_from_target(e.currentTarget);
        const eventLinkMissingModalYoutube = document.getElementById('event-link-missing-modal-youtube');
        const eventLinkMissingModal = document.getElementById('event-link-missing-modal');

        if (eventLinkMissingModalYoutube) {
            eventLinkMissingModalYoutube.setAttribute('href', fallbackUrl);
        }

        if (eventLinkMissingModal) {
            open_modal(eventLinkMissingModal);
        }
    }
}

function handle_round_stream_click(e) {
    if (e.currentTarget instanceof Element && e.currentTarget.hasAttribute('data-round-stream-url')) {
        handle_watch_event(e);

        return;
    }

    handle_watch_event_no_url(e);
}


function athlete_photo_sources_build(athlete) {
    return athlete_photo_local_sources_build(athlete);
}

function handle_start_list_photo_error(imageElement) {
    if (!(imageElement instanceof HTMLImageElement)) {
        return;
    }

    const fallbackSrc = String(imageElement.dataset.fallbackSrc || '').trim();

    if (!fallbackSrc || imageElement.dataset.fallbackApplied === '1') {
        imageElement.onerror = null;
        return;
    }

    imageElement.dataset.fallbackApplied = '1';
    imageElement.src = fallbackSrc;
}

function start_list_build(startList, season, maxAthletesWithPhoto = 5) {
    if (!startList.length) {
        return '📋 Start List: Pending';
    }

    const maxAthletes = Number.isFinite(maxAthletesWithPhoto) ? Math.max(0, maxAthletesWithPhoto) : 5;
    const athletesWithPhoto = startList.filter((athlete) => Boolean(athlete.photo_url)).slice(0, maxAthletes);

    if (!athletesWithPhoto.length) {
        return '📋 Start List';
    }

    const avatars = athletesWithPhoto.map((athlete, index) => {
        const athleteName = escape_html(athlete_name_build(athlete));
        const country = athlete.country ? escape_html(athlete.country) : '';
        const tooltip = country ? `${athleteName} (${country})` : athleteName;
        const photoSources = athlete_photo_sources_build(athlete);
        const stackIndex = athletesWithPhoto.length - index;

        if (!photoSources) {
            return '';
        }

        const photoUrl = escape_html(photoSources.src);
        const fallbackAttribute = photoSources.fallbackSrc
            ? ` data-fallback-src="${escape_html(photoSources.fallbackSrc)}" onerror="handle_start_list_photo_error(this)"`
            : '';

        return `<span class="event-start-list-avatar-chip" style="--stack-index: ${stackIndex};"><img class="event-start-list-avatar event-start-list-avatar-tooltip" src="${photoUrl}" width="31" height="31" alt="${athleteName}" title="${tooltip}" loading="lazy" referrerpolicy="no-referrer"${fallbackAttribute} /></span>`;
    }).join('');

    return `<span class="event-start-list-avatars" aria-label="Start list athletes with profile photos">${avatars}</span>`;
}

function start_list_modal_url_build(season, eventId) {
    const normalizedSeason = encodeURIComponent(String(season || '').trim());
    const normalizedEventId = encodeURIComponent(String(eventId || '').trim());

    if (!normalizedSeason || !normalizedEventId) {
        return '';
    }

    const version = String(document.body.dataset.buildVersion || '').trim();
    const query = version ? `?v=${encodeURIComponent(version)}` : '';

    return `/modals/start-list/${normalizedSeason}/${normalizedEventId}.html${query}`;
}

function athlete_name_build(athlete) {
    return `${athlete.first_name} ${athlete.last_name}`;
}

function escape_html(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function set_start_list_modal_content(eventNameText, titleText, listHtml) {
    const eventName = document.getElementById('start-list-modal-event');
    const title = document.getElementById('start-list-modal-title');
    const list = document.getElementById('start-list-modal-list');
    const footerAvatars = document.getElementById('start-list-modal-footer-avatars');
    const footerMoreAthletes = document.getElementById('start-list-modal-more-athletes');

    if (!title || !list) {
        return;
    }

    if (eventName) {
        eventName.innerText = eventNameText || '';
    }
    title.innerText = titleText || 'ATHLETES ATTENDING';
    title.setAttribute('title', title.innerText);
    list.innerHTML = listHtml || '<li class="p-8 text-center text-on-surface-variant font-medium bg-surface-container-low/20 rounded-xl border border-dashed border-outline-variant/30">Start list unavailable right now.</li>';

    if (footerAvatars) {
        const overflowLi = list.querySelector('.start-list-overflow-athletes');
        const overflowAvatarContainer = overflowLi && overflowLi.querySelector('.flex');
        const overflowAvatars = overflowAvatarContainer
            ? Array.from(overflowAvatarContainer.children)
            : [];
        if (footerMoreAthletes) {
            footerMoreAthletes.classList.toggle('hidden', overflowAvatars.length === 0);
        }
        if (overflowAvatars.length > 0) {
            footerAvatars.innerHTML = '';
            overflowAvatars.forEach((el) => {
                const clone = el.cloneNode(true);
                clone.className = clone.className
                    .replace(/\bw-10\b/g, 'w-8')
                    .replace(/\bh-10\b/g, 'h-8');
                clone.style.cssText += '; border: 2px solid var(--color-surface, #000)';
                footerAvatars.appendChild(clone);
            });
            const plus = document.createElement('div');
            plus.className = 'w-8 h-8 rounded-full border-2 border-surface bg-surface-container-lowest flex items-center justify-center text-[10px] font-bold text-primary';
            plus.textContent = '+';
            footerAvatars.appendChild(plus);
        }
    }
}

function start_list_modal_loading_event(trigger) {
    return trigger && trigger.dataset && typeof trigger.dataset.eventName === 'string'
        ? trigger.dataset.eventName.trim()
        : '';
}

function set_start_list_modal_loading(trigger) {
    set_start_list_modal_content(start_list_modal_loading_event(trigger), 'ATHLETES ATTENDING', '<li class="p-8 text-center text-on-surface-variant font-medium bg-surface-container-low/20 rounded-xl border border-dashed border-outline-variant/30 animate-pulse">Loading start list...</li>');
}

function set_start_list_modal_error(trigger) {
    set_start_list_modal_content(start_list_modal_loading_event(trigger), 'ATHLETES ATTENDING', '<li class="p-8 text-center text-on-surface-variant font-medium bg-surface-container-low/20 rounded-xl border border-dashed border-outline-variant/30">Start list unavailable right now.</li>');
}

function parse_start_list_modal_fragment(fragmentHtml) {
    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(String(fragmentHtml || ''), 'text/html');
    const eventName = documentFragment.querySelector('.start-list-modal-fragment-event');
    const title = documentFragment.querySelector('.start-list-modal-fragment-title');
    const list = documentFragment.querySelector('.start-list-modal-fragment-list');

    if (!list) {
        throw new Error('Invalid start list modal fragment payload');
    }

    return {
        eventName: eventName && eventName.textContent ? eventName.textContent : '',
        title: title && title.textContent ? title.textContent : 'ATHLETES ATTENDING',
        listHtml: list.innerHTML,
    };
}

const startListModalFragmentCache = new Map();
let startListModalRequestId = 0;

function fetch_start_list_modal_fragment(startListUrl) {
    const normalizedUrl = String(startListUrl || '');

    if (!normalizedUrl) {
        return Promise.reject(new Error('Missing start list modal URL'));
    }

    if (startListModalFragmentCache.has(normalizedUrl)) {
        return startListModalFragmentCache.get(normalizedUrl);
    }

    const request = fetch(normalizedUrl)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Start list modal request failed with status ${response.status}`);
            }

            return response.text();
        })
        .then((fragmentHtml) => parse_start_list_modal_fragment(fragmentHtml))
        .catch((error) => {
            startListModalFragmentCache.delete(normalizedUrl);
            throw error;
        });

    startListModalFragmentCache.set(normalizedUrl, request);

    return request;
}

function apply_start_list_modal_fragment(fragmentPayload) {
    if (!fragmentPayload) {
        return;
    }

    set_start_list_modal_content(fragmentPayload.eventName, fragmentPayload.title, fragmentPayload.listHtml);
}

async function load_start_list_modal_fragment(startListUrl, requestId, trigger) {
    try {
        const payload = await fetch_start_list_modal_fragment(startListUrl);

        if (requestId !== startListModalRequestId) {
            return;
        }

        apply_start_list_modal_fragment(payload);
    } catch (error) {
        if (requestId !== startListModalRequestId) {
            return;
        }

        console.warn('Failed to load start list modal fragment:', error);
        set_start_list_modal_error(trigger);
    }
}

function handle_start_list_trigger_click(e) {
    const trigger = e.currentTarget;
    const startListUrl = trigger && trigger.dataset ? trigger.dataset.startListUrl : '';
    startListModalRequestId += 1;

    set_start_list_modal_loading(trigger);
    load_start_list_modal_fragment(startListUrl, startListModalRequestId, trigger).then();
}

function build_event_start_list_button(eventId, startList, season, maxAthletesWithPhoto = 5) {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'event-start-list-trigger';
    button.innerHTML = start_list_build(startList, season, maxAthletesWithPhoto);
    button.setAttribute('data-bs-toggle', 'modal');
    button.setAttribute('data-bs-target', '#start-list-modal');
    button.dataset.eventId = String(eventId);
    button.dataset.startListUrl = start_list_modal_url_build(season, eventId);

    return button;
}

function open_modal(modalId) {
    const modalElement = typeof modalId === 'string' ? document.querySelector(modalId) : modalId;
    if (!modalElement) return;

    modalElement.classList.add('active', 'show');
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');

    // Trigger custom events for compatibility
    modalElement.dispatchEvent(new CustomEvent('show.bs.modal', { bubbles: true }));
    modalElement.dispatchEvent(new CustomEvent('shown.bs.modal', { bubbles: true }));
}

function close_modal(modalId) {
    const modalElement = typeof modalId === 'string' ? document.querySelector(modalId) : modalId;
    if (!modalElement) return;

    modalElement.classList.remove('active', 'show');

    // Ensure we check for ANY open modal before removing the class
    // We use a small timeout to allow any transitions or other JS to finish
    window.setTimeout(() => {
        if (!document.querySelector('.modal.active, .modal.show')) {
            document.body.classList.remove('modal-open');
            document.documentElement.classList.remove('modal-open');
            // Force remove overflow:hidden if Bootstrap added it as inline style
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        }
    }, 0);

    // Trigger custom events for compatibility
    modalElement.dispatchEvent(new CustomEvent('hide.bs.modal', { bubbles: true }));
    modalElement.dispatchEvent(new CustomEvent('hidden.bs.modal', { bubbles: true }));
}
