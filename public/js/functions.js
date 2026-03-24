const ROUND_SCHEDULE_STATUS = {
    confirmed: '☑️ Confirmed Schedule',
    provisional: '⏳ Provisional Schedule',
    estimated: '⏳ Estimated Schedule',
};

const STREAMS_FALLBACK_URL = 'https://www.youtube.com/@worldclimbing/streams';
const YOUTUBE_EMBED_BASE_URL = 'https://www.youtube-nocookie.com/embed';
const GITHUB_BUTTON_SCRIPT_SRC = 'https://buttons.github.io/buttons.js';
const GITHUB_BUTTON_SLOT_ID = 'season-github-button-slot';

const CONFIG_CHECKBOX_BINDINGS = [
    { inputName: 'league[cups]', path: ['league', 'cups'] },
    { inputName: 'league[paraclimbing]', path: ['league', 'paraclimbing'] },
    { inputName: 'league[games]', path: ['league', 'games'] },
    { inputName: 'category[women]', path: ['category', 'women'] },
    { inputName: 'category[men]', path: ['category', 'men'] },
    { inputName: 'discipline[boulder]', path: ['disciplines', 'boulder'] },
    { inputName: 'discipline[lead]', path: ['disciplines', 'lead'] },
    { inputName: 'discipline[speed]', path: ['disciplines', 'speed'] },
    { inputName: 'round[qualifications]', path: ['rounds', 'qualification'] },
    { inputName: 'round[semifinals]', path: ['rounds', 'semi-final'] },
    { inputName: 'round[finals]', path: ['rounds', 'final'] },
    { inputName: 'streamable', path: ['streamable'] },
];

function event_is_streaming(event) {
    const now = dayjs();
    const eventStart = dayjs(event.starts_at);
    const eventEnd = dayjs(event.ends_at);

    return now.isBetween(eventStart, eventEnd);
}

function event_is_upcoming(event) {
    return new Date(event.starts_at) > new Date();
}

function event_schedule_status(event) {
    let numNonQualificationRounds = 0;

    for (const round of event.rounds) {
        if (round.kind === 'qualification') {
            continue;
        }

        numNonQualificationRounds++;

        if (round.schedule_status === 'provisional') {
            return ROUND_SCHEDULE_STATUS.provisional;
        }

        if (round.schedule_status === 'estimated') {
            return ROUND_SCHEDULE_STATUS.estimated;
        }
    }

    return numNonQualificationRounds > 0 ? ROUND_SCHEDULE_STATUS.confirmed : ROUND_SCHEDULE_STATUS.provisional;
}

function pretty_starts_in(event) {
    return dayjs(event.starts_at).fromNow();
}

function pretty_started_ago(event) {
    return `Started ${dayjs(event.starts_at).fromNow()}`;
}

function pretty_finished_ago(event) {
    return `Streamed ${dayjs(event.starts_at).fromNow()}`;
}

function round_is_non_speed_qualification(round) {
    const disciplines = Array.isArray(round.disciplines) ? round.disciplines : [];

    return round.kind === 'qualification' && !disciplines.includes('speed');
}

function get_next_event(events) {
    const now = new Date();

    for (const event of events) {
        for (const round of event.rounds) {
            if (round_is_non_speed_qualification(round)) {
                continue;
            }

            if (new Date(round.starts_at) >= now || event_is_streaming(round)) {
                return event;
            }
        }
    }
}

let mobileHeroTitleFitFrame = null;
let eventNotStartedCountdownIntervalId = null;

