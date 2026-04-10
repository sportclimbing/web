(function () {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        event: 'default_consent',
        analytics_storage: 'denied',
        security_storage: 'granted'
    });

    const STORAGE_KEY = 'cookie_analytics_consent';
    const banner = document.getElementById('cookie-consent');
    const acceptBtn = document.getElementById('cookie-accept');
    const rejectBtn = document.getElementById('cookie-reject');
    const openSettingsBtn = document.getElementById('open-cookie-settings');

    const storedConsent = readConsent();

    loadTagManager();

    if (storedConsent === 'granted') {
        updateConsent('granted');
    } else if (storedConsent === 'denied') {
        updateConsent('denied');
    } else {
        showBanner();
    }

    acceptBtn.addEventListener('click', function () {
        saveConsent('granted');
        updateConsent('granted');
        hideBanner();
    });

    rejectBtn.addEventListener('click', function () {
        saveConsent('denied');
        updateConsent('denied');
        hideBanner();
    });

    openSettingsBtn.addEventListener('click', function () {
        showBanner();
    });

    function showBanner() {
        banner.style.removeProperty('display');
    }

    function hideBanner() {
        banner.style.display = 'none';
    }

    function saveConsent(value) {
        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch (e) {}
    }

    function readConsent() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function updateConsent(analyticsValue) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: 'consent_update',
            analytics_storage: analyticsValue,
            security_storage: 'granted'
        });
    }

    function loadTagManager() {
        (function(w,d,s,l,i){
            w[l]=w[l]||[];
            w[l].push({
                'gtm.start': new Date().getTime(),
                event: 'gtm.js'
            });
            var f = d.getElementsByTagName(s)[0],
                j = d.createElement(s),
                dl = l !== 'dataLayer' ? '&l=' + l : '';
            j.async = true;
            j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
            f.parentNode.insertBefore(j, f);
        })(window, document, 'script', 'dataLayer', 'GTM-W529GT79');
    }
})();
