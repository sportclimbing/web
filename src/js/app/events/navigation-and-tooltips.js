const STATIC_TOOLTIP_SELECTOR = '.calendar-sync-tooltip, .footer-action-tooltip, .event-schedule-status-tooltip';

const get_bootstrap_tooltip = (element) => {
    if (!element || !window.bootstrap || !window.bootstrap.Tooltip) {
        return null;
    }

    return window.bootstrap.Tooltip.getInstance(element);
};

const setup_tooltip_instance = (element, options) => {
    if (!element || !window.bootstrap || !window.bootstrap.Tooltip) {
        return null;
    }

    return window.bootstrap.Tooltip.getOrCreateInstance(element, options);
};

const setup_tooltips = () => {
    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;

        if (!target) {
            return;
        }

        const reminderButton = target.closest('.button-reminder');

        if (reminderButton) {
            reminderButton.blur();
        }

        const tooltipTrigger = target.closest(STATIC_TOOLTIP_SELECTOR);

        if (!tooltipTrigger) {
            return;
        }

        const tooltip = get_bootstrap_tooltip(tooltipTrigger);

        if (tooltip) {
            tooltip.hide();
        }

        tooltipTrigger.blur();
    });

    if (is_mobile_viewport()) {
        return;
    }

    const tooltipOptions = {
        container: 'body',
        placement: 'bottom',
        trigger: 'hover',
        template: TOOLTIP_TEMPLATE,
    };

    const scheduleStatusTooltipOptions = {
        container: 'body',
        placement: 'bottom',
        trigger: 'hover',
        template: AVATAR_TOOLTIP_TEMPLATE,
    };

    document.querySelectorAll(STATIC_TOOLTIP_SELECTOR).forEach((element) => {
        const options = element.classList.contains('event-schedule-status-tooltip')
            ? scheduleStatusTooltipOptions
            : tooltipOptions;
        setup_tooltip_instance(element, options);
    });
};

const setup_start_list_avatar_tooltips = () => {
    document.querySelectorAll('.event-start-list-trigger img').forEach((element) => {
        const tooltip = get_bootstrap_tooltip(element);

        if (tooltip) {
            tooltip.dispose();
        }
    });

    if (is_mobile_viewport()) {
        return;
    }

    const tooltipOptions = {
        container: 'body',
        placement: 'bottom',
        trigger: 'hover',
        template: AVATAR_TOOLTIP_TEMPLATE,
    };

    document.querySelectorAll('.event-start-list-trigger img').forEach((element) => {
        if (!element.title && element.alt) {
            element.title = element.alt;
        }

        setup_tooltip_instance(element, tooltipOptions);
    });
};

const setup_season_navigation = () => {
    const seasonSelector = document.querySelector(SEASON_SELECTOR);

    if (!seasonSelector) {
        return;
    }

    seasonSelector.addEventListener('change', (event) => {
        const season = event.target.value;

        window.location = `/season/${season}`;
    });
};

const scroll_to_first_event_starting_in_month = (monthIndex) => {
    const firstEventInMonth = document.querySelector(`#accordion .ifsc-league-card[data-event-start-month="${monthIndex}"]:not([hidden])`);

    if (!firstEventInMonth) {
        return;
    }

    const header = document.querySelector('nav.sticky');
    const headerHeight = header ? header.offsetHeight : 0;
    const top = firstEventInMonth.getBoundingClientRect().top + window.scrollY - headerHeight;

    window.scrollTo({ top, behavior: 'smooth' });
};

const get_month_index_from_dataset_value = (monthIndexValue) => {
    if (monthIndexValue === undefined) {
        return null;
    }

    const monthIndex = parseInt(monthIndexValue, 10);

    if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
        return null;
    }

    return monthIndex;
};

const set_active_month_navigation_link = (monthIndex) => {
    const monthNav = document.getElementById('season-month-nav');
    const activeMonthIndex = monthIndex === null ? null : String(monthIndex);

    if (!monthNav) {
        return;
    }

    monthNav.querySelectorAll('.season-month-nav-link[data-month-index]').forEach((button) => {
        const isActive = activeMonthIndex !== null && button.dataset.monthIndex === activeMonthIndex;
        button.classList.toggle('is-active', isActive);

        if (isActive) {
            button.setAttribute('aria-current', 'true');
            return;
        }

        button.removeAttribute('aria-current');
    });
};

