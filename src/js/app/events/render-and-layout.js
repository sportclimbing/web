const hide_event_card = (card) => {
    if (!card) {
        return;
    }

    const collapseElement = card.querySelector('.collapse');

    if (collapseElement && (collapseElement.classList.contains('show') || collapseElement.classList.contains('collapsing'))) {
        if (window.bootstrap && window.bootstrap.Collapse) {
            window.bootstrap.Collapse.getOrCreateInstance(collapseElement, { toggle: false }).hide();
        } else {
            collapseElement.classList.remove('show');
            collapseElement.classList.remove('collapsing');
        }
    }

    if (collapseElement) {
        reset_collapsed_rounds(collapseElement);
    }

    card.hidden = true;
};

const show_event_card = (card) => {
    if (!card) {
        return;
    }

    card.hidden = false;
};

const toggle_no_results_message = (accordion, hasResults) => {
    const noResultsMessage = accordion.querySelector('#no-results-message');

    if (!noResultsMessage) {
        return;
    }

    noResultsMessage.hidden = Boolean(hasResults);
};

const apply_filtered_event_cards = (filterResult, accordion) => {
    const {
        visibleEventIds: nextVisibleEventIds,
        visibleRoundCount,
    } = filterResult;

    accordion.querySelectorAll('.ifsc-league-card[data-event-id]').forEach((card) => {
        const eventId = card.dataset.eventId;
        const isVisible = Boolean(eventId && nextVisibleEventIds.has(eventId));

        if (isVisible) {
            show_event_card(card);
            return;
        }

        hide_event_card(card);
    });

    toggle_no_results_message(accordion, visibleRoundCount > 0);
};

const is_event_panel_visible = (eventPanel) => {
    if (!eventPanel) {
        return false;
    }

    const eventCard = eventPanel.closest('.ifsc-league-card');

    if (!eventCard) {
        return false;
    }

    return !eventCard.hidden;
};

const restore_open_accordion_panel = (currentOpenId, allCollapsed) => {
    const selectedEventElement = document.getElementById(`event-${selectedEvent}`);

    if (allCollapsed) {
        return null;
    }

    if (currentOpenId) {
        const currentOpenElement = document.getElementById(currentOpenId);

        if (currentOpenElement && is_event_panel_visible(currentOpenElement)) {
            currentOpenElement.classList.add('show');
            return currentOpenId.replace('event-', '');
        }
    }

    if (selectedEventElement && is_event_panel_visible(selectedEventElement)) {
        selectedEventElement.classList.add('show');
        return selectedEvent;
    }

    return null;
};

const refresh = () => {
    const filterResult = apply_search_filters();
    const accordion = document.getElementById('accordion');
    const { currentOpenId, allCollapsed } = get_accordion_state(accordion);

    visibleEventIds = filterResult.visibleEventIds;
    apply_filtered_event_cards(filterResult, accordion);

    seasonTimeline = compute_dom_season_timeline();
    const nextEvent = seasonTimeline.liveEvent || seasonTimeline.nextEvent || get_next_event_from_visible_rounds();

    if (selectedEvent === null || !visibleEventIds.has(String(selectedEvent))) {
        selectedEvent = nextEvent ? nextEvent.id : null;
    }

    update_next_event_panel();
    setup_start_list_avatar_tooltips();
    update_month_navigation_state();
    schedule_month_nav_horizontal_position_sync();
    hide_static_event_fallback();

    const eventIdToRender = restore_open_accordion_panel(currentOpenId, allCollapsed);

    if (eventIdToRender !== null) {
        render_event_rounds(eventIdToRender);
    }

    set_favicon(seasonTimeline.liveRound);
};

const reset_collapsed_rounds = (eventElement) => {
    release_lazy_backgrounds(eventElement);
};

const handle_event_toggle_click = (event) => {
    const panelTarget = event.currentTarget.getAttribute('data-bs-target') || '';
    const eventId = panelTarget.replace('#event-', '');

    if (!eventId) {
        return;
    }

    const parsedEventId = parseInt(eventId, 10);

    if (Number.isNaN(parsedEventId)) {
        return;
    }

    selectedEvent = parsedEventId;
};

const handle_event_panel_hidden = (eventElement, accordionElement) => {
    reset_collapsed_rounds(eventElement);

    window.setTimeout(() => {
        if (!accordionElement) {
            return;
        }

        const hasOpenPanels = Boolean(accordionElement.querySelector('.collapse.show, .collapse.collapsing'));

        if (hasOpenPanels) {
            return;
        }

        selectedEvent = null;
    }, 0);
};

