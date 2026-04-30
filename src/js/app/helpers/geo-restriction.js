/**
 * Geo-restriction detection using timezone → country mapping.
 *
 * Uses the browser's IANA timezone to infer the user's likely country
 * (ISO 3166-1 alpha-2). This is a best-effort heuristic — timezones
 * can span multiple countries, and users may be traveling. It requires
 * zero external dependencies and no network requests.
 */

// Mapping of ISO 3166-1 alpha-2 country codes to human-readable country names.
// Covers all regions found in stream_blocked_regions across event data.
const COUNTRY_CODE_TO_NAME = {
    'AD': 'Andorra',
    'AL': 'Albania',
    'AM': 'Armenia',
    'AT': 'Austria',
    'AZ': 'Azerbaijan',
    'BA': 'Bosnia and Herzegovina',
    'BE': 'Belgium',
    'BG': 'Bulgaria',
    'BR': 'Brazil',
    'BY': 'Belarus',
    'CH': 'Switzerland',
    'CY': 'Cyprus',
    'CZ': 'Czech Republic',
    'DE': 'Germany',
    'DK': 'Denmark',
    'EE': 'Estonia',
    'ES': 'Spain',
    'FI': 'Finland',
    'FR': 'France',
    'GB': 'United Kingdom',
    'GE': 'Georgia',
    'GR': 'Greece',
    'HR': 'Croatia',
    'HU': 'Hungary',
    'ID': 'Indonesia',
    'IE': 'Ireland',
    'IL': 'Israel',
    'IS': 'Iceland',
    'IT': 'Italy',
    'KG': 'Kyrgyzstan',
    'KZ': 'Kazakhstan',
    'LI': 'Liechtenstein',
    'LT': 'Lithuania',
    'LU': 'Luxembourg',
    'LV': 'Latvia',
    'MC': 'Monaco',
    'MD': 'Moldova',
    'ME': 'Montenegro',
    'MK': 'North Macedonia',
    'MT': 'Malta',
    'MX': 'Mexico',
    'NL': 'Netherlands',
    'NO': 'Norway',
    'PL': 'Poland',
    'PT': 'Portugal',
    'RO': 'Romania',
    'RS': 'Serbia',
    'RU': 'Russia',
    'SE': 'Sweden',
    'SI': 'Slovenia',
    'SK': 'Slovakia',
    'SM': 'San Marino',
    'TJ': 'Tajikistan',
    'TM': 'Turkmenistan',
    'TR': 'Turkey',
    'UA': 'Ukraine',
    'UZ': 'Uzbekistan',
    'VA': 'Vatican City',
};

/**
 * Returns the human-readable country name for a given ISO country code.
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code.
 * @returns {string|null} Country name, or null if unknown.
 */
function country_code_to_name(countryCode) {
    return COUNTRY_CODE_TO_NAME[countryCode] || null;
}

