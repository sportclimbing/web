let periodicEventStatusIntervalId = null;
let hasAppliedInitialSeasonAutoExpand = false;
let versionCheckInFlight = false;
let hasDetectedVersionChange = false;

const normalize_site_version = (value) => (typeof value === 'string' ? value.trim() : '');

const loadedSiteVersion = (() => {
    if (document.body instanceof HTMLElement) {
        const bodyVersion = normalize_site_version(document.body.dataset.buildVersion || '');

        if (bodyVersion) {
            return bodyVersion;
        }
    }

    const footerBuildElement = document.querySelector('.footer-build-value');

    if (!(footerBuildElement instanceof HTMLElement)) {
        return '';
    }

    return normalize_site_version(footerBuildElement.textContent || '');
})();

const show_version_update_notice = () => {
    const versionUpdateNotice = document.getElementById('version-update-notice');

    if (!(versionUpdateNotice instanceof HTMLElement)) {
        return;
    }

    versionUpdateNotice.hidden = false;

    if (versionUpdateNotice.dataset.reloadHandlerBound === '1') {
        return;
    }

    versionUpdateNotice.dataset.reloadHandlerBound = '1';
    versionUpdateNotice.addEventListener('click', () => {
        window.location.reload();
    }, { once: true });
};

const fetch_current_site_version = async () => {
    const response = await window.fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
    });

    if (!response.ok) {
        return '';
    }

    const payload = await response.json();

    return normalize_site_version(payload && payload.version);
};

const check_for_site_version_update = async () => {
    if (!loadedSiteVersion || hasDetectedVersionChange || versionCheckInFlight) {
        return;
    }

    versionCheckInFlight = true;

    try {
        const currentSiteVersion = await fetch_current_site_version();

        if (!currentSiteVersion || currentSiteVersion === loadedSiteVersion) {
            return;
        }

        hasDetectedVersionChange = true;
        show_version_update_notice();
    } catch (_error) {
        // Ignore transient fetch/network issues.
    } finally {
        versionCheckInFlight = false;
    }
};

const refresh_periodic_event_status = () => {
    const accordion = document.getElementById('accordion');

    if (!accordion) {
        return;
    }

    seasonTimeline = compute_dom_season_timeline();

    if (!refresh_next_event_status()) {
        update_next_event_panel();
    }

    accordion.querySelectorAll('.ifsc-league-card[data-event-id]').forEach((card) => {
        const eventId = card.dataset.eventId || '';

        if (!eventId) {
            return;
        }

        refresh_event_round_statuses(eventId);
    });

    set_favicon(seasonTimeline.liveRound);
};

const run_periodic_refresh_tasks = () => {
    refresh_periodic_event_status();
    void check_for_site_version_update();
};

const stop_periodic_event_status_refresh = () => {
    if (!periodicEventStatusIntervalId) {
        return;
    }

    window.clearInterval(periodicEventStatusIntervalId);
    periodicEventStatusIntervalId = null;
};

const start_periodic_event_status_refresh = () => {
    stop_periodic_event_status_refresh();
    periodicEventStatusIntervalId = window.setInterval(() => {
        run_periodic_refresh_tasks();
    }, 60 * 1000);
};

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
    card.style.display = 'none';
};

const show_event_card = (card) => {
    if (!card) {
        return;
    }

    card.hidden = false;
    card.style.display = '';
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
        const eventId = card.dataset.eventId || '';
        const isVisible = Boolean(eventId && nextVisibleEventIds.has(String(eventId)));

        if (isVisible) {
            show_event_card(card);
            return;
        }

        hide_event_card(card);
    });

    toggle_no_results_message(accordion, visibleRoundCount > 0);
};

const refresh_event_ui = () => {
    const accordion = document.getElementById('accordion');

    if (!accordion) {
        return;
    }

    const filterResult = apply_search_filters();
    visibleEventIds = filterResult.visibleEventIds;
    apply_filtered_event_cards(filterResult, accordion);

    seasonTimeline = compute_dom_season_timeline();
    const nextEvent = seasonTimeline.liveEvent || seasonTimeline.nextEvent || get_next_event_from_visible_rounds();

    if (selectedEvent === null || !visibleEventIds.has(String(selectedEvent))) {
        selectedEvent = nextEvent ? nextEvent.id : null;
    }

    accordion.querySelectorAll('.ifsc-league-card[data-event-id]').forEach((card) => {
        const eventId = card.dataset.eventId || '';

        if (eventId) {
            refresh_event_round_statuses(eventId);
        }
    });

    update_next_event_panel();
    setup_start_list_avatar_tooltips();
    update_month_navigation_state();
    schedule_month_nav_horizontal_position_sync();
    hide_static_event_fallback();

    hasAppliedInitialSeasonAutoExpand = true;

    set_favicon(seasonTimeline.liveRound);
};

