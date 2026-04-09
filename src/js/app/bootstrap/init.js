(() => {
    restore_config();
    setup_accordion_handlers();
    setup_tooltips();
    setup_season_navigation();
    setup_modal_handlers();
    start_periodic_event_status_refresh();

    if (is_event_page()) {
        refresh_event_page_ui();
    } else {
        refresh_event_ui();
        setup_lazy_filter_modal();
        setup_discipline_quick_filters();
        setup_season_picker_click_target();
        setup_month_navigation();
        setup_sticky_event_title();
    }

    if (document.readyState === 'complete') {
        load_season_structured_data();
    } else {
        window.addEventListener('load', () => {
            load_season_structured_data();
        }, { once: true });
    }
})();
