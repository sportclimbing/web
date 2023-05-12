dayjs.extend(window.dayjs_plugin_relativeTime);
dayjs.extend(window.dayjs_plugin_isBetween);

function sort_by_date(event1, event2) {
    let eventDate1 = new Date(event1.start_time);
    let eventDate2 = new Date(event2.start_time);

    if (eventDate1 < eventDate2) {
        return -1;
    }

    if (eventDate1 > eventDate2) {
        return 1;
    }

    return 0;
}

function sort_league_by_date(league1, league2) {
    return sort_by_date(league1[0], league2[0]);
}

function event_is_streaming(event) {
    const now = dayjs();
    const eventStart = dayjs(event.start_time);

    return eventStart.isBetween(now, now.subtract(3, 'hour'));
}

function pretty_starts_in(event) {
    return dayjs(event.start_time).fromNow();
}

function pretty_started_ago(event) {
    return `Started ${dayjs(event.start_time).fromNow()}`;
}

function pretty_finished_ago(event) {
    return `Streamed ${dayjs(event.start_time).fromNow()}`;
}

function get_next_event(leagues) {
    const now = new Date();

    for (const league of leagues) {
        if (!league) {
            continue;
        }

        for (const event of league) {
            if (new Date(event.start_time) >= now || event_is_streaming(event)) {
                return event;
            }
        }
    }
}

function sort_leagues_by_date(jsonData) {
    const leagues = [];
    const filteredEvents = jsonData.events.filter(apply_search_filters);

    filteredEvents.forEach((event) => {
        if (typeof leagues[event.id] === 'undefined') {
            leagues[event.id] = [];
        }

        leagues[event.id].push(event);
    });

    leagues.sort(sort_league_by_date);

    return leagues;
}

