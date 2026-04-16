(function () {
  var tabBtns = document.querySelectorAll('[data-tab-btn]');
  if (!tabBtns.length) return;

  var tabPanels = document.querySelectorAll('[data-tab-panel]');
  var mapInitialized = false;

  var ACTIVE = ['bg-primary', 'text-on-primary'];
  var INACTIVE = ['text-on-surface-variant'];

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.dataset.tabBtn;
      tabBtns.forEach(function (b) {
        var active = b.dataset.tabBtn === target;
        ACTIVE.forEach(function (c) { b.classList.toggle(c, active); });
        INACTIVE.forEach(function (c) { b.classList.toggle(c, !active); });
      });
      tabPanels.forEach(function (p) {
        p.classList.toggle('hidden', p.dataset.tabPanel !== target);
      });
      if (target === 'map' && !mapInitialized) {
        mapInitialized = true;
        initMap();
      }
    });
  });

  function initMap() {
    var mapEl = document.getElementById('event-map');
    if (!mapEl) return;
    fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(mapEl.dataset.query) + '&format=json&limit=1', {
      headers: { 'Accept-Language': 'en' }
    })
      .then(function (r) { return r.json(); })
      .then(function (results) {
        if (!results || !results.length) return;
        var lat = parseFloat(results[0].lat);
        var lon = parseFloat(results[0].lon);
        var bbox = results[0].boundingbox;
        var map = L.map(mapEl, { scrollWheelZoom: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19
        }).addTo(map);
        map.fitBounds([[bbox[0], bbox[2]], [bbox[1], bbox[3]]], { maxZoom: 16 });
        L.marker([lat, lon]).addTo(map);
      })
      .catch(function () {});
  }
})();
