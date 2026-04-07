(() => {
   // restore_theme();
    restore_config();
    schedule_fit_mobile_hero_title();
    schedule_fit_event_name_titles();
   // setup_season_header_toggle();
    setup_accordion_handlers();
    setup_layout_handlers();
    setup_tooltips();
    setup_theme_handlers();
    setup_season_navigation();
    setup_modal_layout_handlers();
    setup_modal_handlers();
    set_local_timezone_message();
    start_periodic_event_status_refresh();

    if (is_event_page()) {
        refresh_event_page_ui();
    } else {
        refresh_event_ui();
        setup_lazy_filter_modal();
        setup_season_picker_click_target();
        setup_month_navigation();
    }

    if (document.readyState === 'complete') {
        load_season_structured_data();
    } else {
        window.addEventListener('load', () => {
            load_season_structured_data();
        }, { once: true });
    }
})();