function fit_mobile_hero_title() {
    const heading = document.querySelector('#ifsc-season .header-title h2');

    if (!heading) {
        return;
    }

    const isMobile = window.matchMedia('(max-width: 500px)').matches;

    if (!isMobile) {
        heading.style.removeProperty('font-size');
        heading.style.removeProperty('white-space');

        return;
    }

    const minFontSize = 11;
    const maxFontSize = 28;
    const precision = 0.1;
    const availableWidth = heading.clientWidth || heading.parentElement?.clientWidth || 0;

    if (!availableWidth) {
        return;
    }

    heading.style.whiteSpace = 'nowrap';

    let low = minFontSize;
    let high = maxFontSize;
    let best = minFontSize;

    while ((high - low) > precision) {
        const mid = (low + high) / 2;
        heading.style.fontSize = `${mid}px`;

        if (heading.scrollWidth <= availableWidth) {
            best = mid;
            low = mid;
        } else {
            high = mid;
        }
    }

    heading.style.fontSize = `${best.toFixed(2)}px`;
}

function schedule_fit_mobile_hero_title() {
    if (mobileHeroTitleFitFrame) {
        window.cancelAnimationFrame(mobileHeroTitleFitFrame);
    }

    mobileHeroTitleFitFrame = window.requestAnimationFrame(() => {
        fit_mobile_hero_title();
    });
}

function get_selected_season() {
    return get_id_from_hash('season') || DEFAULT_SEASON;
}

function get_selected_event() {
    return get_id_from_hash('event');
}

function first_element_by_name(name) {
    return document.getElementsByName(name)[0];
}

function get_cookie(name) {
    const parts = document.cookie.split(';');

    for (const part of parts) {
        const cookie = part.trim();

        if (cookie.startsWith(`${name}=`)) {
            return decodeURIComponent(cookie.substring(name.length + 1));
        }
    }

    return '';
}

