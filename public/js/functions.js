function event_is_streaming(event) {
    const now = dayjs();
    const eventStart = dayjs(event.starts_at);

    return eventStart.isBetween(now, now.subtract(3, 'hour'));
}

function event_is_upcoming(event) {
    return new Date(event.starts_at) > new Date();
}

function event_schedule_status(event) {
    if (event.rounds.length === 0) {
        return '❌ No events (adjust filters)';
    }

    for (const round of event.rounds) {
        if (!round.schedule_confirmed) {
            return '⏳ Unconfirmed Schedule';
        }
    }

    return '☑️ Confirmed Schedule';
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

function get_next_event(events) {
    const now = new Date();

    for (const event of events) {
        for (const round of event.rounds) {
            if (new Date(round.starts_at) >= now || event_is_streaming(round)) {
                return event;
            }
        }
    }
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

function get_selected_season() {
    return get_id_from_hash('season') || DEFAULT_SEASON;
}

function get_selected_event() {
    return get_id_from_hash('event');
}

function first_element_by_name(name){
    return document.getElementsByName(name)[0];
}

function config_is_enabled(name) {
    return first_element_by_name(name).checked;
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

function apply_search_filters(jsonData) {
    const disciplines = [];
    let rounds = [];
    let config = load_config_from_modal();
    let disciplinesRegex;

    for (let discipline in config.disciplines) {
        if (config.disciplines[discipline]) {
            disciplines.push(discipline);
        }
    }

    if (disciplines.length !== config.disciplines.length) {
        if (disciplines.includes('boulder') && disciplines.includes('lead')) {
            disciplines.push('combined');
        }

        disciplinesRegex = new RegExp('(' + disciplines.join('|') + ')', 'i');
    }

    for (let round in config.rounds) {
        if (config.rounds[round]) {
            rounds.push(round);
        }
    }

    const roundsRegex = new RegExp(rounds.join('|'), 'i');
    let filteredEvents = [];

    jsonData.events.forEach((event) => {
        let filteredRounds = [];

        event.rounds.forEach((round) => {
            if (disciplines && !disciplinesRegex.test(round.name)) {
                return false;
            }

            if (rounds && !roundsRegex.test(round.name)) {
                return false;
            }

            filteredRounds.push(round);
        });

        event.rounds = filteredRounds;
        filteredEvents.push(event);
    });

    return filteredEvents;
}

function basename(path) {
    return path.split('/').reverse()[0];
}

function event_poster_path(event) {
    return `img/posters/${event.starts_at.substring(0, 4)}/${basename(event.poster)}`;
}

function set_background_image(event) {
    let youTubeVideoId;

    if (event && event.stream_url) {
        youTubeVideoId = extract_youtube_video_id(event.stream_url);
    }

    if (!youTubeVideoId) {
        youTubeVideoId = DEFAULT_BACKGROUND_IMAGE_ID;
    }

    const backgroundImage = `img/covers/${youTubeVideoId}.jpg`;
    const backgroundImageFallback = `img/covers/${DEFAULT_BACKGROUND_IMAGE_ID}.jpg`;

    document.body.style.backgroundImage = `url(${backgroundImage})`;

    const img = new Image();
    img.src = backgroundImage;
    img.onerror = () => document.body.style.backgroundImage = `url(${backgroundImageFallback})`;
}

function set_round_youtube_cover(element, round) {
    let youtubeVideoId = extract_youtube_video_id(round.stream_url);

    if (!youtubeVideoId) {
        if (round.name.includes('Women')) {
            youtubeVideoId = 'MQeQs6K_T5g';
        } else {
            youtubeVideoId = 'emrHdLsJTk4';
        }
    }

    element.style.backgroundImage = `url(https://img.youtube.com/vi/${youtubeVideoId}/0.jpg)`;
}

function set_round_stream_button(element, round) {
    if (round.stream_url) {
        element.attr('href', round.stream_url);
        element.on('click', handle_watch_event(round));
    } else {
        element.attr('href', 'https://www.youtube.com/@sportclimbing/streams');
        element.on('click', handle_watch_event_no_url(round));
    }
}

function set_round_date(element, round) {
    element.innerText = '📆 ' + dayjs(round.starts_at).format('ddd, D MMMM, YYYY [at] hh:mm A');
}
function set_round_name(element, round) {
    element.innerText = `🏆 ${round.name}`;
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

const handle_watch_event = (event) => (e) => {
    const youTubeVideoId = extract_youtube_video_id(e.currentTarget.href);

    if (youTubeVideoId) {
        e.preventDefault();

        const streamButton = $(e.currentTarget);
        streamButton.attr('data-target', "#video-modal");
        streamButton.attr('data-toggle', "modal");

        let chat = $('#live-chat');
        let chatToggle = $('#chat-toggle');

        if (event_is_streaming(event) || event_is_upcoming(event)) {
            chat.show();
            chatToggle.show();
        } else {
            chat.hide();
            chatToggle.hide();
        }

        $('#youtube-video').attr('src', `https://www.youtube.com/embed/${youTubeVideoId}?autoplay=1`);
        $('#youtube-video-title').html(`🍿 ${event.name}`);
    }
};

const handle_watch_event_no_url = (event) => (e) => {
    e.preventDefault();

    if (event_is_upcoming(event) && !event_is_streaming(event)) {
        alert('The event has not started yet, and we couldn\'t find a link to it. Come back later, or check the previous streams!');
    } else {
        if (confirm('We could not find a link for this event. Do you want to check IFSC\'s YouTube channel?')) {
            window.open($(e.targetElement).attr('href'), '_blank', '');
        }
    }
};

Object.defineProperty(String.prototype, 'capitalize', {
    value: function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    },
    enumerable: false
});

function start_list_build(startList) {
    let list = [];

    for (const athlete of startList) {
        list.push(athlete.first_name);

        if (list.length === 2) {
            break;
        }
    }

    if (!list.length) {
        return '📋 Start List: Pending';
    }

    return '📋 Start List: ' + list.slice(0, 2).join(', ') + ', etc...';
}

function set_event_name(element, event) {
    element.innerHTML = '🥇 ' + event.name.replace(/20\d{2}/, '').replace(/^IFSC - /, '').replace(/\([^)]+\)/g, '').replace('Climbing', 'IFSC').replace(' - ', '');
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
    if (event.poster) {
        element.src = event_poster_path(event);
    } else {
        element.src = DEFAULT_POSTER;
    }

    element.alt = event.name;
    element.title = event.name;
}

function set_event_streams(element, event) {
    const streams = event.rounds.length === 1 ? 'Stream' : 'Streams';

    element.innerHTML = `💻 ${event.rounds.length} ${streams}`;
}

function set_event_page(element, event) {
    element.href = `https://www.ifsc-climbing.org/component/ifsc/?view=event&WetId=${event.id}`;
}

function set_event_start_list(element, event) {
    element.innerHTML = start_list_build(event.start_list);
}

function set_event_schedule_status(element, event) {
    element.innerHTML = event_schedule_status(event);
}