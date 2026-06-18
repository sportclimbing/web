// Builds the slick path-based calendar subscription URL consumed by the
// external cal.ifsc.stream iCal backend, e.g.
//   https://cal.ifsc.stream/world/men/lead/semis+finals.ics
//
// Grammar: /[series]/[category]/[discipline]/[round].ics — each segment
// optional (omitted = "all" of that group), multi-select joined with "+",
// ".ics" appended to the last present segment. No filters => bare base URL.
//
// Shared by core.js (bundle, export stripped at build time) and the inline
// script in CalendarConfigPage.astro (Vite ESM import).

export const CALENDAR_BASE_URL = 'https://cal.ifsc.stream';

export const ROUND_URL_ALIAS = { qualification: 'quali', 'semi-final': 'semis', final: 'finals' };

// groups: { series, category, discipline, round } — each an array of enabled
// internal keys, or empty/omitted to mean "all of this group" (no segment).
export function build_calendar_url({ series = [], category = [], discipline = [], round = [] } = {}) {
    const seg = (vals, alias) =>
        vals.length ? vals.map((v) => (alias ? alias[v] || v : v)).join('+') : null;
    const parts = [
        seg(series),
        seg(category),
        seg(discipline),
        seg(round, ROUND_URL_ALIAS),
    ].filter(Boolean);
    if (!parts.length) return `${CALENDAR_BASE_URL}/`;
    return `${CALENDAR_BASE_URL}/${parts.join('/')}.ics`;
}