function set_cookie(name, value, days = 365) {
    const expiresAt = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));

    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expiresAt.toUTCString()}; path=/; SameSite=Lax`;
}

function get_system_theme() {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolve_theme(theme) {
    return theme === 'system' ? get_system_theme() : theme;
}

function update_theme_toggle(theme) {
    const toggle = document.getElementById('theme-toggle');

    if (!toggle) {
        return;
    }

    const labels = {
        dark: '🌙 Dark Mode',
        light: '☀ Light Mode',
        system: '◐ System Mode',
    };

    toggle.innerText = labels[theme] || labels.system;
    toggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    toggle.setAttribute('title', 'Cycle theme: System, Dark, Light');
    toggle.setAttribute('data-original-title', 'Cycle theme: System, Dark, Light');
}

function update_github_button_theme(theme) {
    const buttonSlot = document.getElementById(GITHUB_BUTTON_SLOT_ID);

    if (!buttonSlot || !document.body) {
        return;
    }

    const colorScheme = `no-preference: ${theme}; light: ${theme}; dark: ${theme};`;
    const githubButton = document.createElement('a');

    githubButton.className = 'github-button season-github-button';
    githubButton.href = 'https://github.com/sportclimbing/ifsc-calendar';
    githubButton.target = '_blank';
    githubButton.rel = 'noopener';
    githubButton.dataset.size = 'large';
    githubButton.dataset.colorScheme = colorScheme;
    githubButton.dataset.showCount = 'true';
    githubButton.setAttribute('aria-label', 'Star sportclimbing/ifsc-calendar on GitHub');
    githubButton.textContent = 'Star';

    remove_all_children(buttonSlot);
    buttonSlot.appendChild(githubButton);

    document
        .querySelectorAll('script[data-github-button-loader="true"]')
        .forEach((script) => script.remove());

    const githubButtonScript = document.createElement('script');
    githubButtonScript.async = true;
    githubButtonScript.defer = true;
    githubButtonScript.src = GITHUB_BUTTON_SCRIPT_SRC;
    githubButtonScript.dataset.githubButtonLoader = 'true';

    githubButtonScript.addEventListener('load', () => githubButtonScript.remove());
    githubButtonScript.addEventListener('error', () => githubButtonScript.remove());

    document.body.appendChild(githubButtonScript);
}

function apply_theme(theme) {
    const selectedTheme = ['dark', 'light', 'system'].includes(theme) ? theme : 'system';
    const resolvedTheme = resolve_theme(selectedTheme);

    document.body.classList.toggle('theme-light', resolvedTheme === 'light');
    document.body.dataset.theme = resolvedTheme;
    document.body.dataset.themePreference = selectedTheme;
    update_theme_toggle(selectedTheme);
    update_github_button_theme(resolvedTheme);
}

function sync_system_theme() {
    if (document.body.dataset.themePreference === 'system') {
        apply_theme('system');
    }
}

function toggle_theme() {
    const currentTheme = document.body.dataset.themePreference || 'system';
    const nextTheme = {
        system: 'dark',
        dark: 'light',
        light: 'system',
    }[currentTheme];

    apply_theme(nextTheme);
    set_cookie('ifsc_theme', nextTheme);
}

function restore_theme() {
    apply_theme(get_cookie('ifsc_theme') || 'system');
}

function config_is_enabled(name) {
    return first_element_by_name(name).checked;
}

function remove_all_children(element) {
    if (!element) {
        return;
    }

    while (element.lastElementChild) {
        element.removeChild(element.lastElementChild);
    }
}

function get_enabled_filter_keys(filterGroup) {
    return Object.keys(filterGroup).filter((key) => filterGroup[key]);
}

function has_intersection(values, selectedValuesSet) {
    return values.some((value) => selectedValuesSet.has(value));
}

function read_nested_value(object, path) {
    return path.reduce((current, key) => (current ? current[key] : undefined), object);
}

function set_checkbox_checked(inputName, checked) {
    const checkbox = first_element_by_name(inputName);

    if (!checkbox) {
        return;
    }

    checkbox.checked = Boolean(checked);
}

function get_id_from_hash(name) {
    if (window.location.hash) {
        const regex = new RegExp(`/${name}/(?<id>\\d+)`);
        const match = regex.exec(window.location.hash);

        if (match) {
            return parseInt(match.groups.id);
        }
    }

    return '';
}

function extract_youtube_video_id(url) {
    const match = (url || '').match(/youtu(\.be|be\.com)\/(live\/|watch\?v=)?(?<video_id>[a-zA-Z0-9_-]{10,})/);

    if (match) {
        return match.groups.video_id;
    }

    return null;
}

function load_config_from_modal() {
    return {
        league: {
            "cups": config_is_enabled('league[cups]'),
            "paraclimbing": config_is_enabled('league[paraclimbing]'),
            "games": config_is_enabled('league[games]'),
        },
        category: {
            "women": config_is_enabled('category[women]'),
            "men": config_is_enabled('category[men]'),
        },
        disciplines: {
            "boulder": config_is_enabled('discipline[boulder]'),
            "lead": config_is_enabled('discipline[lead]'),
            "speed": config_is_enabled('discipline[speed]'),
        },
        rounds: {
            "qualification": config_is_enabled('round[qualifications]'),
            "semi-final": config_is_enabled('round[semifinals]'),
            "final": config_is_enabled('round[finals]'),
        },
        streamable: config_is_enabled('streamable')
    };
}

function restore_config() {
    const configRaw = window.localStorage.getItem('config');

    if (!configRaw) {
        return;
    }

    try {
        const config = JSON.parse(configRaw);

        CONFIG_CHECKBOX_BINDINGS.forEach(({ inputName, path }) => {
            set_checkbox_checked(inputName, read_nested_value(config, path));
        });
    } catch (error) {
        window.localStorage.clear();
    }
}

function config_selected_leagues() {
    return $('#config-leagues input[type="checkbox"]:checked').map((a, b) => b.value).get();
}

function apply_search_filters(jsonData) {
    const config = load_config_from_modal();
    const enabledDisciplines = new Set(get_enabled_filter_keys(config.disciplines));
    const enabledCategories = new Set(get_enabled_filter_keys(config.category));
    const selectedLeagues = new Set(config_selected_leagues());

    const round_matches_filters = (round) => {
        if (config.streamable && !round.stream_url) {
            return false;
        }

        if (!has_intersection(round.disciplines, enabledDisciplines)) {
            return false;
        }

        if (!config.rounds[round.kind]) {
            return false;
        }

        if (!has_intersection(round.categories, enabledCategories)) {
            return false;
        }

        return true;
    };

    return jsonData.events
        .filter((event) => selectedLeagues.has(event.league_name))
        .map((event) => ({
            ...event,
            rounds: event.rounds.filter(round_matches_filters),
        }));
}

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
    set_round_stream_button($('.round-stream-button', clone), round);
    set_round_stream_button($('.youtube-play-button', clone), round);
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

function set_next_event_starts_in_label(clone, round, event, isStreaming) {
    const startsIn = $('.js-starts-in', clone);

    if (isStreaming) {
        startsIn.text(`🔴 Live now (${pretty_started_ago(round)})`);
        clone.querySelector('.button-results').href = `https://ifsc.results.info/event/${event.id}`;
    } else if (round_is_non_speed_qualification(round)) {
        startsIn.text('🟡 Qualification will not be streamed');
    } else {
        startsIn.text(`🟢 Next Event (Starts ${pretty_starts_in(round)})`);
    }

    startsIn.removeClass('text-muted').addClass('fw-bold');
}

