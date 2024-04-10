dayjs.extend(window.dayjs_plugin_relativeTime);
dayjs.extend(window.dayjs_plugin_isBetween);

const DEFAULT_SEASON = '2024';
const DEFAULT_POSTER = 'img/posters/2023/default.jpg';
const DEFAULT_BACKGROUND_IMAGE_ID = 'eTNDKfip2SY';

let config;

let selectedSeason = get_selected_season();
let selectedEvent = get_selected_event();

const fetchSeasons = (async () => {
    let seasonTitle = document.getElementById('ifsc-season');
    seasonTitle.innerHTML = seasonTitle.innerHTML.replace(/20\d{2}/, selectedSeason);

    const response = await fetch(`events/seasons.json`);
    const jsonData = await response.json();
    const seasonSelector = document.querySelector('select[name="season-selector"]');

    jsonData.seasons.forEach((season) => {
        let option = document.createElement('option');
        option.value = season;
        option.innerText = season;

        if (season === selectedSeason) {
            option.selected = true;
        }

        seasonSelector.appendChild(option);
    });
});

const refresh = (async () => {
    const response = await fetch(`events/events_${selectedSeason}.json?v=` + Math.floor(Math.random() * 10000));
    const jsonData = await response.json();
    const events = apply_search_filters(jsonData);
    const nextEvent = get_next_event(events);
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
    let lastEventFinished = true;
    let seasonHasUpcomingEvents = false;
    let numRounds = 0;

    events.forEach((event) => {
        if (event.rounds.length === 0) {
            return;
        }

        let clone = leagueTemplate.content.cloneNode(true);
        let poster = clone.querySelector('.event-poster');

        set_event_name(clone.querySelector('.event-name'), event);
        set_event_date(clone.querySelector('.event-date'), event);
        set_event_country(clone.querySelector('.event-country'), event);
        set_event_discipline(clone.querySelector('.event-disciplines'), event);
        set_event_streams(clone.querySelector('.event-status'), event);
        set_event_page(clone.querySelector('.event-page'), event);
        set_event_start_list(clone.querySelector('.event-start-list'), event);
        set_event_schedule_status(clone.querySelector('.event-schedule-status'), event);
        set_event_poster(poster, event);

        clone.getElementById('heading_id').id = `heading_${event.id}`;
        clone.getElementById('event-n').setAttribute('aria-labelledby', `event-${event.id}`);
        clone.getElementById('event-n').id = `event-${event.id}`;
        clone.querySelector('.event-watch-button').setAttribute('data-target', `#event-${event.id}`);

        accordion.appendChild(clone);

        event.rounds.forEach((round) => {
            numRounds++;
            let clone = template.content.cloneNode(true);
            const streamButton = $('#button-stream', clone);

            set_round_details(clone, round);

            if (event_is_streaming(round)) {
                clone.getElementById('ifsc-starts-in').innerText = `🔴 Live Now`;
                clone.getRootNode().firstChild.nextSibling.style.backgroundColor = 'rgba(193,241,241,0.4)';
                liveEvent = round;
                seasonHasUpcomingEvents = true;

                clone.querySelector('.button-results').href = `https://ifsc.results.info/#/event/${event.id}`;
                document.getElementById(`event-${event.id}`).getElementsByTagName('ul')[0].appendChild(clone);

                set_background_image(round);
                set_next_event(round, event, true);
            } else if (event_is_upcoming(round)) {
                let startsIn = clone.getElementById('ifsc-starts-in');
                seasonHasUpcomingEvents = true;

                if (!liveEvent && lastEventFinished) {
                    lastEventFinished = false;
                    startsIn.innerText = `🟢 Next Event (starts ${pretty_starts_in(round)})`;
                    clone.getRootNode().firstChild.nextSibling.style.backgroundColor = 'rgba(193,241,241,0.4)';

                    set_background_image(round);
                    set_next_event(round, event);
                    clone.querySelector('a[data-toggle="modal"]').style.display = 'inline';
                } else {
                    startsIn.innerText = `⌛ Starts ${pretty_starts_in(round)}`;
                    poster.classList.add('bw');
                    clone.querySelector('a[data-toggle="modal"]').style.display = 'inline';
                }

                if (!round.stream_url) {
                    streamButton.hide();
                }

                clone.querySelector('.button-results').style.display = 'none';
                document.getElementById(`event-${event.id}`).getElementsByTagName('ul')[0].appendChild(clone);
            } else {
                clone.getElementById('ifsc-starts-in').innerText = `🏁 ${pretty_finished_ago(round)}`;
                clone.querySelector('.button-results').href = `https://ifsc.results.info/#/event/${event.id}`;

                lastEventFinished = true;
                document.getElementById(`event-${event.id}`).getElementsByTagName('ul')[0].appendChild(clone);
            }
        });
    });

    if (numRounds === 0) {
        const div = document.createElement('div');
        div.innerHTML = '⚠️ No results. Please adjust filters above!';
        div.className = 'no-results';

        accordion.appendChild(div);
    }

    let leagueElement = document.getElementById(`event-${selectedEvent}`);

    if (!allCollapsed) {
        let currentOpenElement = document.getElementById(currentOpenId);
        if (currentOpenId && currentOpenElement) {
            currentOpenElement.classList.add('show');
        } else if (leagueElement) {
            leagueElement.classList.add('show');
        }
    }

    set_favicon(liveEvent);

    if (!seasonHasUpcomingEvents) {
  //      set_background_image();
    }
    set_background_image();
});

(() => {
    restore_config();

    fetchSeasons().then();
    refresh().then(() => {
        window.setInterval(() => refresh(), 1000 * 10);

        let leagueElement = document.getElementById(`event-${selectedEvent}`);

        if (leagueElement && !element_is_in_viewport(leagueElement)) {
     //       leagueElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
    });

    config = load_config_from_modal();

    addEventListener('hashchange', () => {
        let season = get_selected_season();

        selectedSeason = season;
        selectedEvent = null;
        refresh().then();

        const seasonSelector = document.getElementById('ifsc-season');
        seasonSelector.innerHTML = seasonSelector.innerHTML.replace(/20\d{2}/, season);
    });

    $('#video-modal').on('hide.bs.modal', () => {
        $('#youtube-video').attr('src', 'about:blank');
    })

    $('#save-filters').on('click', () => {
        config = load_config_from_modal();
        refresh().then();

        window.localStorage.setItem('config_v2', JSON.stringify(config));
    });

    $('input[type="checkbox"]').on('change', () => refresh());

    if (document.location.hostname === 'ifsc.stream') {
        const img = new Image();
        img.src = 'https://calendar.ifsc.stream/pixel.gif?' + (document.referrer ? `r=${encodeURIComponent(document.referrer)}` : '');
        img.width = 1;
        img.height = 1;

        document.body.appendChild(img);
    }

    $('select[name="season-selector"]').on('change', (e) => {
        window.location = `#/season/${e.target.value}`;
    });

    // Remove old config
    window.localStorage.removeItem('config');

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
