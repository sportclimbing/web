(() => {
    restore_theme();
    restore_config();
    schedule_fit_mobile_hero_title();

    refresh();

    setup_season_header_toggle();
    setup_accordion_handlers();
    config = load_config_from_modal();
    setup_layout_handlers();
    setup_filter_handlers();
    setup_season_picker_click_target();
    setup_tooltips();
    setup_theme_handlers();
    setup_season_navigation();
    setup_modal_layout_handlers();
    setup_month_navigation();
    set_local_timezone_message();
    setup_tracking_pixel();

    if (document.readyState === 'complete') {
        load_season_structured_data();
    } else {
        window.addEventListener('load', () => {
            load_season_structured_data();
        }, { once: true });
    }
})();
