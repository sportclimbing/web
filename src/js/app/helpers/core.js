const STREAMS_FALLBACK_URL = 'https://www.youtube.com/@worldclimbing/streams';
const YOUTUBE_EMBED_BASE_URL = 'https://www.youtube-nocookie.com/embed';
const GITHUB_BUTTON_SCRIPT_SRC = 'https://buttons.github.io/buttons.js';
const GITHUB_BUTTON_SLOT_ID = 'season-github-button-slot';
const NEXT_EVENT_START_LIST_AVATAR_LIMIT = 8;
const SITE_TIME_FORMAT_OPTIONS = {
    hour: '2-digit',
    minute: '2-digit',
};

let quickDisciplineFilter = null;

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

function get_page_type() {
    return document.body.dataset.pageType || 'season';
}

function is_event_page() {
    return get_page_type() === 'event';
}

function event_is_streaming(event) {
    const now = dayjs();
    const eventStart = dayjs(event.starts_at);
    const eventEnd = dayjs(event.ends_at);

    return now.isBetween(eventStart, eventEnd);
}

function event_is_upcoming(event) {
    return new Date(event.starts_at) > new Date();
}

function pretty_starts_in(event) {
    return dayjs(event.starts_at).fromNow();
}

function pretty_finished_ago(event) {
    return `Streamed ${dayjs(event.starts_at).fromNow()}`;
}

export function round_will_be_streamed(round) {
    if (round && round.league_name === 'IFSC Paraclimbing') {
        return true;
    }

    const disciplines = Array.isArray(round && round.disciplines) ? round.disciplines : [];

    return (round && round.kind !== 'qualification') || disciplines.includes('speed');
}

let nextEventMobileCountdownSyncFrame = null;
let eventNotStartedCountdownIntervalId = null;
let nextEventCountdownIntervalId = null;


function sync_next_event_mobile_countdown_height() {
    const nextEventContainer = document.querySelector('.next-event');
    const countdown = document.getElementById('next-event-countdown');

    if (!nextEventContainer) {
        return;
    }

    if (!countdown || countdown.hidden || !window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches) {
        nextEventContainer.style.removeProperty('--next-event-mobile-media-height');

        return;
    }

    const thumbnail = document.querySelector('#next-event-details .youtube-thumbnail');

    if (!thumbnail) {
        nextEventContainer.style.removeProperty('--next-event-mobile-media-height');

        return;
    }

    const thumbnailHeight = Math.round(thumbnail.getBoundingClientRect().height);

    if (!thumbnailHeight) {
        nextEventContainer.style.removeProperty('--next-event-mobile-media-height');

        return;
    }

    nextEventContainer.style.setProperty('--next-event-mobile-media-height', `${thumbnailHeight}px`);
}

function schedule_next_event_mobile_countdown_height_sync() {
    if (nextEventMobileCountdownSyncFrame) {
        window.cancelAnimationFrame(nextEventMobileCountdownSyncFrame);
    }

    nextEventMobileCountdownSyncFrame = window.requestAnimationFrame(() => {
        nextEventMobileCountdownSyncFrame = null;
        sync_next_event_mobile_countdown_height();
    });
}

function get_selected_season() {
    return get_id_from_path('season') || get_id_from_hash('season') || DEFAULT_SEASON;
}

function get_event_page_event_id() {
    if (document.body instanceof HTMLElement) {
        const bodyEventId = String(document.body.dataset.eventId || '').trim();

        if (bodyEventId !== '') {
            return bodyEventId;
        }
    }

    return '';
}

function get_structured_data_request_url() {
    const seasonSelector = document.querySelector('select[name="season-selector"]');
    const season = seasonSelector instanceof HTMLSelectElement
        ? String(seasonSelector.value || '').trim()
        : String(get_selected_season() || '').trim();

    if (!season) {
        return '';
    }

    const eventId = get_event_page_event_id();

    if (!eventId) {
        return `/structured-data/events_${season}.json`;
    }

    return `/structured-data/events_${season}_${eventId}.json`;
}