function element_is_in_viewport(el) {
    const rect = el.getBoundingClientRect();

    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

function remove_hash() {
    let scrollV, scrollH, loc = window.location;
    if ("pushState" in history)
        history.pushState("", document.title, loc.pathname + loc.search);
    else {
        // Prevent scrolling by storing the page's current scroll offset
        scrollV = document.body.scrollTop;
        scrollH = document.body.scrollLeft;

        loc.hash = "";

        // Restore the scroll offset, should be flicker free
        document.body.scrollTop = scrollV;
        document.body.scrollLeft = scrollH;
    }
}

function get_selected_season() {
    return get_id_from_hash('season') || defaultSeason;
}

function get_selected_event() {
    return get_id_from_hash('event');
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
    const match = url.match(/youtu(\.be|be\.com)\/(live\/|watch\?v=)?(?<video_id>[a-zA-Z0-9_-]{10,})/);

    if (match) {
        return match.groups.video_id;
    }

    return null;
}

function load_config_from_modal() {
    return {
        disciplines: {
            "boulder": config_is_enabled('discipline[boulder]'),
            "lead": config_is_enabled('discipline[lead]'),
            "speed": config_is_enabled('discipline[speed]'),
        },
        rounds: {
            "qualifications?": config_is_enabled('round[qualifications]'),
            "semi[-\\s]?finals?": config_is_enabled('round[semifinals]'),
            "[\\s]finals?": config_is_enabled('round[finals]'),
        }
    };
}

function restore_config() {
    let config = window.localStorage.getItem('config');
    let json;

    if (config) {
        try {
            json = JSON.parse(config);

            first_element_by_name("discipline[boulder]").checked = json.disciplines.boulder;
            first_element_by_name("discipline[lead]").checked = json.disciplines.lead;
            first_element_by_name("discipline[speed]").checked = json.disciplines.speed;

            first_element_by_name("round[qualifications]").checked = json.rounds["qualifications?"];
            first_element_by_name("round[semifinals]").checked = json.rounds["semi[-\\s]?finals?"];
            first_element_by_name("round[finals]").checked = json.rounds["[\\s]finals?"];
        } catch (e) {
            window.localStorage.clear();
        }
    }
}

function config_is_enabled(name) {
    return first_element_by_name(name).checked;
}

function first_element_by_name(name) {
    return document.getElementsByName(name)[0];
}

function apply_search_filters(event) {
    const disciplines = [];
    const rounds = [];

    for (let discipline in config.disciplines) {
        if (config.disciplines[discipline]) {
            disciplines.push(discipline);
        }
    }

    if (disciplines.length !== config.disciplines.length) {
        const disciplinesRegex = new RegExp('(' + disciplines.join('|') + ')', 'i');
        if (!disciplinesRegex.test(event.name)) {
            return false;
        }
    }

    for (let round in config.rounds) {
        if (config.rounds[round]) {
            rounds.push(round);
        }
    }

    if (rounds.length !== config.rounds.length) {
        const roundsRegex = new RegExp(rounds.join('|'), 'i');

        if (!roundsRegex.test(event.name)) {
            return false;
        }
    }

    return true;
}

function basename(path) {
    return path.split('/').reverse()[0];
}

const defaultSeason = '2023';

let selectedSeason = get_selected_season();
let selectedEvent = get_selected_event();

const fetchSeasons = (async () => {
    let seasonTitle = document.getElementById('ifsc-season');
    seasonTitle.innerText = seasonTitle.innerText.replace(/20\d{2}/, selectedSeason);

    const response = await fetch(`events/seasons.json`);
    const jsonData = await response.json();
    const seasonSelector = document.getElementById('ifsc-season-selector');

    jsonData.seasons.forEach((season) => {
        let link = document.createElement('a');
        link.classList.add('dropdown-item');
        link.setAttribute('href', `#/season/${season}`);
        link.innerText = `Season ${season}`;

        seasonSelector.appendChild(link);
    });
});

const refresh = (async () => {
    const response = await fetch(`events/events_${selectedSeason}.json?v=` + Math.floor(Math.random() * 10000));
    const jsonData = await response.json();
    const leagues = sort_leagues_by_date(jsonData);
    const nextEvent = get_next_event(leagues);
    const now = new Date();
    const leagueTemplate = document.getElementById('ifsc-league');
    const accordion = document.getElementById('accordion');
    const currentOpenElement = document.querySelector('div#accordion .show');
    let currentOpenId = null;

    if (currentOpenElement) {
        currentOpenId = currentOpenElement.getAttribute('id');
    }

    const allCollapsed = accordion.childElementCount > 0 && !currentOpenId;

    if (!selectedEvent && nextEvent) {
        selectedEvent = nextEvent.id;
    }

    while (accordion.lastElementChild) {
        accordion.removeChild(accordion.lastElementChild);
    }

    const template = document.getElementById("ifsc-event");
    let liveEvent = null;
    let lastEventFinished = false;

    leagues.forEach((league) => {
        const clone = leagueTemplate.content.cloneNode(true);

        clone.getElementById('ifsc-league-name').innerHTML = '🥇 ' + league[0].description.replace(/^IFSC - Climbing/, '');
        clone.getElementById('ifsc-league-name').setAttribute('data-target', `#event-${league[0].id}`);

        clone.getElementById('heading_id').id = `heading_${league[0].id}`;

        clone.getElementById('event-n').setAttribute('aria-labelledby', `event-${league[0].id}`);
        clone.getElementById('event-n').id = `event-${league[0].id}`;

        accordion.appendChild(clone);

        league.forEach((event) => {
            const clone = template.content.cloneNode(true);
            const poster = clone.getElementById('ifsc-poster');

            if (event.poster) {
                poster.src = `img/posters/${basename(event.poster)}`;
            } else {
                poster.src = 'img/posters/230329_Poster_SEOUL23_thumb.jpg';
            }

            poster.alt = event.description;
            poster.title = event.description;

            clone.getElementById('ifsc-name').innerText = `🏆 ${event.name}`;
            clone.getElementById('ifsc-description').innerText = '📆 ' + dayjs(event.start_time).format('MMMM D, YYYY [at] hh:mm A');

            const streamButton = $('#button-stream', clone);

            if (event.stream_url) {
                streamButton.attr('href', event.stream_url);
                streamButton.on('click', (e) => {
                    const youTubeVideoId = extract_youtube_video_id(e.currentTarget.href);

                    if (youTubeVideoId) {
                        e.preventDefault();

                        streamButton.attr('data-target', "#video-modal");
                        streamButton.attr('data-toggle', "modal");

                        $('#youtube-video').attr('src', `https://www.youtube.com/embed/${youTubeVideoId}?autoplay=1`);
                        $('#youtube-video-title').html(`🍿 ${event.name}`);
                    }
                });
            } else {
                streamButton.attr('href', 'https://www.youtube.com/@sportclimbing/streams');
                streamButton.on('click', (e) => {
                    e.preventDefault();

                    if (confirm('We could not find a link for this event. Do you want to check IFSC\'s YouTube channel?')) {
                        window.open(streamButton.attr('href'), '_blank', '');
                    }
                });
            }

            if (event_is_streaming(event)) {
                clone.getElementById('ifsc-starts-in').innerText = `🔴 Live Now`;
                clone.getRootNode().firstChild.nextSibling.style.backgroundColor = '#f7f7f7';
                liveEvent = event;

                clone.getRootNode().firstChild.nextSibling.style.opacity = '100%'
                clone.getElementById('button-results').href = `https://ifsc.results.info/#/event/${event.id}`;
                document.getElementById(`event-${event.id}`).getElementsByTagName('ul')[0].appendChild(clone);
            } else if (new Date(event.start_time) > now) {
                let startsIn = clone.getElementById('ifsc-starts-in');

                if (!liveEvent && lastEventFinished) {
                    lastEventFinished = false;
                    startsIn.innerText = `🟢 Starts ${pretty_starts_in(event)}`;

                    clone.getRootNode().firstChild.nextSibling.style.backgroundColor = 'rgba(246,245,245,0.4)';
                    clone.getRootNode().firstChild.nextSibling.style.opacity = '100%'
                } else {
                    clone.getRootNode().firstChild.nextSibling.style.opacity = '80%'
                    startsIn.innerText = `⌛ Starts ${pretty_starts_in(event)}`;
                }

                clone.getElementById('button-results').style.display = 'none';
                document.getElementById(`event-${event.id}`).getElementsByTagName('ul')[0].appendChild(clone);
            } else {
                clone.getElementById('ifsc-starts-in').innerText = `🏁 ${pretty_finished_ago(event)}`;

                clone.getRootNode().firstChild.nextSibling.style.opacity = '80%'
                clone.getElementById('button-results').href = `https://ifsc.results.info/#/event/${event.id}`;

                lastEventFinished = true;
                document.getElementById(`event-${event.id}`).getElementsByTagName('ul')[0].appendChild(clone);
            }
        });
    });

    let leagueElement = document.getElementById(`event-${selectedEvent}`);

    if (!allCollapsed) {
        let currentOpenElement = document.getElementById(currentOpenId);
        if (currentOpenId && currentOpenElement) {
            currentOpenElement.classList.add('show');
        } else if (leagueElement) {
            leagueElement.classList.add('show');
        }
    }
});

let config;

(() => {
    fetchSeasons().then();
    refresh().then(() => {
        window.setInterval(refresh, 1000 * 60);

        let leagueElement = document.getElementById(`event-${selectedEvent}`);

        if (leagueElement && !element_is_in_viewport(leagueElement)) {
            leagueElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
    });

    restore_config();
    config = load_config_from_modal();

    addEventListener('hashchange', () => {
        let season = get_selected_season();

        selectedSeason = season;
        selectedEvent = null;
        refresh().then();

        const seasonSelector = document.getElementById('ifsc-season');
        seasonSelector.innerText = seasonSelector.innerText.replace(/20\d{2}/, season);
    });

    $('#video-modal').on('hide.bs.modal', () => {
        $('#youtube-video').attr('src', 'about:blank');
    })

    $('#save-filters').on('click', () => {
        config = load_config_from_modal();
        refresh().then();

        window.localStorage.setItem('config', JSON.stringify(config));
    });
})();
