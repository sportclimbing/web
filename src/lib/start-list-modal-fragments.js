import { athlete_photo_local_sources_build } from './shared/media.js';

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
            <li class="start-list-modal-full-link-row">
                <a class="ifsc-action-button ifsc-action-button-primary start-list-modal-full-link" href="${escape_html(`https://ifsc.results.info/event/${encodeURIComponent(String(eventId))}/registrations`)}" target="_blank" rel="noopener">
                    Full Start List <img src="img/external-link.svg" width="12" height="12" alt="" aria-hidden="true" />
                </a>
            </li>
        `;
};

export const build_start_list_modal_list_html = (startListInput, eventId = '') => {
  const startList = Array.isArray(startListInput) ? startListInput : [];
  const fullStartListLink = build_full_start_list_link(eventId);

  if (!startList.length) {
    return `<li class="start-list-modal-empty">Start list pending.</li>${fullStartListLink}`;
  }

  const athletes = startList.map((athlete) => {
    const athleteName = escape_html(athlete_name_build(athlete));
    const country = athlete?.country ? `<span class="start-list-athlete-country">${escape_html(athlete.country)}</span>` : '';
    const photoSources = athlete_photo_local_sources_build(athlete);
    const photo = photoSources
      ? `<img class="start-list-athlete-photo" src="${escape_html(photoSources.src)}" width="52" height="52" alt="${athleteName}" loading="lazy" referrerpolicy="no-referrer"${photoSources.fallbackSrc ? ` data-fallback-src="${escape_html(photoSources.fallbackSrc)}" onerror="handle_start_list_photo_error(this)"` : ''} />`
      : `<div class="start-list-athlete-photo start-list-athlete-photo-fallback" aria-hidden="true">${escape_html(athlete_initials_build(athlete))}</div>`;
    const hasAthleteId = athlete?.athlete_id !== undefined && athlete?.athlete_id !== null && athlete?.athlete_id !== '';
    const athleteProfile = hasAthleteId
      ? `<a class="ifsc-action-button ifsc-action-button-primary start-list-athlete-profile" href="${escape_html(`https://ifsc.results.info/athlete/${encodeURIComponent(String(athlete.athlete_id))}`)}" target="_blank" rel="noopener">Profile <img src="img/external-link.svg" width="12" height="12" alt="" aria-hidden="true" /></a>`
      : '';

    return `
            <li class="start-list-athlete">
                ${photo}
                <div class="start-list-athlete-meta">
                    <span class="start-list-athlete-name">${athleteName}</span>
                    ${country}
                </div>
                ${athleteProfile}
            </li>
        `;
  }).join('');

  return `${athletes}${fullStartListLink}`;
};

export const build_start_list_modal_fragment = ({ eventName, startList, eventId }) => {
  const normalizedEventName = String(eventName || '').trim();
  const title = normalizedEventName ? `📋 ${normalizedEventName} Start List` : '📋 Start List';
  const listHtml = build_start_list_modal_list_html(startList, eventId);

  return `<section class="start-list-modal-fragment"><h4 class="start-list-modal-fragment-title">${escape_html(title)}</h4><ul class="start-list-modal-fragment-list">${listHtml}</ul></section>`;
};

export const build_start_list_modal_url = (season, eventId) => {
  const normalizedSeason = encodeURIComponent(String(season || '').trim());
  const normalizedEventId = encodeURIComponent(String(eventId || '').trim());

  if (!normalizedSeason || !normalizedEventId) {
    return '';
  }

  return `/start-list-modals/${normalizedSeason}/${normalizedEventId}.html`;
};