function set_next_event(round, event, isStreaming) {
    const nextEventContainer = document.querySelector('.next-event');
    const eventDetails = document.querySelector('#next-event-details');
    const template = document.getElementById('ifsc-event');

    if (!nextEventContainer || !eventDetails || !template) {
        return;
    }

    nextEventContainer.style.display = 'block';

    release_lazy_backgrounds(eventDetails);
    remove_all_children(eventDetails);
    const clone = template.content.cloneNode(true);

    set_round_action_buttons_visibility(clone, isStreaming);
    set_round_details(clone, round);
    set_next_event_starts_in_label(clone, round, event, isStreaming);
    eventDetails.append(clone);

    const title = isStreaming ? '🔴 Now Streaming' : 'Next Event';

    $('#next-event-title').text(`${title}: ${event.name}`);
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
    element.attr('data-round-name', round.name || '');
    element.attr('data-round-starts-at', round.starts_at || '');
    element.attr('data-round-ends-at', round.ends_at || '');
    element.addClass('js-round-stream');
}

function round_from_stream_button(element) {
    return {
        name: element.dataset.roundName || '',
        starts_at: element.dataset.roundStartsAt || '',
        ends_at: element.dataset.roundEndsAt || '',
    };
}

function set_round_stream_button(element, round) {
    const tagName = element.prop('tagName');
    const streamUrl = round.stream_url || '';
    const fallbackUrl = streamUrl || STREAMS_FALLBACK_URL;

    set_round_stream_metadata(element, round);
    element.attr('data-round-stream-url', streamUrl);
    element.attr('data-round-fallback-url', fallbackUrl);

    if (round.stream_url) {
        element.attr('data-round-has-stream-url', '1');
    } else {
        element.attr('data-round-has-stream-url', '0');
    }

    if (tagName === 'A') {
        element.attr('href', fallbackUrl);

        return;
    }

    element.removeAttr('href');
}

function round_stream_url_from_target(target) {
    return target.dataset.roundStreamUrl || target.href || '';
}

function round_fallback_url_from_target(target) {
    return target.dataset.roundFallbackUrl || target.href || STREAMS_FALLBACK_URL;
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

    document.getElementById('favicon').href = favicon;
}

function handle_chat_toggle(button) {
    const chat = $('#live-chat');

    if (chat.is(':hidden')) {
        chat.show();
        button.innerText = 'Hide Chat';
    } else {
        chat.hide();
        button.innerText = 'Show Chat';
    }
}

function beautify_disciplines(disciplines) {
    disciplines = disciplines.map((discipline) => discipline.capitalize());

    if (disciplines.length === 1) {
        return disciplines[0];
    }

    const last = disciplines.pop();

    return disciplines.join(', ') + ' &amp; ' + last;
}