const refresh_event_page_ui = () => {
    const accordion = document.getElementById('accordion');

    if (!accordion) {
        return;
    }

    visibleEventIds = new Set();
    accordion.querySelectorAll('.ifsc-league-card[data-event-id]').forEach((card) => {
        const eventId = card.dataset.eventId || '';

        if (!eventId) {
            return;
        }

        visibleEventIds.add(eventId);
        show_event_card(card);
    });

    seasonTimeline = compute_dom_season_timeline();

    accordion.querySelectorAll('.ifsc-league-card[data-event-id]').forEach((card) => {
        const eventId = card.dataset.eventId || '';

        if (eventId) {
            refresh_event_round_statuses(eventId);
        }
    });

    if (!refresh_next_event_status()) {
        update_next_event_panel();
    }

    setup_start_list_avatar_tooltips();
    update_month_navigation_state();
    schedule_month_nav_horizontal_position_sync();
    hide_static_event_fallback();
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

const setup_accordion_handlers = () => {
    const accordionElement = document.getElementById('accordion');

    if (!accordionElement) {
        return;
    }

    accordionElement.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;

        if (!target) {
            return;
        }

        const streamTrigger = target.closest('.youtube-play-button, [data-action="round-stream"]');

        if (streamTrigger) {
            handle_round_stream_click({
                currentTarget: streamTrigger,
                preventDefault: () => event.preventDefault(),
            });
            return;
        }

        const eventWatchButton = target.closest('[data-action="event-watch-toggle"]');

        if (eventWatchButton) {
            handle_event_toggle_click({ currentTarget: eventWatchButton });
            return;
        }

        const startListTrigger = target.closest('.event-start-list-trigger');

        if (startListTrigger) {
            handle_start_list_trigger_click({ currentTarget: startListTrigger });
        }
    });
};

const setup_modal_handlers = () => {
    const videoModal = document.getElementById('video-modal');
    const eventNotStartedModal = document.getElementById('event-not-started-modal');

    if (videoModal) {
        const stopVideoPlayback = () => {
            const youtubeVideo = document.getElementById('youtube-video');

            if (youtubeVideo) {
                youtubeVideo.setAttribute('src', 'about:blank');
            }
        };

        videoModal.addEventListener('hide.bs.modal', stopVideoPlayback);
        videoModal.addEventListener('hidden.bs.modal', stopVideoPlayback);
    }

    if (eventNotStartedModal) {
        eventNotStartedModal.addEventListener('hide.bs.modal', () => {
            stop_event_not_started_countdown();
        });
    }

    // Modal global event listeners
    document.addEventListener('click', (event) => {
        const calendarTrigger = event.target.closest('[data-open-calendar-modal]');
        if (calendarTrigger) {
            event.preventDefault();
            load_lazy_calendar_modal().then(() => open_modal('#calendar-modal'));
            return;
        }

        const trigger = event.target.closest('[data-bs-toggle="modal"]');
        if (trigger) {
            event.preventDefault();
            if (trigger.hasAttribute('data-bs-dismiss')) {
                const currentModal = trigger.closest('.modal');
                close_modal(currentModal);
            }
            const targetSelector = trigger.getAttribute('data-bs-target');
            if (targetSelector === '#calendar-modal') {
                load_lazy_calendar_modal().then(() => open_modal(targetSelector));
                return;
            }
            open_modal(targetSelector);
            return;
        }

        const dismiss = event.target.closest('[data-bs-dismiss="modal"]');
        if (dismiss) {
            event.preventDefault();
            const modal = dismiss.closest('.modal');
            close_modal(modal);
            return;
        }

        // Click outside of the modal content closes the modal
        if (event.target.classList.contains('modal')) {
            close_modal(event.target);
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active, .modal.show');
            if (activeModal) {
                close_modal(activeModal);
            }
        }
    });

    // Sync our state if Bootstrap closes the modal itself (e.g. from its own data-api)
    document.addEventListener('hidden.bs.modal', (event) => {
        const modal = event.target.closest('.modal');
        if (modal) {
            modal.classList.remove('active', 'show');
        }

        // Always check if we should clear modal-open from html/body
        // Use a small timeout to allow Bootstrap to finish its own state cleanup
        window.setTimeout(() => {
            if (!document.querySelector('.modal.active, .modal.show')) {
                document.body.classList.remove('modal-open');
                document.documentElement.classList.remove('modal-open');
                document.body.style.removeProperty('overflow');
                document.body.style.removeProperty('padding-right');
            }
        }, 0);
    });
};

