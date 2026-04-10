#!/usr/bin/env python3
"""
Fetches a subsetted Material Symbols Outlined woff2 from Google Fonts
containing exactly the icons used in the project.

Usage: python3 bin/subset-material-symbols.py
"""

import re
import urllib.request
import sys

ICONS = sorted([
    "ads_click",
    "altitude",
    "arrow_back",
    "arrow_forward",
    "arrow_right_alt",
    "block",
    "bug_report",
    "calendar_today",
    "check_circle",
    "close",
    "code",
    "cookie",
    "description",
    "devices",
    "do_not_disturb_on",
    "download",
    "emoji_events",
    "exercise",
    "expand_more",
    "filter_list",
    "flag",
    "groups",
    "history",
    "landslide",
    "live_tv",
    "local_cafe",
    "military_tech",
    "notifications",
    "pending_actions",
    "play_arrow",
    "play_circle",
    "public",
    "restart_alt",
    "replay",
    "save",
    "search",
    "search_off",
    "security",
    "speed",
    "stars",
    "sync",
    "tune",
    "verified",
    "vpn_key",
])

OUTPUT = "public/fonts/material-symbols-outlined.woff2"

css_url = (
    "https://fonts.googleapis.com/css2"
    "?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
    f"&icon_names={','.join(ICONS)}"
    "&display=block"
)

print(f"Fetching CSS: {css_url}")

req = urllib.request.Request(css_url, headers={
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})

with urllib.request.urlopen(req) as resp:
    css = resp.read().decode("utf-8")

match = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)\s+format\('woff2'\)", css)
if not match:
    print("ERROR: could not find woff2 URL in CSS response", file=sys.stderr)
    print(css[:500])
    sys.exit(1)

woff2_url = match.group(1)
print(f"Downloading font: {woff2_url}")

urllib.request.urlretrieve(woff2_url, OUTPUT)
print(f"Saved to {OUTPUT}")