function handle_watch_event(e) {
    const round = round_from_stream_button(e.currentTarget);
    const streamUrl = round_stream_url_from_target(e.currentTarget);
    const youTubeVideoId = extract_youtube_video_id(streamUrl);

    if (!youTubeVideoId) {
        return;
    }

    e.preventDefault();

    const streamButton = $(e.currentTarget);
    streamButton.attr('data-target', '#video-modal');
    streamButton.attr('data-toggle', 'modal');

    const showChat = event_is_streaming(round) || event_is_upcoming(round);
    $('#live-chat').toggle(showChat);
    $('#chat-toggle').toggle(showChat);

    $('#youtube-video').attr('src', `${YOUTUBE_EMBED_BASE_URL}/${youTubeVideoId}?autoplay=1`);
    $('#youtube-video-title').html(`🍿 ${round.name}`);
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

function render_event_not_started_countdown(startsAt) {
    const countdown = document.getElementById('event-not-started-countdown');
    const label = document.getElementById('event-not-started-countdown-label');
    const daysElement = document.getElementById('event-not-started-countdown-days');
    const hoursElement = document.getElementById('event-not-started-countdown-hours');
    const minutesElement = document.getElementById('event-not-started-countdown-minutes');

    if (!countdown || !daysElement || !hoursElement || !minutesElement || !label) {
        return;
    }

    const countdownParts = event_not_started_countdown_parts(startsAt);

    if (!countdownParts) {
        countdown.hidden = true;

        return;
    }

    daysElement.innerText = String(countdownParts.days);
    hoursElement.innerText = String(countdownParts.hours).padStart(2, '0');
    minutesElement.innerText = String(countdownParts.minutes).padStart(2, '0');
    label.innerText = countdownParts.days || countdownParts.hours || countdownParts.minutes ? 'Starts in' : 'Starting now';
    countdown.hidden = false;
}

function stop_event_not_started_countdown() {
    if (eventNotStartedCountdownIntervalId) {
        window.clearInterval(eventNotStartedCountdownIntervalId);
        eventNotStartedCountdownIntervalId = null;
    }
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

function handle_watch_event_no_url(e) {
    const round = round_from_stream_button(e.currentTarget);
    e.preventDefault();

    if (event_is_upcoming(round) && !event_is_streaming(round)) {
        start_event_not_started_countdown(round);
        $('#event-not-started-modal').modal('show');
    } else {
        stop_event_not_started_countdown();
        const fallbackUrl = round_fallback_url_from_target(e.currentTarget);

        $('#event-link-missing-modal-youtube').attr('href', fallbackUrl);
        $('#event-link-missing-modal').modal('show');
    }
}

function handle_round_stream_click(e) {
    if (e.currentTarget.dataset.roundHasStreamUrl === '1') {
        handle_watch_event(e);

        return;
    }

    handle_watch_event_no_url(e);
}

Object.defineProperty(String.prototype, 'capitalize', {
    value: function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    },
    enumerable: false
});

function start_list_build(startList) {
    const list = [];

    for (const athlete of startList) {
        list.push(`${athlete.first_name} ${athlete.last_name[0]}`);

        if (list.length === 2) {
            break;
        }
    }

    if (!list.length) {
        return '📋 Start List: Pending';
    }

    return '📋 ' + list.slice(0, 2).join(', ') + ',...';
}

function athlete_name_build(athlete) {
    return `${athlete.first_name} ${athlete.last_name}`;
}

function athlete_initials_build(athlete) {
    return `${athlete.first_name[0] || ''}${athlete.last_name[0] || ''}`;
}

function escape_html(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function start_list_modal_build(startList) {
    if (!startList.length) {
        return '<li class="start-list-modal-empty">Start list pending.</li>';
    }

    return startList.map((athlete) => {
        const athleteName = escape_html(athlete_name_build(athlete));
        const country = athlete.country ? `<span class="start-list-athlete-country">${escape_html(athlete.country)}</span>` : '';
        const photo = athlete.photo_url
            ? `<img class="start-list-athlete-photo" src="${escape_html(athlete.photo_url)}" alt="${athleteName}" loading="lazy" referrerpolicy="no-referrer" />`
            : `<div class="start-list-athlete-photo start-list-athlete-photo-fallback" aria-hidden="true">${escape_html(athlete_initials_build(athlete))}</div>`;
        const hasAthleteId = athlete.athlete_id !== undefined && athlete.athlete_id !== null && athlete.athlete_id !== '';
        const athleteProfile = hasAthleteId
            ? `<a class="ifsc-action-button ifsc-action-button-primary start-list-athlete-profile" href="${escape_html(`https://ifsc.results.info/athlete/${encodeURIComponent(String(athlete.athlete_id))}`)}" target="_blank" rel="noopener">Profile <img src="img/external-link.svg" alt="" aria-hidden="true" /></a>`
            : '';

        return `
            <li class="start-list-athlete">
                ${photo}
                <div class="start-list-athlete-meta">
                    <span class="start-list-athlete-name">${athleteName}</span>
                    ${country}
                </div>
                ${athleteProfile}
            </li>
        `;
    }).join('');
}

function set_start_list_modal(event) {
    const title = document.getElementById('start-list-modal-title');
    const list = document.getElementById('start-list-modal-list');

    if (!title || !list) {
        return;
    }

    title.innerText = `📋 ${event.name} Start List`;
    title.setAttribute('title', title.innerText);
    list.innerHTML = start_list_modal_build(event.start_list || []);
}

const eventStartListModalData = new Map();

function clear_event_start_list_modal_data() {
    eventStartListModalData.clear();
}

function register_event_start_list_modal_data(event) {
    eventStartListModalData.set(String(event.id), {
        name: event.name,
        start_list: event.start_list || [],
    });
}

function set_start_list_modal_by_event_id(eventId) {
    const event = eventStartListModalData.get(String(eventId));

    if (!event) {
        return;
    }

    set_start_list_modal(event);
}

function handle_start_list_trigger_click(e) {
    const eventId = e.currentTarget.dataset.eventId;

    if (!eventId) {
        return;
    }

    set_start_list_modal_by_event_id(eventId);
}

function set_event_name(element, event) {
    element.textContent = event.name;
    element.setAttribute('data-target', `#event-${event.id}`);
}

function set_event_date(element, event) {
    element.innerText = '📅 ' + dayjs(event.starts_at).format('DD MMMM') + ' - ' + dayjs(event.ends_at).format('DD MMMM YYYY');
}

function set_event_country(element, event) {
    element.innerText = `📍 ${event.location} (${event.country})`;
}

function set_event_discipline(element, event) {
    element.innerHTML = `🧗 ${beautify_disciplines(event.disciplines)}`;
}

function set_event_poster(element, event) {
    const round = event.rounds.slice(-1)[0];
    const youTubeVideoId = video_id_from_stream(round);

    lazy_set_background_image(element, `https://img.youtube.com/vi/${youTubeVideoId}/hqdefault.jpg`);
}

function set_event_streams(element, event) {
    const streamableRoundsCount = event.rounds.filter((round) => !round_is_non_speed_qualification(round)).length;
    const streams = streamableRoundsCount === 1 ? 'Stream' : 'Streams';

    element.innerHTML = `💻 ${streamableRoundsCount} ${streams}`;
}

function set_event_page(element, event) {
    element.href = event.event_url;
}

function build_event_start_list_button(eventId, startList) {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'event-start-list-trigger';
    button.innerHTML = start_list_build(startList);
    button.setAttribute('data-toggle', 'modal');
    button.setAttribute('data-target', '#start-list-modal');
    button.dataset.eventId = String(eventId);

    return button;
}

function set_event_start_list(element, event) {
    const startList = event.start_list || [];
    register_event_start_list_modal_data(event);

    if (!startList.length) {
        element.innerHTML = start_list_build(startList);

        return;
    }

    const button = build_event_start_list_button(event.id, startList);
    element.innerHTML = '';
    element.appendChild(button);
}

function set_event_schedule_status(element, event) {
    element.innerHTML = event_schedule_status(event);
}