const setup_accordion_handlers = () => {
    const accordionElement = document.getElementById('accordion');
    const nextEventElement = document.querySelector('.next-event');

    if (!accordionElement) {
        return;
    }

    accordionElement.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;

        if (!target) {
            return;
        }

        const eventName = target.closest('.event-name');

        if (eventName) {
            handle_event_toggle_click({ currentTarget: eventName });
            return;
        }

        const streamTrigger = target.closest('.js-round-stream');

        if (streamTrigger) {
            handle_round_stream_click({
                currentTarget: streamTrigger,
                preventDefault: () => event.preventDefault(),
            });
            return;
        }

        const eventWatchButton = target.closest('.event-watch-button');

        if (eventWatchButton) {
            handle_event_toggle_click({ currentTarget: eventWatchButton });
            return;
        }

        const startListTrigger = target.closest('.event-start-list-trigger');

        if (startListTrigger) {
            handle_start_list_trigger_click({ currentTarget: startListTrigger });
        }
    });

    accordionElement.addEventListener('show.bs.collapse', (event) => {
        const collapseElement = event.target;

        if (!(collapseElement instanceof Element) || !collapseElement.classList.contains('collapse')) {
            return;
        }

        render_event_rounds(collapseElement.id.replace('event-', ''));
    });

    accordionElement.addEventListener('hidden.bs.collapse', (event) => {
        const collapseElement = event.target;

        if (!(collapseElement instanceof Element) || !collapseElement.classList.contains('collapse')) {
            return;
        }

        handle_event_panel_hidden(collapseElement, accordionElement);
    });

    if (nextEventElement) {
        nextEventElement.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;

            if (!target) {
                return;
            }

            const streamTrigger = target.closest('.js-round-stream');

            if (streamTrigger) {
                handle_round_stream_click({
                    currentTarget: streamTrigger,
                    preventDefault: () => event.preventDefault(),
                });
                return;
            }

            const startListTrigger = target.closest('.event-start-list-trigger');

            if (startListTrigger) {
                handle_start_list_trigger_click({ currentTarget: startListTrigger });
            }
        });
    }
};

const setup_layout_handlers = () => {
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            schedule_fit_mobile_hero_title();
            schedule_fit_modal_titles();
            schedule_next_event_mobile_countdown_height_sync();
        });
    }

    addEventListener('resize', () => {
        schedule_fit_mobile_hero_title();
        schedule_next_event_mobile_countdown_height_sync();
    });
};

const setup_filter_handlers = () => {
    const videoModal = document.getElementById('video-modal');
    const eventNotStartedModal = document.getElementById('event-not-started-modal');
    const saveFiltersButton = document.getElementById('save-filters');
    const youtubeVideo = document.getElementById('youtube-video');

    if (videoModal) {
        videoModal.addEventListener('hide.bs.modal', () => {
            if (youtubeVideo) {
                youtubeVideo.setAttribute('src', 'about:blank');
            }
        });
    }

    if (eventNotStartedModal) {
        eventNotStartedModal.addEventListener('hide.bs.modal', () => {
            stop_event_not_started_countdown();
        });
    }

    if (saveFiltersButton) {
        saveFiltersButton.addEventListener('click', () => {
            config = load_config_from_modal();
            refresh();
            window.localStorage.setItem('config', JSON.stringify(config));
        });
    }

    document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => refresh());
    });
};

const setup_tracking_pixel = () => {
    if (document.location.hostname !== 'ifsc.stream') {
        return;
    }

    const normalize = (referrer) => encodeURIComponent(referrer.replace('https://', '').replace(/\/$/, ''));
    const img = new Image();
    img.src = 'https://calendar.ifsc.stream/pixel.gif' + (document.referrer ? `?r=${normalize(document.referrer)}` : '');
    img.width = 1;
    img.height = 1;
    img.alt = 'pixel';

    document.body.appendChild(img);
};

const setup_season_picker_click_target = () => {
    const seasonLabel = document.querySelector('.season-label');
    const seasonSelect = document.querySelector(SEASON_SELECTOR);

    if (!seasonLabel || !seasonSelect) {
        return;
    }

    seasonLabel.addEventListener('click', (event) => {
        event.preventDefault();
        seasonSelect.focus();

        if (typeof seasonSelect.showPicker === 'function') {
            seasonSelect.showPicker();
            return;
        }

        seasonSelect.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window,
        }));
    });
};