const get_active_month_index_from_visible_events = () => {
    const cards = Array.from(document.querySelectorAll('#accordion .ifsc-league-card[data-event-start-month]:not([hidden])'));

    if (cards.length === 0) {
        return null;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    // Lower the reference line a bit more to catch the card that's clearly "in focus"
    const referenceLine = Math.min(Math.max(Math.round(viewportHeight * 0.3), 100), 300);

    // 1. Find the first card that spans across the reference line
    for (const card of cards) {
        const rect = card.getBoundingClientRect();

        if (rect.top <= referenceLine && rect.bottom > referenceLine) {
            return get_month_index_from_dataset_value(card.dataset.eventStartMonth);
        }
    }

    // 2. If no card spans the reference line, find the first card that's fully below the reference line
    for (const card of cards) {
        const rect = card.getBoundingClientRect();

        if (rect.top > referenceLine && rect.top < viewportHeight) {
            return get_month_index_from_dataset_value(card.dataset.eventStartMonth);
        }
    }

    // 3. Fallback to any visible card
    for (const card of cards) {
        const rect = card.getBoundingClientRect();

        if (rect.top < viewportHeight && rect.bottom > 0) {
            return get_month_index_from_dataset_value(card.dataset.eventStartMonth);
        }
    }

    const lastCard = cards[cards.length - 1];

    if (lastCard.getBoundingClientRect().bottom <= referenceLine) {
        return get_month_index_from_dataset_value(lastCard.dataset.eventStartMonth);
    }

    return null;
};

const sync_active_month_navigation_link = () => {
    set_active_month_navigation_link(get_active_month_index_from_visible_events());
};

const schedule_month_navigation_sync = () => {
    if (monthNavigationFrameId !== null) {
        return;
    }

    monthNavigationFrameId = window.requestAnimationFrame(() => {
        monthNavigationFrameId = null;
        sync_active_month_navigation_link();
    });
};

const sync_month_nav_horizontal_position = () => {
    const monthNav = document.getElementById('season-month-nav');
    const mainContent = document.querySelector('main[role="main"]');

    if (!monthNav || !mainContent) {
        return;
    }

    if (!window.matchMedia('(min-width: 1040px)').matches) {
        monthNav.style.removeProperty(MONTH_NAV_LEFT_CSS_VAR);
        return;
    }

    const navWidth = monthNav.getBoundingClientRect().width || 132;
    const desiredGap = 32;
    const mainLeft = mainContent.getBoundingClientRect().left;
    const monthNavLeft = Math.max(8, Math.round(mainLeft - navWidth - desiredGap));

    monthNav.style.setProperty(MONTH_NAV_LEFT_CSS_VAR, `${monthNavLeft}px`);
};

const schedule_month_nav_horizontal_position_sync = () => {
    if (monthNavHorizontalFrameId !== null) {
        return;
    }

    monthNavHorizontalFrameId = window.requestAnimationFrame(() => {
        monthNavHorizontalFrameId = null;
        sync_month_nav_horizontal_position();
    });
};

const update_month_navigation_state = () => {
    const monthNav = document.getElementById('season-month-nav');

    if (!monthNav) {
        return;
    }

    const monthsWithEvents = new Set(
        Array.from(document.querySelectorAll('#accordion .ifsc-league-card[data-event-start-month]:not([hidden])'))
            .map((card) => card.dataset.eventStartMonth)
            .filter((monthIndex) => monthIndex !== undefined)
    );

    const activeMonthIndex = get_active_month_index_from_visible_events();

    monthNav.querySelectorAll('.season-month-nav-link[data-month-index]').forEach((button) => {
        const hasEvents = monthsWithEvents.has(button.dataset.monthIndex);
        button.classList.toggle('is-empty', !hasEvents);
        button.setAttribute('aria-disabled', hasEvents ? 'false' : 'true');
    });

    set_active_month_navigation_link(activeMonthIndex);
};

const setup_month_navigation = () => {
    const monthNav = document.getElementById('season-month-nav');

    if (!monthNav) {
        return;
    }

    monthNav.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;

        if (!target) {
            return;
        }

        const trigger = target.closest('[data-month-index]');

        if (!trigger) {
            return;
        }

        const monthIndex = parseInt(trigger.dataset.monthIndex, 10);

        if (Number.isNaN(monthIndex)) {
            return;
        }

        event.preventDefault();
        scroll_to_first_event_starting_in_month(monthIndex);
    });

    addEventListener('scroll', schedule_month_navigation_sync, { passive: true });
    addEventListener('resize', schedule_month_navigation_sync);
    sync_active_month_navigation_link();
};
