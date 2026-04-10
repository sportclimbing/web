#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { extract_youtube_video_id } from '../src/lib/shared/media.js'

const EVENT_SCHEDULED = 'https://schema.org/EventScheduled';
const EVENT_IN_PROGRESS = 'https://schema.org/EventInProgress';
const EVENT_COMPLETED = 'https://schema.org/EventCompleted';
const DEFAULT_YOUTUBE_VIDEO_ID = 'emrHdLsJTk4';
const YOUTUBE_IMAGE_RESOLUTIONS = ['default', 'mqdefault', 'hqdefault'];

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

const is_plain_object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const trim_trailing_slashes = (value) => String(value ?? '').replace(/\/+$/g, '');

const raw_url_encode = (value) => encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const to_date = (value) => {
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const schema_event_status = (startsAt, endsAt, now) => {
    const eventStart = to_date(startsAt);
    const eventEnd = to_date(endsAt);

    if (!eventStart || !eventEnd) {
        return EVENT_SCHEDULED;
    }

    if (now < eventStart) {
        return EVENT_SCHEDULED;
    }

    if (now > eventEnd) {
        return EVENT_COMPLETED;
    }

    return EVENT_IN_PROGRESS;
};

const schema_event_location = (event) => {
    const locationName = trim(event?.location);
    const country = trim(event?.country);
    const name = locationName || country || 'TBA';
    const location = {
        '@type': 'Place',
        name,
    };

    if (country) {
        location.address = {
            '@type': 'PostalAddress',
            addressCountry: country,
        };
    }

    return location;
};

const schema_event_fallback_url = (siteUrl, season) => `${siteUrl}/season/${season}`;

const schema_round_url = (round, siteUrl, season) => {
    const streamUrl = trim(round?.stream_url);
    return streamUrl || schema_event_fallback_url(siteUrl, season);
};

const schema_round_name = (event, round) => {
    const eventName = trim(event?.name);
    const roundName = trim(round?.name);

    if (eventName && roundName) {
        return `${eventName} - ${roundName}`;
    }

    if (roundName) {
        return roundName;
    }

    return eventName || 'IFSC Round';
};

const schema_round_description = (event, round) => {
    const name = schema_round_name(event, round);
    const locationName = trim(event?.location);
    const country = trim(event?.country);
    const location = [locationName, country].filter(Boolean).join(', ');

    if (location) {
        return `${name} in ${location}. Live stream links and schedule`;
    }

    return `${name}. Live stream links and schedule`;
};

const schema_event_name = (event) => trim(event?.name) || 'IFSC Event';

const schema_event_description = (event) => {
    const eventName = schema_event_name(event);
    const locationName = trim(event?.location);
    const country = trim(event?.country);
    const location = [locationName, country].filter(Boolean).join(', ');

    if (location) {
        return `${eventName} in ${location}. Live stream links and schedule`;
    }

    return `${eventName}. Live stream links and schedule`;
};

const schema_slugify = (value) => trim(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const schema_event_page_url = (event, siteUrl, season) => {
    const eventId = String(event?.id ?? '').trim();

    if (!eventId) {
        return schema_event_fallback_url(siteUrl, season);
    }

    const slugSource = trim(event?.slug) || schema_event_name(event);
    let slug = schema_slugify(slugSource);
    const eventIdSuffix = `-${eventId}`;

    if (slug && slug.endsWith(eventIdSuffix)) {
        slug = slug.slice(0, -eventIdSuffix.length);
    }

    if (!slug) {
        slug = 'event';
    }

    const seasonSegment = raw_url_encode(season);
    const slugIdSegment = raw_url_encode(`${slug}-${eventId}`);

    return `${siteUrl}/season/${seasonSegment}/event/${slugIdSegment}`;
};

const schema_performer_name = (performer) => {
    const firstName = trim(performer?.first_name);
    const lastName = trim(performer?.last_name);
    const name = [firstName, lastName].filter(Boolean).join(' ');
    return name || trim(performer?.name);
};

const schema_event_athletes = (event) => {
    const startList = Array.isArray(event?.start_list) ? event.start_list : [];
    const athletes = [];

    for (const startListAthlete of startList) {
        if (!is_plain_object(startListAthlete)) {
            continue;
        }

        const name = schema_performer_name(startListAthlete);

        if (!name) {
            continue;
        }

        athletes.push({
            '@type': 'Person',
            name,
        });

        if (athletes.length >= 5) {
            break;
        }
    }

    return athletes;
};

const schema_event_performer_team = (event) => {
    const athletes = schema_event_athletes(event);

    if (!athletes.length) {
        return null;
    }

    const eventName = trim(event?.name);
    const teamName = eventName ? `${eventName} athletes` : 'Athletes';

    return {
        '@type': 'SportsTeam',
        name: teamName,
        athlete: athletes,
    };
};

const schema_round_images = (round) => {
    const streamUrl = trim(round?.stream_url);
    const videoId = extract_youtube_video_id(streamUrl) || DEFAULT_YOUTUBE_VIDEO_ID;
    return YOUTUBE_IMAGE_RESOLUTIONS.map((resolution) => `https://img.youtube.com/vi/${videoId}/${resolution}.jpg`);
};

const schema_normalize_keyword = (keyword) => trim(keyword).toLowerCase();

const schema_keywords = (event, round) => {
    const keywords = [schema_normalize_keyword('climbing')];

    for (const values of [round?.disciplines ?? [], round?.categories ?? [], event?.disciplines ?? []]) {
        for (const value of Array.isArray(values) ? values : []) {
            if (typeof value === 'string' && trim(value)) {
                keywords.push(schema_normalize_keyword(value));
            }
        }
    }

    if (trim(round?.kind)) {
        keywords.push(schema_normalize_keyword(round.kind));
    }

    if (trim(event?.league_name)) {
        keywords.push(schema_normalize_keyword(event.league_name));
    }

    if (trim(event?.location)) {
        keywords.push(schema_normalize_keyword(event.location));
    }

    if (trim(event?.country)) {
        keywords.push(schema_normalize_keyword(event.country));
    }

    return Array.from(new Set(keywords)).join(', ');
};

const schema_event_keywords = (event) => {
    const keywords = [schema_normalize_keyword('climbing')];

    for (const values of [event?.disciplines ?? []]) {
        for (const value of Array.isArray(values) ? values : []) {
            if (typeof value === 'string' && trim(value)) {
                keywords.push(schema_normalize_keyword(value));
            }
        }
    }

    if (trim(event?.league_name)) {
        keywords.push(schema_normalize_keyword(event.league_name));
    }

    if (trim(event?.location)) {
        keywords.push(schema_normalize_keyword(event.location));
    }

    if (trim(event?.country)) {
        keywords.push(schema_normalize_keyword(event.country));
    }

    return Array.from(new Set(keywords)).join(', ');
};

const schema_file_name_token = (value, fallback = 'event') => {
    const normalized = trim(value);

    if (!normalized) {
        return fallback;
    }

    const token = normalized.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return token || fallback;
};

const schema_same_as_urls = (event, schemaEventUrl) => {
    const sameAs = [];
    const eventId = String(event?.id ?? '').trim();

    if (eventId) {
        sameAs.push(`https://ifsc.results.info/event/${eventId}/`);
    }

    const eventUrl = trim(event?.event_url);

    if (eventUrl && eventUrl !== schemaEventUrl) {
        sameAs.push(eventUrl);
    }

    return Array.from(new Set(sameAs));
};

const cli_usage_text = (scriptName) => [
    'Usage:',
    `  node ${scriptName} [--events-dir <dir>] [--output-dir <dir>] [--site-url <url>] [--minify|--pretty|--no-minify]`,
    `  node ${scriptName} [events-dir] [output-dir] [site-url] [minify]`,
    '',
    'Minify values:',
    '  1,true,yes,on,minify,minified,compact',
    '  0,false,no,off,pretty,pretty-print,prettyprint',
    '',
].join('\n');

const print_usage_and_exit = (scriptName, exitCode = 0) => {
    const usageText = cli_usage_text(scriptName);

    if (exitCode === 0) {
        process.stdout.write(usageText);
    } else {
        process.stderr.write(usageText);
    }

    process.exit(exitCode);
};

const fail_with_usage = (scriptName, message) => {
    process.stderr.write(`${message}\n`);
    print_usage_and_exit(scriptName, 1);
};

const parse_boolean_flag_value = (argument, optionName) => {
    const value = trim(argument).toLowerCase();
    const truthyValues = new Set(['1', 'true', 'yes', 'on']);
    const falsyValues = new Set(['0', 'false', 'no', 'off']);

    if (truthyValues.has(value)) {
        return true;
    }

    if (falsyValues.has(value)) {
        return false;
    }

    process.stderr.write(`Invalid value for --${optionName}: ${argument}\nUse one of: 1,true,yes,on,0,false,no,off\n`);
    process.exit(1);
};

const parse_minify_argument = (argument) => {
    if (argument == null) {
        return true;
    }

    const value = trim(argument).toLowerCase();
    const truthyValues = new Set(['1', 'true', 'yes', 'on', 'minify', 'minified', 'compact']);
    const falsyValues = new Set(['0', 'false', 'no', 'off', 'pretty', 'pretty-print', 'prettyprint']);

    if (truthyValues.has(value)) {
        return true;
    }

    if (falsyValues.has(value)) {
        return false;
    }

    process.stderr.write(
        `Invalid minify argument: ${argument}\n`
        + 'Use one of: 1,true,yes,on,minify,minified,compact,0,false,no,off,pretty,pretty-print,prettyprint\n',
    );
    process.exit(1);
};

const parse_cli_options = (args, scriptName) => {
    const options = {};
    const positional = [];

    for (let index = 0; index < args.length; index += 1) {
        const argument = String(args[index]);

        if (argument === '-h' || argument === '--help') {
            print_usage_and_exit(scriptName, 0);
        }

        if (argument === '--') {
            positional.push(...args.slice(index + 1).map(String));
            break;
        }

        if (!argument.startsWith('--')) {
            positional.push(argument);
            continue;
        }

        const optionBody = argument.slice(2);

        if (!optionBody) {
            fail_with_usage(scriptName, 'Invalid option: --');
        }

        const separatorIndex = optionBody.indexOf('=');
        const optionName = trim(separatorIndex >= 0 ? optionBody.slice(0, separatorIndex) : optionBody);
        let optionValue = separatorIndex >= 0 ? optionBody.slice(separatorIndex + 1) : null;

        if (!optionName) {
            fail_with_usage(scriptName, `Invalid option format: ${argument}`);
        }

        if (['events-dir', 'output-dir', 'site-url'].includes(optionName)) {
            if (optionValue == null) {
                const nextArgument = args[index + 1];

                if (typeof nextArgument !== 'string' || nextArgument.startsWith('--')) {
                    fail_with_usage(scriptName, `Missing value for --${optionName}`);
                }

                optionValue = nextArgument;
                index += 1;
            }

            options[optionName.replace(/-/g, '_')] = optionValue;
            continue;
        }

        if (optionName === 'minify') {
            if (optionValue == null) {
                const nextArgument = args[index + 1];

                if (typeof nextArgument === 'string' && !nextArgument.startsWith('--')) {
                    optionValue = nextArgument;
                    index += 1;
                } else {
                    optionValue = 'true';
                }
            }

            options.minify = optionValue;
            continue;
        }

        if (optionName === 'pretty') {
            if (optionValue != null) {
                const enablePretty = parse_boolean_flag_value(optionValue, 'pretty');
                options.minify = enablePretty ? 'false' : 'true';
            } else {
                options.minify = 'false';
            }

            continue;
        }

        if (optionName === 'no-minify') {
            if (optionValue != null) {
                const disableMinify = parse_boolean_flag_value(optionValue, 'no-minify');
                options.minify = disableMinify ? 'false' : 'true';
            } else {
                options.minify = 'false';
            }

            continue;
        }

        fail_with_usage(scriptName, `Unknown option: --${optionName}`);
    }

    return {options, positional};
};

const json_encode = (payload, minify) => JSON.stringify(payload, null, minify ? 0 : 4);

const read_events_payload = async (eventFile) => {
    let contents = '';

    try {
        contents = await fs.readFile(eventFile, 'utf8');
    } catch (error) {
        throw new Error(`Could not parse ${eventFile}: ${error.message}`);
    }

    try {
        return JSON.parse(contents);
    } catch (error) {
        throw new Error(`Could not parse ${eventFile}: ${error.message}`);
    }
};

const main = async () => {
    const scriptName = path.basename(process.argv[1] ?? 'build-structured-data.mjs');
    const {
        options: namedOptions,
        positional: positionalArguments
    } = parse_cli_options(process.argv.slice(2), scriptName);
    const positional = [...positionalArguments];

    const eventsDirectory = trim_trailing_slashes(namedOptions.events_dir ?? positional.shift() ?? 'events');
    const outputDirectory = trim_trailing_slashes(namedOptions.output_dir ?? positional.shift() ?? 'public/structured-data');
    const siteUrl = trim_trailing_slashes(namedOptions.site_url ?? positional.shift() ?? 'https://ifsc.stream');
    const minifyArgument = namedOptions.minify ?? (positional.length ? positional.shift() : null);

    if (positional.length > 0) {
        fail_with_usage(scriptName, 'Too many positional arguments provided.');
    }

    const minifyJson = parse_minify_argument(minifyArgument);
    const organizationId = `${siteUrl}/#organization`;
    const now = new Date();

    let eventsDirectoryStat = null;

    try {
        eventsDirectoryStat = await fs.stat(eventsDirectory);
    } catch (_error) {
        // keep null
    }

    if (!eventsDirectoryStat?.isDirectory()) {
        process.stderr.write(`Events directory not found: ${eventsDirectory}\n`);
        process.exit(1);
    }

    try {
        await fs.mkdir(outputDirectory, {recursive: true});
    } catch (_error) {
        process.stderr.write(`Could not create output directory: ${outputDirectory}\n`);
        process.exit(1);
    }

    let eventEntries = [];

    try {
        eventEntries = await fs.readdir(eventsDirectory, {withFileTypes: true});
    } catch (_error) {
        process.stderr.write(`No event files found in ${eventsDirectory}\n`);
        process.exit(1);
    }

    const eventFiles = eventEntries
        .filter((entry) => entry.isFile() && /^events_.*\.json$/.test(entry.name))
        .map((entry) => path.join(eventsDirectory, entry.name))
        .sort((left, right) => left.localeCompare(right));

    if (!eventFiles.length) {
        process.stderr.write(`No event files found in ${eventsDirectory}\n`);
        process.exit(1);
    }

    for (const eventFile of eventFiles) {
        const matches = eventFile.match(/events_(\d{4})\.json$/);

        if (!matches?.[1]) {
            continue;
        }

        const season = matches[1];
        let payload = null;

        try {
            payload = await read_events_payload(eventFile);
        } catch (error) {
            process.stderr.write(`${error.message}\n`);
            process.exit(1);
        }

        const events = (Array.isArray(payload?.events) ? payload.events : [])
            .filter((event) => is_plain_object(event) && event.id != null && event.name != null);

        if (!events.length) {
            continue;
        }

        let seriesStartDate = null;
        let seriesEndDate = null;
        let seriesStart = null;
        let seriesEnd = null;
        const sportsEvents = [];
        const subEvents = [];

        for (const event of events) {
            const eventId = String(event.id ?? '').trim();
            const rounds = Array.isArray(event?.rounds) ? event.rounds : [];
            const eventPerformerTeam = schema_event_performer_team(event);
            let eventStartDate = null;
            let eventEndDate = null;
            let eventStart = null;
            let eventEnd = null;
            const eventSportsEvents = [];
            const eventSubEvents = [];

            for (const [roundIndex, round] of rounds.entries()) {
                if (!is_plain_object(round) || round.starts_at == null || round.ends_at == null) {
                    continue;
                }

                const startsAt = String(round.starts_at);
                const endsAt = String(round.ends_at);
                const schemaId = `${siteUrl}/#round-${season}-${eventId}-${roundIndex + 1}`;
                const roundStart = to_date(startsAt);
                const roundEnd = to_date(endsAt);

                if (!roundStart || !roundEnd) {
                    process.stderr.write(`Skipping round ${roundIndex + 1} for event ${eventId} in season ${season}: invalid dates\n`);
                    continue;
                }

                if (!seriesStart || roundStart < seriesStart) {
                    seriesStart = roundStart;
                    seriesStartDate = startsAt;
                }

                if (!seriesEnd || roundEnd > seriesEnd) {
                    seriesEnd = roundEnd;
                    seriesEndDate = endsAt;
                }

                if (!eventStart || roundStart < eventStart) {
                    eventStart = roundStart;
                    eventStartDate = startsAt;
                }

                if (!eventEnd || roundEnd > eventEnd) {
                    eventEnd = roundEnd;
                    eventEndDate = endsAt;
                }

                const schemaEvent = {
                    '@type': 'SportsEvent',
                    '@id': schemaId,
                    name: schema_round_name(event, round),
                    description: schema_round_description(event, round),
                    sport: 'Sport climbing',
                    startDate: startsAt,
                    endDate: endsAt,
                    eventStatus: schema_event_status(startsAt, endsAt, now),
                    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
                    organizer: {
                        '@id': organizationId,
                    },
                    location: schema_event_location(event),
                    image: schema_round_images(round),
                    url: schema_round_url(round, siteUrl, season),
                };

                if (eventPerformerTeam) {
                    schemaEvent.performer = eventPerformerTeam;
                }

                if (trim(event?.league_name)) {
                    schemaEvent.eventType = trim(event.league_name);
                } else if (trim(round?.kind)) {
                    schemaEvent.eventType = trim(round.kind);
                }

                const keywords = schema_keywords(event, round);

                if (keywords) {
                    schemaEvent.keywords = keywords;
                }

                const sameAs = schema_same_as_urls(event, schemaEvent.url);

                if (sameAs.length) {
                    schemaEvent.sameAs = sameAs;
                }

                sportsEvents.push(schemaEvent);
                subEvents.push({
                    '@id': schemaId,
                });
                eventSportsEvents.push(schemaEvent);
                eventSubEvents.push({
                    '@id': schemaId,
                });
            }

            if (!eventSportsEvents.length || !eventStartDate || !eventEndDate) {
                continue;
            }

            const eventSchemaUrl = schema_event_page_url(event, siteUrl, season);
            const eventSchemaId = `${siteUrl}/#event-${season}-${eventId}`;
            const eventSchema = {
                '@type': 'SportsEvent',
                '@id': eventSchemaId,
                name: schema_event_name(event),
                description: schema_event_description(event),
                sport: 'Sport climbing',
                startDate: eventStartDate,
                endDate: eventEndDate,
                eventStatus: schema_event_status(eventStartDate, eventEndDate, now),
                eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
                organizer: {
                    '@id': organizationId,
                },
                location: schema_event_location(event),
                url: eventSchemaUrl,
                subEvent: eventSubEvents,
            };

            if (eventPerformerTeam) {
                eventSchema.performer = eventPerformerTeam;
            }

            if (trim(event?.league_name)) {
                eventSchema.eventType = trim(event.league_name);
            }

            const eventKeywords = schema_event_keywords(event);

            if (eventKeywords) {
                eventSchema.keywords = eventKeywords;
            }

            const eventSameAs = schema_same_as_urls(event, eventSchemaUrl);

            if (eventSameAs.length) {
                eventSchema.sameAs = eventSameAs;
            }

            const eventPrimaryImage = eventSportsEvents[0]?.image;

            if (Array.isArray(eventPrimaryImage) && eventPrimaryImage.length) {
                eventSchema.image = eventPrimaryImage;
            }

            const eventGraph = {
                '@context': 'https://schema.org',
                '@graph': [eventSchema, ...eventSportsEvents],
            };
            const eventIdToken = schema_file_name_token(eventId);
            const eventOutputFile = path.join(outputDirectory, `events_${season}_${eventIdToken}.json`);
            const eventOutputJson = json_encode(eventGraph, minifyJson);

            await fs.writeFile(eventOutputFile, `${eventOutputJson}\n`, 'utf8');
            process.stdout.write(`[+] Built structured data for event ${eventId} (${season}): ${eventOutputFile}\n`);
        }

        if (!sportsEvents.length) {
            continue;
        }

        const seasonSchemaId = `${siteUrl}/#season-${season}`;
        const graph = {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'EventSeries',
                    '@id': seasonSchemaId,
                    name: `World Climbing Season ${season}`,
                    description: `Competition climbing season schedule and live stream links for ${season}.`,
                    url: `${siteUrl}/season/${season}`,
                    organizer: {
                        '@id': organizationId,
                    },
                    startDate: seriesStartDate,
                    endDate: seriesEndDate,
                    subEvent: subEvents,
                },
                ...sportsEvents,
            ],
        };

        const outputFile = path.join(outputDirectory, `events_${season}.json`);
        const outputJson = json_encode(graph, minifyJson);

        await fs.writeFile(outputFile, `${outputJson}\n`, 'utf8');
        process.stdout.write(`[+] Built structured data for season ${season}: ${outputFile}\n`);
    }
};

main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
});