// Mapping of IANA timezone identifiers to ISO 3166-1 alpha-2 country codes.
// Covers all timezones relevant to the blocked regions found in event data.
const TZ_TO_COUNTRY = {
    // Europe
    'Europe/Andorra': 'AD',
    'Europe/Tirane': 'AL',
    'Europe/Vienna': 'AT',
    'Europe/Brussels': 'BE',
    'Europe/Sofia': 'BG',
    'Europe/Minsk': 'BY',
    'Europe/Zurich': 'CH',
    'Europe/Nicosia': 'CY',
    'Europe/Prague': 'CZ',
    'Europe/Berlin': 'DE',
    'Europe/Copenhagen': 'DK',
    'Europe/Tallinn': 'EE',
    'Europe/Madrid': 'ES',
    'Europe/Helsinki': 'FI',
    'Europe/Paris': 'FR',
    'Europe/London': 'GB',
    'Europe/Tbilisi': 'GE',
    'Europe/Athens': 'GR',
    'Europe/Zagreb': 'HR',
    'Europe/Budapest': 'HU',
    'Europe/Dublin': 'IE',
    'Europe/Reykjavik': 'IS',
    'Europe/Rome': 'IT',
    'Europe/Vilnius': 'LT',
    'Europe/Luxembourg': 'LU',
    'Europe/Riga': 'LV',
    'Europe/Chisinau': 'MD',
    'Europe/Podgorica': 'ME',
    'Europe/Skopje': 'MK',
    'Europe/Malta': 'MT',
    'Europe/Amsterdam': 'NL',
    'Europe/Oslo': 'NO',
    'Europe/Warsaw': 'PL',
    'Europe/Lisbon': 'PT',
    'Europe/Bucharest': 'RO',
    'Europe/Belgrade': 'RS',
    'Europe/Stockholm': 'SE',
    'Europe/Ljubljana': 'SI',
    'Europe/Bratislava': 'SK',
    'Europe/San_Marino': 'SM',
    'Europe/Istanbul': 'TR',
    'Europe/Kyiv': 'UA',
    'Europe/Vatican': 'VA',
    'Europe/Monaco': 'MC',
    'Europe/Vaduz': 'LI',
    'Europe/Sarajevo': 'BA',
    // Russia (multiple timezones)
    'Europe/Moscow': 'RU',
    'Europe/Kaliningrad': 'RU',
    'Europe/Volgograd': 'RU',
    'Europe/Kirov': 'RU',
    'Europe/Astrakhan': 'RU',
    'Europe/Samara': 'RU',
    'Europe/Ulyanovsk': 'RU',
    'Europe/Saratov': 'RU',
    'Asia/Yekaterinburg': 'RU',
    'Asia/Omsk': 'RU',
    'Asia/Barnaul': 'RU',
    'Asia/Novosibirsk': 'RU',
    'Asia/Tomsk': 'RU',
    'Asia/Krasnoyarsk': 'RU',
    'Asia/Irkutsk': 'RU',
    'Asia/Chita': 'RU',
    'Asia/Yakutsk': 'RU',
    'Asia/Vladivostok': 'RU',
    'Asia/Khandyga': 'RU',
    'Asia/Sakhalin': 'RU',
    'Asia/Ust-Nera': 'RU',
    'Asia/Magadan': 'RU',
    'Asia/Srednekolymsk': 'RU',
    'Asia/Kamchatka': 'RU',
    'Asia/Anadyr': 'RU',
    // Caucasus & Central Asia
    'Asia/Baku': 'AZ',
    'Asia/Yerevan': 'AM',
    'Asia/Almaty': 'KZ',
    'Asia/Aqtobe': 'KZ',
    'Asia/Aqtau': 'KZ',
    'Asia/Atyrau': 'KZ',
    'Asia/Oral': 'KZ',
    'Asia/Qyzylorda': 'KZ',
    'Asia/Qostanay': 'KZ',
    'Asia/Bishkek': 'KG',
    'Asia/Dushanbe': 'TJ',
    'Asia/Ashgabat': 'TM',
    'Asia/Tashkent': 'UZ',
    'Asia/Samarkand': 'UZ',
    // Asia-Pacific
    'Asia/Jakarta': 'ID',
    'Asia/Makassar': 'ID',
    'Asia/Jayapura': 'ID',
    'Asia/Pontianak': 'ID',
    'Asia/Seoul': 'KR',
    'Asia/Taipei': 'TW',
    'Asia/Jerusalem': 'IL',
    // Americas
    'America/Sao_Paulo': 'BR',
    'America/Recife': 'BR',
    'America/Fortaleza': 'BR',
    'America/Manaus': 'BR',
    'America/Cuiaba': 'BR',
    'America/Campo_Grande': 'BR',
    'America/Belem': 'BR',
    'America/Boa_Vista': 'BR',
    'America/Eirunepe': 'BR',
    'America/Porto_Velho': 'BR',
    'America/Rio_Branco': 'BR',
    'America/Santarem': 'BR',
    'America/Araguaina': 'BR',
    'America/Bahia': 'BR',
    'America/Maceio': 'BR',
    'America/Noronha': 'BR',
    'America/Mexico_City': 'MX',
    'America/Cancun': 'MX',
    'America/Merida': 'MX',
    'America/Monterrey': 'MX',
    'America/Chihuahua': 'MX',
    'America/Hermosillo': 'MX',
    'America/Mazatlan': 'MX',
    'America/Tijuana': 'MX',
    'America/Ojinaga': 'MX',
    'America/Bahia_Banderas': 'MX',
};