function load_season_structured_data() {
    const requestUrl = get_structured_data_request_url();

    if (!requestUrl) {
        return;
    }

    let structuredDataScript = document.getElementById('structured-data-events');

    if (!(structuredDataScript instanceof HTMLScriptElement)) {
        structuredDataScript = document.createElement('script');
        structuredDataScript.id = 'structured-data-events';
        structuredDataScript.type = 'application/ld+json';
        document.head.appendChild(structuredDataScript);
    }

    const request = new XMLHttpRequest();

    request.open('GET', requestUrl, true);
    request.addEventListener('load', () => {
        if (request.status < 200 || request.status >= 300 || !request.responseText) {
            return;
        }

        try {
            const parsedPayload = JSON.parse(request.responseText);
            structuredDataScript.textContent = JSON.stringify(parsedPayload);
        } catch (_error) {
            // Ignore malformed payloads without interrupting page behavior.
        }
    });
    request.send();
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
    const element = first_element_by_name(name);

    return element ? element.checked : false;
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
    checkbox.dispatchEvent(new Event('change'));
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

function get_id_from_path(name) {
    if (window.location.pathname) {
        const regex = new RegExp(`/${name}/(?<id>\\d+)(?:/|$)`);
        const match = regex.exec(window.location.pathname);

        if (match) {
            return parseInt(match.groups.id, 10);
        }
    }

    return '';
}

function load_config_from_modal() {
    const hasModal = Boolean(document.querySelector('#config-leagues input[type="checkbox"]'));

    if (!hasModal) {
        const configRaw = window.localStorage.getItem('config');

        if (configRaw) {
            try {
                return JSON.parse(configRaw);
            } catch (_) {
                // fall through to defaults
            }
        }

        return {
            league: {
                "cups": true,
                "paraclimbing": true,
                "games": false,
            },
            category: {
                "women": true,
                "men": true,
            },
            disciplines: {
                "boulder": true,
                "lead": true,
                "speed": true,
            },
            rounds: {
                "qualification": true,
                "semi-final": true,
                "final": true,
            },
            streamable: false,
        };
    }

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
            const value = read_nested_value(config, path);

            if (value !== undefined) {
                set_checkbox_checked(inputName, value);
            }
        });
    } catch (error) {
        window.localStorage.clear();
    }
}

function config_selected_leagues() {
    const leaguesContainer = document.getElementById('config-leagues');
    const checkedCheckboxes = leaguesContainer ? Array.from(leaguesContainer.querySelectorAll('input[type="checkbox"]:checked')) : [];

    if (!leaguesContainer || (checkedCheckboxes.length === 0 && leaguesContainer.querySelectorAll('input[type="checkbox"]').length === 0)) {
        return ["World Cups and World Championships", "IFSC Paraclimbing", "Games"];
    }

    return checkedCheckboxes.map((checkbox) => checkbox.value);
}

function parse_round_metadata_tokens(value) {
    if (!value) {
        return [];
    }

    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function apply_search_filters() {
    const config = load_config_from_modal();
    const configDisciplines = new Set(get_enabled_filter_keys(config.disciplines));
    const enabledDisciplines = quickDisciplineFilter !== null
        ? new Set([quickDisciplineFilter])
        : configDisciplines;
    const enabledCategories = new Set(get_enabled_filter_keys(config.category));
    const visibleEventIds = new Set();
    const visibleRoundKeyCountsByEventId = new Map();
    let visibleRoundCount = 0;

    const league_matches_config = (leagueName) => {
        const league = leagueName.toLowerCase();
        return (config.league.cups && (league.includes('world cup') || league.includes('world championship'))) ||
               (config.league.paraclimbing && league.includes('paraclimbing')) ||
               (config.league.games && (league.includes('games') || league.includes('olympic')));
    };

    const round_matches_filters = (roundElement) => {
        if (!(roundElement instanceof HTMLElement)) {
            return false;
        }

        const kind = roundElement.dataset.roundKind || '';
        const disciplines = parse_round_metadata_tokens(roundElement.dataset.roundDisciplines);
        const categories = parse_round_metadata_tokens(roundElement.dataset.roundCategories);
        const hasStreamUrl = Boolean(roundElement.querySelector('.youtube-play-button[data-round-stream-url], [data-action="round-stream"][data-round-stream-url]'));

        if (config.streamable && !hasStreamUrl) {
            return false;
        }

        if (!has_intersection(disciplines, enabledDisciplines)) {
            return false;
        }

        if (!config.rounds[kind]) {
            return false;
        }

        if (!has_intersection(categories, enabledCategories)) {
            return false;
        }

        return true;
    };

    document.querySelectorAll('#accordion .ifsc-league-card[data-event-id]').forEach((eventCard) => {
        if (!(eventCard instanceof HTMLElement)) {
            return;
        }

        const eventId = eventCard.dataset.eventId || '';
        const eventLeagueName = eventCard.dataset.eventLeagueName || '';
        const eventMatchesLeague = Boolean(eventId) && league_matches_config(eventLeagueName);

        const roundKeyCounts = new Map();

        eventCard.querySelectorAll('.event-round-card[data-round-key]').forEach((roundElement) => {
            if (!(roundElement instanceof HTMLElement)) {
                return;
            }

            const roundMatches = eventMatchesLeague && round_matches_filters(roundElement);
            roundElement.hidden = !roundMatches;
            roundElement.style.display = roundMatches ? '' : 'none';

            if (!roundMatches) {
                return;
            }

            const roundKey = roundElement.dataset.roundKey || '';

            if (!roundKey) {
                return;
            }

            roundKeyCounts.set(roundKey, (roundKeyCounts.get(roundKey) || 0) + 1);
            visibleRoundCount += 1;
        });

        if (!eventMatchesLeague || roundKeyCounts.size === 0) {
            return;
        }

        visibleEventIds.add(eventId);
        visibleRoundKeyCountsByEventId.set(eventId, roundKeyCounts);
    });

    return {
        visibleEventIds,
        visibleRoundKeyCountsByEventId,
        visibleRoundCount,
    };
}
