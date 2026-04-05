#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {DEFAULT_SEASON} from '../src/lib/config.js';

const season_priority = (index, count) => {
    const minPriority = 0.40;
    const maxPriority = 0.90;

    if (count <= 1) {
        return maxPriority;
    }

    return minPriority + ((maxPriority - minPriority) * (index / (count - 1)));
};

const event_priority = (index, count) => {
    const minPriority = 0.30;
    const maxPriority = 0.80;

    if (count <= 1) {
        return maxPriority;
    }

    return minPriority + ((maxPriority - minPriority) * (index / (count - 1)));
};

const decode_json_file = async (filePath) => {
    let contents = '';

    try {
        contents = await fs.readFile(filePath, 'utf8');
    } catch (_error) {
        throw new Error(`Could not read events file: ${filePath}`);
    }

    let payload = null;

    try {
        payload = JSON.parse(contents);
    } catch (error) {
        throw new Error(`Could not parse ${filePath}: ${error.message}`);
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(`Invalid events payload in ${filePath}`);
    }

    return payload;
};

const build_event_slug_id_segment = (event) => {
    let slug = event?.slug;
    const eventId = event?.id;
    const eventIdSuffix = `-${eventId}`;

    if (slug.endsWith(eventIdSuffix)) {
        slug = slug.slice(0, -eventIdSuffix.length);
    }

    return `${slug}-${eventId}`;
};

const site_url_with_trailing_slash = (siteUrl, urlPath = '') => {
    const normalizedPath = String(urlPath).trim();

    if (!normalizedPath || normalizedPath === '/') {
        return `${siteUrl}/`;
    }

    return `${siteUrl}/${normalizedPath.replace(/^\/+|\/+$/g, '')}/`;
};

const trim_trailing_slashes = (value) => String(value ?? '').replace(/[\\/]+$/g, '');

const is_directory = async (filePath) => {
    try {
        const stat = await fs.stat(filePath);
        return stat.isDirectory();
    } catch (_error) {
        return false;
    }
};

const discover_event_files = async (eventsDirectory) => {
    let entries = [];

    try {
        entries = await fs.readdir(eventsDirectory, {withFileTypes: true});
    } catch (_error) {
        throw new Error(`No season event files found in ${eventsDirectory}`);
    }

    const eventFiles = entries
        .filter((entry) => entry.isFile() && /^events_.*\.json$/.test(entry.name))
        .map((entry) => path.join(eventsDirectory, entry.name));

    if (!eventFiles.length) {
        throw new Error(`No season event files found in ${eventsDirectory}`);
    }

    const eventFileBySeason = new Map();

    for (const eventFile of eventFiles) {
        const match = path.basename(eventFile).match(/^events_(\d{4})\.json$/);

        if (!match?.[1]) {
            continue;
        }

        eventFileBySeason.set(Number.parseInt(match[1], 10), eventFile);
    }

    const seasons = Array.from(eventFileBySeason.keys()).sort((a, b) => a - b);

    if (!seasons.length) {
        throw new Error(`No valid season files matched events_YYYY.json in ${eventsDirectory}`);
    }

    return {eventFileBySeason, seasons};
};

const xml_escape = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const build_xml_document = (entries) => {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];

    for (const entry of entries) {
        lines.push('  <url>');
        lines.push(`    <loc>${xml_escape(entry.loc)}</loc>`);
        lines.push(`    <changefreq>${xml_escape(entry.changefreq)}</changefreq>`);
        lines.push(`    <priority>${xml_escape(entry.priority)}</priority>`);
        lines.push('  </url>');
    }

    lines.push('</urlset>', '');
    return lines.join('\n');
};

const main = async () => {
    const eventsDirectory = trim_trailing_slashes(process.argv[2] ?? 'events');
    const outputFile = process.argv[3] ?? 'public/sitemap.xml';
    const siteUrl = trim_trailing_slashes(process.argv[4] ?? 'https://ifsc.stream');

    if (!(await is_directory(eventsDirectory))) {
        console.error(`Events directory not found: ${eventsDirectory}`);
        process.exit(1);
    }

    let discovered = null;

    try {
        discovered = await discover_event_files(eventsDirectory);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }

    const {eventFileBySeason, seasons} = discovered;
    const latestSeason = Math.max(...seasons);
    const seasonCount = seasons.length;
    const defaultSeason = Number.parseInt(DEFAULT_SEASON, 10);

    const seasonPageSeasons = seasons.filter((season) => season !== defaultSeason);
    const seasonPageCount = seasonPageSeasons.length;

    const entries = [];
    const entryByLocation = new Set();

    const add_entry = (entry) => {
        const location = entry?.loc;

        if (typeof location !== 'string' || !location || entryByLocation.has(location)) {
            return;
        }

        entries.push(entry);
        entryByLocation.add(location);
    };

    add_entry({
        loc: site_url_with_trailing_slash(siteUrl),
        changefreq: 'hourly',
        priority: '1.00',
    });

    add_entry({
        loc: site_url_with_trailing_slash(siteUrl, '/faq'),
        changefreq: 'weekly',
        priority: '0.70',
    });

    for (const [index, season] of seasonPageSeasons.entries()) {
        add_entry({
            loc: site_url_with_trailing_slash(siteUrl, `/season/${season}`),
            changefreq: season === latestSeason ? 'hourly' : 'weekly',
            priority: season_priority(index, seasonPageCount).toFixed(2),
        });
    }

    let eventPageCount = 0;

    for (const [index, season] of seasons.entries()) {
        const eventsFile = eventFileBySeason.get(season) || '';

        if (!eventsFile) {
            continue;
        }

        let payload = null;

        try {
            payload = await decode_json_file(eventsFile);
        } catch (error) {
            console.error(error.message);
            process.exit(1);
        }

        const events = Array.isArray(payload.events) ? payload.events : [];

        for (const event of events) {
            if (!event || typeof event !== 'object' || Array.isArray(event)) {
                continue;
            }

            const slugIdSegment = build_event_slug_id_segment(event);

            if (!slugIdSegment) {
                continue;
            }

            const location = site_url_with_trailing_slash(siteUrl, `/season/${season}/event/${slugIdSegment}`);

            if (entryByLocation.has(location)) {
                continue;
            }

            add_entry({
                loc: location,
                changefreq: season === latestSeason ? 'daily' : 'weekly',
                priority: event_priority(index, seasonCount).toFixed(2),
            });
            eventPageCount += 1;
        }
    }

    const outputDirectory = path.dirname(outputFile);

    try {
        await fs.mkdir(outputDirectory, {recursive: true});
    } catch (_error) {
        console.error(`Could not create output directory: ${outputDirectory}`);
        process.exit(1);
    }

    const xml = build_xml_document(entries);

    try {
        await fs.writeFile(outputFile, xml, 'utf8');
    } catch (_error) {
        console.error(`Could not write sitemap file: ${outputFile}`);
        process.exit(1);
    }

    console.log(`[+] Built sitemap with ${seasonPageCount} season pages and ${eventPageCount} event pages: ${outputFile}`);
};

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
