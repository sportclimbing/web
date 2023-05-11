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

function get_upcoming_events(jsonData) {
    const now = new Date();
    const upcomingEvents = jsonData.events.filter((event) => new Date(event.start_time) >= now || event_is_streaming(event));

    upcomingEvents.sort(sort_by_date);

    return upcomingEvents;
}

function sort_leagues_by_id(jsonData) {
    const leagues = [];
    jsonData.events.forEach((event) => {
        if (typeof leagues[event.id] === 'undefined') {
            leagues[event.id] = [];
        }

        leagues[event.id].push(event);
    });

    leagues.sort(sort_league_by_date);

    return leagues;
}

function element_is_in_viewport (el) {
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
        const regex = new RegExp(`/${name}/(\\d+)`);
        const match = regex.exec(window.location.hash);

        if (match) {
            return parseInt(match[1]);
        }
    }

    return '';
}

function extract_youtube_video_id(url) {
    const match = url.match(/youtu(\.be|be\.com)\/(live\/|watch\?v=)?([a-zA-Z0-9_-]{10,})/);

    if (match) {
        return match[3];
    }

    return null;
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
    const upcomingEvents = get_upcoming_events(jsonData);
    const leagues = sort_leagues_by_id(jsonData);
    const now = new Date();
    const leagueTemplate = document.getElementById('ifsc-league');
    const accordion = document.getElementById('accordion');
    const currentOpenElement = document.querySelector('div#accordion .show');
    const nextEvent = upcomingEvents.at(0);
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

    leagues.forEach((league) => {
        const clone = leagueTemplate.content.cloneNode(true);

        clone.getElementById('ifsc-league-name').innerHTML = '🥇 ' + league[0].description.replace(/^IFSC - Climbing/, '');
        clone.getElementById('ifsc-league-name').setAttribute('data-target', `#event-${league[0].id}`);

        clone.getElementById('heading_id').id = `heading_${league[0].id}`;

        clone.getElementById('event-n').setAttribute('aria-labelledby', `event-${league[0].id}`);
        clone.getElementById('event-n').id = `event-${league[0].id}`;

        accordion.appendChild(clone);
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

    const template = document.getElementById("ifsc-event");
    let liveEvent = null;
    let lastEventFinished = false;

    jsonData.events.forEach((event) => {
        try {
            const clone = template.content.cloneNode(true);

            if (event.poster) {
                clone.getElementById('ifsc-poster').src = event.poster;
            } else {
                clone.getElementById('ifsc-poster').src = 'img/posters/230329_Poster_SEOUL23_thumb.jpg';
            }

            clone.getElementById('ifsc-name').innerText = `🏆 ${event.name}`;
            clone.getElementById('ifsc-description').innerText = '📆 ' + dayjs(event.start_time).format('MMMM D, YYYY [at] hh:mm A');

            let streamButton = clone.getElementById('button-stream');

            if (event.stream_url) {
                streamButton.href = event.stream_url;
                const youTubeVideoId = extract_youtube_video_id(event.stream_url);

                if (youTubeVideoId) {
                    streamButton.setAttribute('data-target', "#video-modal");
                    streamButton.setAttribute('data-toggle', "modal");

                    streamButton.onclick = (e) => {
                        e.preventDefault();

                        $('#youtube-video').attr('src', `https://www.youtube.com/embed/${youTubeVideoId}`);
                        $('#youtube-video-title').html(`🍿 ${event.name}`);
                    };
                }
            } else {
                streamButton.href = 'https://www.youtube.com/@sportclimbing/streams';
                streamButton.onclick = (e) => {
                    e.preventDefault();

                    if (confirm('We could not find a link for this event. Do you want to check IFSC\'s YouTube channel?')) {
                        window.open(streamButton.href, '_blank', '');
                    }
                };
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
                    clone.getRootNode().firstChild.nextSibling.style.opacity = '70%'
                    startsIn.innerText = `⌛ Starts ${pretty_starts_in(event)}`;
                }

                clone.getElementById('button-results').style.display = 'none';
                document.getElementById(`event-${event.id}`).getElementsByTagName('ul')[0].appendChild(clone);
            } else {
                clone.getElementById('ifsc-starts-in').innerText = `🏁 ${pretty_finished_ago(event)}`;

                clone.getRootNode().firstChild.nextSibling.style.opacity = '70%'
                clone.getElementById('button-results').href = `https://ifsc.results.info/#/event/${event.id}`;

                lastEventFinished = true;
                document.getElementById(`event-${event.id}`).getElementsByTagName('ul')[0].appendChild(clone);
            }
        } catch (e) {
            console.log(e)
        }
    });

    if (window.location.hash && leagueElement && !element_is_in_viewport(leagueElement)) {
        leagueElement.scrollIntoView();
        remove_hash();
    }
});

(async () => {
    await fetchSeasons();
    await refresh();
    window.setInterval(refresh, 1000 * 60);

    addEventListener('hashchange', () => {
        let season = get_selected_season();

        selectedSeason = season;
        selectedEvent = null;
        document.getElementById('ifsc-season').innerText = `IFSC Climbing Streams ${season}`;
        refresh();
    });

    $('#video-modal').on('hide.bs.modal', function (e) {
        $('#youtube-video').attr('src', 'about:blank');
    })
})();
