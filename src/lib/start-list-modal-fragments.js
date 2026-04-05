import { athlete_photo_local_sources_build, athlete_id_from_photo_url_build } from './shared/media.js';

const escape_html = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const athlete_name_build = (athlete) => {
  const firstName = typeof athlete?.first_name === 'string' ? athlete.first_name : '';
  const lastName = typeof athlete?.last_name === 'string' ? athlete.last_name : '';
  const name = `${firstName} ${lastName}`.trim();

  return name || 'Unknown athlete';
};

const athlete_initials_build = (athlete) => {
  const firstName = typeof athlete?.first_name === 'string' ? athlete.first_name : '';
  const lastName = typeof athlete?.last_name === 'string' ? athlete.last_name : '';

  return `${firstName[0] || ''}${lastName[0] || ''}` || '?';
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

export const build_start_list_modal_list_html = (startListInput, eventId = '') => {
  const startList = Array.isArray(startListInput) ? startListInput : [];
  const fullStartListLink = build_full_start_list_link(eventId);

  if (!startList.length) {
    return `<li class="p-8 text-center text-on-surface-variant font-medium bg-surface-container-low/20 rounded-xl border border-dashed border-outline-variant/30">Start list pending.</li>${fullStartListLink}`;
  }

  const athletes = startList.map((athlete) => {
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
    const athleteProfile = hasAthleteId
      ? `<div class="flex items-center gap-3">
          <a class="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-bright transition-colors" href="${escape_html(`https://ifsc.results.info/athlete/${encodeURIComponent(String(athleteId))}`)}" target="_blank" rel="noopener">
            <span class="material-symbols-outlined text-on-surface-variant text-[20px]">link</span>
          </a>
          <button class="bg-primary-container text-on-primary-fixed px-4 py-2 rounded-lg font-headline font-bold text-xs tracking-tight hover:brightness-110 active:scale-95 transition-all" onclick="window.open('${escape_html(`https://ifsc.results.info/athlete/${encodeURIComponent(String(athleteId))}`)}', '_blank')">IFSC PROFILE</button>
        </div>`
      : '';

    return `
            <li class="flex items-center justify-between p-4 bg-surface-container-low/40 hover:bg-surface-container-high transition-all duration-200 rounded-lg group">
                <div class="flex items-center gap-4">
                    <div class="relative w-14 h-14 shrink-0">
                        ${photo}
                    </div>
                    <div class="flex flex-col">
                        <span class="text-on-surface font-headline font-bold tracking-tight text-lg leading-tight">${athleteName}</span>
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

  return `${athletes}${fullStartListLink}`;
};

export const build_start_list_modal_fragment = ({ eventName, startList, eventId }) => {
  const normalizedEventName = String(eventName || '').trim();
  const listHtml = build_start_list_modal_list_html(startList, eventId);

  return `<section class="start-list-modal-fragment"><span class="start-list-modal-fragment-event">${escape_html(normalizedEventName)}</span><h4 class="start-list-modal-fragment-title">ATHLETES ATTENDING</h4><ul class="start-list-modal-fragment-list">${listHtml}</ul></section>`;
};

export const build_start_list_modal_url = (season, eventId) => {
  const normalizedSeason = encodeURIComponent(String(season || '').trim());
  const normalizedEventId = encodeURIComponent(String(eventId || '').trim());

  if (!normalizedSeason || !normalizedEventId) {
    return '';
  }

  return `/start-list-modals/${normalizedSeason}/${normalizedEventId}.html`;
};
