(function () {
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}

    gtag('consent', 'default', {
        analytics_storage: 'denied',
        security_storage: 'granted'
    });

    const STORAGE_KEY = 'cookie_analytics_consent';
    const banner = document.getElementById('cookie-consent');
    const acceptBtn = document.getElementById('cookie-accept');
    const rejectBtn = document.getElementById('cookie-reject');
    const openSettingsBtn = document.getElementById('open-cookie-settings');

    const storedConsent = readConsent();

    if (storedConsent === 'granted') {
        loadGtag();
    } else if (storedConsent === 'denied') {
        // do nothing — never load gtag without consent
    } else {
        showBanner();
    }

    acceptBtn.addEventListener('click', function () {
        saveConsent('granted');
        updateConsent('granted');
        loadGtag();
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
        gtag('consent', 'update', {
            analytics_storage: analyticsValue,
            security_storage: 'granted'
        });
    }

    function loadGtag() {
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=G-8M4HP3B344';
        document.head.appendChild(s);
        gtag('js', new Date());
        gtag('config', 'G-8M4HP3B344');
    }
})();
