import { athlete_photo_local_sources_build, athlete_id_from_photo_url_build } from './shared/media.js';
import { START_LIST_OVERFLOW_THRESHOLD } from './config.js';

const escape_html = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');


const normalize_athlete_name = (name)  => {
  return name.replace(/\S+/gu, (word) => word.toLocaleLowerCase().replace(/^\p{L}/u, (c) => c.toLocaleUpperCase()));
};

export const athlete_name_build = (athlete) => {
  const firstName = athlete.first_name;
  const rawLastName = athlete.last_name;
  const lastName = normalize_athlete_name(rawLastName);

  return `${firstName} ${lastName}`.trim();
};

const athlete_initials_build = (athlete) => {
  return `${athlete.first_name[0]}${athlete.last_name[0]}`;
};

const build_full_start_list_link = (eventId) => {
  if (!eventId) {
    return '';
  }

  return `
            <li class="mt-4">
                <a class="w-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface px-6 py-4 rounded-xl font-headline font-bold text-xs tracking-widest transition-all border border-outline-variant/20 flex items-center justify-center gap-3 group" href="${escape_html(`https://ifsc.results.info/event/${encodeURIComponent(String(eventId))}/registrations`)}" target="_blank" rel="noopener">
                    VIEW FULL START LIST ON IFSC
                    <span class="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                </a>
            </li>
        `;
};

export const build_start_list_modal_list_html = (startListInput, eventId = '', startListTotal = null) => {
  const startList = Array.isArray(startListInput) ? startListInput : [];
  const fullStartListLink = build_full_start_list_link(eventId);

  if (!startList.length) {
    return `<li class="p-8 text-center text-on-surface-variant font-medium bg-surface-container-low/20 rounded-xl border border-dashed border-outline-variant/30">Start list pending.</li>${fullStartListLink}`;
  }

  const total = typeof startListTotal === 'number' ? startListTotal : startList.length;
  const hasOverflow = total > START_LIST_OVERFLOW_THRESHOLD;
  const mainList = hasOverflow ? startList.slice(0, -2) : startList;
  const extraAthletes = hasOverflow ? startList.slice(-2) : [];

  const athletes = mainList.map((athlete) => {
    const athleteName = escape_html(athlete_name_build(athlete));
    const country = escape_html(athlete?.country || '');
    const photoSources = athlete_photo_local_sources_build(athlete);
    const photo = photoSources
      ? `<img class="w-full h-full object-cover rounded-full border-2 border-primary/20 group-hover:border-primary/50 transition-colors" src="${escape_html(photoSources.src)}" width="56" height="56" alt="${athleteName}" loading="lazy" referrerpolicy="no-referrer"${photoSources.fallbackSrc ? ` data-fallback-src="${escape_html(photoSources.fallbackSrc)}" onerror="handle_start_list_photo_error(this)"` : ''} />`
      : `<div class="w-full h-full rounded-full border-2 border-primary/20 group-hover:border-primary/50 transition-colors bg-surface-container-high flex items-center justify-center text-on-surface-variant font-bold" aria-hidden="true">${escape_html(athlete_initials_build(athlete))}</div>`;

    let athleteId = athlete?.athlete_id;

    if (athleteId === undefined || athleteId === null || athleteId === '') {
      athleteId = athlete_id_from_photo_url_build(athlete?.photo_url);
    }

    const hasAthleteId = athleteId !== undefined && athleteId !== null && athleteId !== '';
    const instagram = athlete?.instagram;
    const hasInstagram = instagram !== undefined && instagram !== null && instagram !== '';
    const instagramLink = hasInstagram
      ? `<a class="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-bright transition-colors" href="${escape_html(`https://www.instagram.com/${encodeURIComponent(String(instagram))}/`)}" target="_blank" rel="noopener">
            <svg class="w-[18px] h-[18px] text-on-surface-variant fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </a>`
      : '';
    const athleteProfile = hasAthleteId || hasInstagram
      ? `<div class="flex items-center gap-3">
          ${instagramLink}
          ${hasAthleteId ? `<button class="bg-primary-container text-on-primary-fixed px-4 py-2 rounded-lg font-headline font-bold text-xs tracking-tight hover:brightness-110 active:scale-95 transition-all" onclick="window.open('${escape_html(`https://ifsc.results.info/athlete/${encodeURIComponent(String(athleteId))}`)}', '_blank')"><span class="hidden lg:inline">IFSC </span>PROFILE</button>` : ''}
        </div>`
      : '';

    return `
            <li class="flex items-center justify-between px-2 py-4 lg:px-4 bg-surface-container hover:bg-surface-container-high transition-all duration-200 rounded-lg group start-list-athlete">
                <div class="flex items-center gap-3 lg:gap-4 min-w-0">
                    <div class="relative w-11 h-11 lg:w-14 lg:h-14 shrink-0">
                        ${photo}
                    </div>
                    <div class="flex flex-col min-w-0 pr-3">
                        <span class="text-on-surface font-headline font-bold tracking-tight text-sm lg:text-lg leading-tight truncate">${athleteName}</span>
                        <div class="flex items-center gap-1.5 mt-1">
                            <span class="material-symbols-outlined text-[16px] text-on-surface-variant">flag</span>
                            <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${country}</span>
                        </div>
                    </div>
                </div>
                ${athleteProfile}
            </li>
        `;
  }).join('');

  const moreAthletesSection = extraAthletes.length > 0
    ? (() => {
        const avatars = extraAthletes.map((athlete) => {
          const athleteName = escape_html(athlete_name_build(athlete));
          const photoSources = athlete_photo_local_sources_build(athlete);
          return photoSources
            ? `<img class="w-10 h-10 rounded-full border-2 border-primary/20 object-cover" src="${escape_html(photoSources.src)}" width="40" height="40" alt="${athleteName}" loading="lazy" referrerpolicy="no-referrer"${photoSources.fallbackSrc ? ` data-fallback-src="${escape_html(photoSources.fallbackSrc)}" onerror="handle_start_list_photo_error(this)"` : ''} />`
            : `<div class="w-10 h-10 rounded-full border-2 border-primary/20 bg-surface-container-high flex items-center justify-center text-on-surface-variant font-bold text-xs" aria-hidden="true">${escape_html(athlete_initials_build(athlete))}</div>`;
        }).join('');
        return `<li class="start-list-overflow-athletes hidden">
            <div class="flex -space-x-2">${avatars}</div>
        </li>`;
      })()
    : '';

  return `${athletes}${moreAthletesSection}${fullStartListLink}`;
};

export const build_start_list_modal_fragment = ({ eventName, startList, eventId, startListTotal = null }) => {
  const normalizedEventName = String(eventName || '').trim();
  const listHtml = build_start_list_modal_list_html(startList, eventId, startListTotal);

  return `<section class="start-list-modal-fragment"><span class="start-list-modal-fragment-event">${escape_html(normalizedEventName)}</span><h4 class="start-list-modal-fragment-title">ATHLETES ATTENDING</h4><ul class="start-list-modal-fragment-list">${listHtml}</ul></section>`;
};

export const build_start_list_modal_url = (season, eventId, version = '') => {
  const normalizedSeason = encodeURIComponent(String(season || '').trim());
  const normalizedEventId = encodeURIComponent(String(eventId || '').trim());

  if (!normalizedSeason || !normalizedEventId) {
    return '';
  }

  const normalizedVersion = String(version || '').trim();
  const query = normalizedVersion ? `?v=${encodeURIComponent(normalizedVersion)}` : '';

  return `/modals/start-list/${normalizedSeason}/${normalizedEventId}.html${query}`;
};