const setup_filter_handlers = () => {
    const saveFiltersButton = document.getElementById('save-filters');
    const resetFiltersButton = document.getElementById('reset-filters');
    const filterModal = document.getElementById('filter-modal');

    if (saveFiltersButton) {
        saveFiltersButton.addEventListener('click', () => {
            config = load_config_from_modal();
            refresh_event_ui();
            window.localStorage.setItem('config', JSON.stringify(config));
            update_filter_badge();
        });
    }

    if (resetFiltersButton) {
        resetFiltersButton.addEventListener('click', () => {
            document.querySelectorAll('#filter-modal input[type="checkbox"]').forEach((checkbox) => {
                set_checkbox_checked(checkbox.name, checkbox.name !== 'streamable' && checkbox.name !== 'league[games]');
            });

            const tzSelector = document.getElementById('timezone-selector');
            if (tzSelector) {
                try {
                    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    if (localTz) {
                        tzSelector.value = localTz;
                        tzSelector.dispatchEvent(new Event('change'));
                    }
                } catch (_) {}
            }
        });
    }

    if (filterModal) {
        filterModal.addEventListener('show.bs.modal', () => {
            document.querySelectorAll('#filter-modal input[type="checkbox"]').forEach((checkbox) => {
                sync_filter_button_ui(checkbox.name, checkbox.checked);
            });
        });
    }

    document.querySelectorAll('#filter-modal input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            sync_filter_button_ui(checkbox.name, checkbox.checked);
        });
    });
};

let calendarModalContentLoaded = false;

const load_lazy_calendar_modal = async () => {
    if (calendarModalContentLoaded) {
        return;
    }

    const calendarModal = document.getElementById('calendar-modal');

    if (!calendarModal) {
        return;
    }

    try {
        const response = await window.fetch('/modals/sync.html');
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const modalDialog = doc.querySelector('.modal-dialog');

        if (modalDialog) {
            calendarModal.innerHTML = modalDialog.outerHTML;
            calendarModalContentLoaded = true;
        }
    } catch (_) {
        // ignore fetch errors
    }
};

window.load_lazy_calendar_modal = load_lazy_calendar_modal;

let filterModalContentLoaded = false;

const setup_lazy_filter_modal = () => {
    const filtersButton = document.querySelector('[data-open-filter-modal]');

    if (!filtersButton) {
        return;
    }

    filtersButton.addEventListener('click', async () => {
        const filterModal = document.getElementById('filter-modal');

        if (!filterModal) {
            return;
        }

        if (window.gtag) {
            gtag('event', 'filters_modal_opened');
        }

        if (filterModalContentLoaded) {
            open_modal('#filter-modal');
            return;
        }

        try {
            const response = await window.fetch('/modals/filters.html');
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const modalDialog = doc.querySelector('.modal-dialog');

            if (modalDialog) {
                filterModal.innerHTML = modalDialog.outerHTML;
                filterModalContentLoaded = true;
                restore_config();
                setup_filter_handlers();
                setup_timezone_selector();
            }
        } catch (_) {
            // ignore fetch errors
        }

        if (filterModalContentLoaded) {
            open_modal('#filter-modal');
        }
    });
};

const setup_discipline_quick_filters = () => {
    const buttons = document.querySelectorAll('.discipline-quick-filter[data-quick-filter]');

    if (!buttons.length) {
        return;
    }

    const update_button_states = (activeFilter) => {
        buttons.forEach((btn) => {
            const isActive = btn.dataset.quickFilter === activeFilter;
            btn.dataset.active = isActive ? 'true' : 'false';
        });
    };

    buttons.forEach((button) => {
        button.dataset.active = 'false';
        button.addEventListener('click', () => {
            const discipline = button.dataset.quickFilter;
            const newFilter = quickDisciplineFilter === discipline ? null : discipline;
            quickDisciplineFilter = newFilter;
            update_button_states(newFilter);
            refresh_event_ui();
        });
    });
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