/**
 * Returns the user's likely country code based on their browser timezone.
 * @returns {string|null} ISO 3166-1 alpha-2 country code, or null if unknown.
 */
function detect_user_country() {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && TZ_TO_COUNTRY[tz]) {
            return TZ_TO_COUNTRY[tz];
        }
    } catch (_) {
        // Intl may not be available in all environments
    }
    return null;
}

/**
 * Checks if the user's detected country is in the blocked regions list.
 * @param {string[]} blockedRegions - Array of ISO country codes that are blocked.
 * @returns {boolean} True if the user is likely in a blocked region.
 */
function is_user_region_blocked(blockedRegions) {
    if (!Array.isArray(blockedRegions) || blockedRegions.length === 0) {
        return false;
    }
    const userCountry = detect_user_country();
    if (!userCountry) {
        return false;
    }
    return blockedRegions.includes(userCountry);
}

/**
 * Opens the geo-restriction info modal, setting the country name dynamically.
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code of the user.
 */
function open_geo_restriction_modal(countryCode) {
    const modal = document.getElementById('geo-restriction-modal');
    if (!modal) {
        return;
    }

    const name = country_code_to_name(countryCode) || countryCode;

    const countryNameEl = document.getElementById('geo-restriction-country-name');
    if (countryNameEl) {
        countryNameEl.textContent = name;
    }

    const titleEl = document.getElementById('geo-restriction-modal-title');
    if (titleEl) {
        titleEl.textContent = 'Stream Blocked in ' + name;
    }

    open_modal(modal);
}

/**
 * Applies geo-restriction warnings to all round cards on the page.
 * Reads the `data-round-blocked-regions` attribute from each round element.
 */
function apply_geo_restriction_warnings() {
    const userCountry = detect_user_country();
    if (!userCountry) {
        return;
    }

    document.querySelectorAll('.event-round-card[data-round-blocked-regions]').forEach((roundElement) => {
        const raw = roundElement.dataset.roundBlockedRegions || '';
        if (!raw) {
            return;
        }

        const blockedRegions = raw.split(',').map((code) => code.trim()).filter(Boolean);
        if (blockedRegions.length === 0) {
            return;
        }

        if (!blockedRegions.includes(userCountry)) {
            return;
        }

        // Add a geo-restriction warning badge next to the watch button area
        const roundActions = roundElement.querySelector('.round-actions');
        if (!roundActions) {
            return;
        }

        // Avoid duplicating the badge
        if (roundActions.querySelector('.geo-restriction-badge')) {
            return;
        }

        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'geo-restriction-badge text-[10px] text-tertiary font-bold flex items-center gap-1 px-2 py-1 rounded-lg bg-tertiary/10 border border-tertiary/30 whitespace-nowrap hover:bg-tertiary/20 hover:border-tertiary/50 transition-colors';
        badge.title = 'This stream may be geo-restricted in your region. A VPN may be needed to watch.';
        badge.innerHTML = '<span class="material-symbols-outlined text-[14px]" aria-hidden="true">travel_explore</span> VPN needed';
        badge.addEventListener('click', function (e) {
            e.stopPropagation();
            open_geo_restriction_modal(userCountry);
        });

        // Insert the badge before the watch button, or append to round-actions
        const watchButton = roundActions.querySelector('.round-stream-button');
        if (watchButton) {
            roundActions.insertBefore(badge, watchButton);
        } else {
            roundActions.appendChild(badge);
        }
    });
}
