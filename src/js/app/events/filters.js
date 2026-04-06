const sync_filter_button_ui = (name, isChecked) => {
    const filterButton = document.querySelector(`[data-filter-name="${name}"]`);
    if (filterButton) {
        filterButton.classList.toggle('active', isChecked);
    }
};
