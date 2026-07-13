#!/usr/bin/env python3
"""
Fetches the PodPoint RSS feed for The Question Mark Podcast and writes it
out as a plain JSON file (data/episodes.json) that the site's JS reads
directly — same-origin, so no CORS proxy is needed in the browser.

Run by .github/workflows/update-episodes.yml on a schedule.
"""
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from html import unescape

FEED_URL = "https://podpoint.com/feed/12205"
OUTPUT_PATH = "data/episodes.json"

NS = {
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "media": "http://search.yahoo.com/mrss/",
}


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def find_audio(item):
    for enclosure in item.findall("enclosure"):
        etype = enclosure.get("type", "")
        if etype.startswith("audio"):
            return enclosure.get("url")
    return None


def find_image(item):
    itunes_image = item.find("itunes:image", NS)
    if itunes_image is not None and itunes_image.get("href"):
        return itunes_image.get("href")

    media_thumb = item.find("media:thumbnail", NS)
    if media_thumb is not None and media_thumb.get("url"):
        return media_thumb.get("url")

    for enclosure in item.findall("enclosure"):
        etype = enclosure.get("type", "")
        if etype.startswith("image"):
            return enclosure.get("url")

    return None


def text_of(item, tag):
    el = item.find(tag)
    return el.text.strip() if el is not None and el.text else ""


def main():
    req = urllib.request.Request(FEED_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()

    root = ET.fromstring(raw)
    channel = root.find("channel")
    if channel is None:
        print("No <channel> found in feed", file=sys.stderr)
        sys.exit(1)

    episodes = []
    for item in channel.findall("item"):
        episodes.append({
            "title": text_of(item, "title") or "Untitled episode",
            "link": text_of(item, "link") or "",
            "pubDate": text_of(item, "pubDate") or "",
            "description": strip_html(text_of(item, "description")),
            "image": find_image(item),
            "audio": find_audio(item),
        })

    # Make sure the data/ directory exists — git doesn't track empty
    # directories, so on a fresh checkout this path may not exist yet.
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"episodes": episodes, "fetched_at": datetime.utcnow().isoformat() + "Z"}, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(episodes)} episodes to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
