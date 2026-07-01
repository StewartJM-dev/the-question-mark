/* =========================================================
   The Question Mark Podcast — episode feed loader
   =========================================================
   Primary source: data/episodes.json — a plain JSON file kept
   in this repo. It's meant to be refreshed automatically every
   few hours by a GitHub Action (.github/workflows/update-episodes.yml)
   that fetches PodPoint's RSS feed server-side and commits the
   result. That file avoids CORS entirely (same-origin) and
   doesn't depend on any third-party proxy.

   NOTE: as of this version, that GitHub Action hasn't been added
   yet — pushing files into .github/workflows/ requires a token
   with "workflow" scope, which the one used to build this didn't
   have. Add it manually via the GitHub web UI, or hand over a
   token with that scope, then trigger it once from the repo's
   Actions tab so data/episodes.json gets created.

   Until that file exists, this script falls back automatically to
   fetching the RSS feed live in the browser via corsproxy.io (a
   free CORS proxy that explicitly supports github.io origins).
   That fallback works today with no further setup, but like any
   free third-party proxy it isn't guaranteed reliable long-term —
   the static-JSON path above is the sturdier fix once it's wired up.
   ========================================================= */

var EPISODES_JSON_URL = "data/episodes.json";
var PODCAST_RSS_URL = "https://podpoint.com/feed/12205"; // LWBC Let's Connect channel feed (PodPoint)
var CORS_PROXY = "https://corsproxy.io/?url=";

/* =========================================================
   Filtering to Question Mark episodes only
   =========================================================
   The feed above is the whole "LWBC Let's Connect" channel —
   Pastor Purdy's sermons are mixed in with Gordon's Question
   Mark episodes. PodPoint's series pages don't expose a
   series-specific feed (confirmed: the "Raw XML Feed" link on
   the Question Mark series page just points back to this same
   channel feed), so filtering happens here instead, two ways:

   1. KNOWN_TITLES — a frozen list of existing Question Mark
      episode titles. These never change, so this list never
      needs updating.
   2. FUTURE_PREFIX — going forward, Gordon titles every new
      Question Mark episode starting with this exact text.
      Anything with this prefix is picked up automatically —
      no list maintenance required for new episodes.

   A given episode shows up here if EITHER condition matches.
   ========================================================= */

var FILTER_ENABLED = true;

var FUTURE_PREFIX = "Question Mark: ";

var KNOWN_TITLES = [
  "Growing Or Going Through The Motions",
  "Are You Willing To Serve Jesus",
  "What Cant God Do?",
  "What Does Christmas Mean To You?",
  "Who Are You?"
  // TODO: add the rest of the series list here once confirmed —
  // titles below "Who Are You?" on the series page weren't visible
  // in the screenshot this list was built from.
];

function normalizeTitle(str) {
  return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

var KNOWN_TITLES_NORMALIZED = KNOWN_TITLES.map(normalizeTitle);

function isQuestionMarkEpisode(title) {
  var norm = normalizeTitle(title);
  if (KNOWN_TITLES_NORMALIZED.indexOf(norm) !== -1) return true;
  if (normalizeTitle(title).indexOf(normalizeTitle(FUTURE_PREFIX)) === 0) return true;
  return false;
}

function loadEpisodes(opts) {
  var target = document.querySelector(opts.target);
  if (!target) return;

  fetch(EPISODES_JSON_URL, { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("no static feed yet: " + res.status);
      return res.json();
    })
    .then(function (data) {
      renderList(target, (data && data.episodes) || [], opts, false);
    })
    .catch(function () {
      loadEpisodesLive(target, opts);
    });
}

function loadEpisodesLive(target, opts) {
  var fetchUrl = CORS_PROXY + encodeURIComponent(PODCAST_RSS_URL);

  fetch(fetchUrl)
    .then(function (res) {
      if (!res.ok) throw new Error("Feed request failed: " + res.status);
      return res.text();
    })
    .then(function (xmlText) {
      var parser = new DOMParser();
      var xml = parser.parseFromString(xmlText, "application/xml");
      if (xml.querySelector("parsererror")) throw new Error("Could not parse RSS feed");

      var items = Array.prototype.slice.call(xml.querySelectorAll("item"));
      var episodes = items.map(function (item) {
        return {
          title: textOf(item, "title") || "Untitled episode",
          link: textOf(item, "link") || "",
          pubDate: textOf(item, "pubDate") || "",
          description: stripHtml(textOf(item, "description") || ""),
          image: findImage(item),
        };
      });

      renderList(target, episodes, opts, true);
    })
    .catch(function (err) {
      console.error(err);
      target.innerHTML =
        '<li class="feed-status">Episodes couldn\u2019t be loaded right now. Check back soon.</li>';
    });
}

function renderList(target, episodes, opts, isLiveFallback) {
  if (FILTER_ENABLED) {
    episodes = episodes.filter(function (ep) {
      return isQuestionMarkEpisode(ep.title);
    });
  }

  if (opts.limit) episodes = episodes.slice(0, opts.limit);

  if (!episodes.length) {
    target.innerHTML = '<li class="feed-status">No episodes found in the feed yet.</li>';
    return;
  }


  target.innerHTML = episodes.map(renderEpisode).join("");

  if (isLiveFallback) {
    console.info("Episodes loaded via live CORS-proxied fetch (data/episodes.json not found yet).");
  }
}

function renderEpisode(ep) {
  var title = ep.title || "Untitled episode";
  var link = ep.link || "#";
  var pubDate = ep.pubDate || "";
  var description = ep.description || "";
  var image = ep.image || null;

  return (
    '<li>' +
      '<a class="episode" href="' + escapeAttr(link) + '" target="_blank" rel="noopener">' +
        '<span class="episode-art">' +
          (image
            ? '<img src="' + escapeAttr(image) + '" alt="" loading="lazy">'
            : generateArt(title)) +
        '</span>' +
        '<span>' +
          '<span class="episode-date">' + formatDate(pubDate) + '</span>' +
          '<span class="episode-title">' + escapeHtml(title) + '</span>' +
          '<p class="episode-blurb">' + escapeHtml(description) + '</p>' +
        '</span>' +
      '</a>' +
    '</li>'
  );
}

/* =========================================================
   Generative cover art
   =========================================================
   When PodPoint doesn't supply artwork for an episode, this
   builds a small abstract graphic instead of leaving a blank
   tile — a soft radial gradient with a thin ring and a tilted
   line, echoing (without copying) the circular flourish and
   cross in the show's real logo. Deterministic: the same
   episode title always produces the same graphic.
   ========================================================= */

var ART_PALETTES = [
  ["#d99a4e", "#4a2f14"], // amber / umber
  ["#4a8f88", "#12302c"], // deep teal
  ["#b85c4a", "#3a1712"], // rust
  ["#5b6fa8", "#1b2138"], // indigo
  ["#9a5b95", "#2e1b33"], // plum
  ["#c9a23e", "#2a2113"]  // gold / olive
];

function hashString(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function generateArt(title) {
  var seed = hashString(title || "untitled");
  var palette = ART_PALETTES[seed % ART_PALETTES.length];
  var tilt = (seed % 40) - 20;
  var id = "g" + seed;

  return (
    '<svg viewBox="0 0 200 200" width="100%" height="100%" ' +
      'xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">' +
      '<defs><radialGradient id="' + id + '" cx="35%" cy="30%" r="85%">' +
        '<stop offset="0%" stop-color="' + palette[0] + '"/>' +
        '<stop offset="100%" stop-color="' + palette[1] + '"/>' +
      '</radialGradient></defs>' +
      '<rect width="200" height="200" fill="url(#' + id + ')"/>' +
      '<circle cx="100" cy="100" r="68" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>' +
      '<line x1="100" y1="18" x2="100" y2="182" stroke="rgba(255,255,255,0.28)" stroke-width="2" ' +
        'transform="rotate(' + tilt + ' 100 100)"/>' +
    '</svg>'
  );
}

function textOf(item, tag) {
  var el = item.querySelector(tag);
  return el ? el.textContent.trim() : "";
}

function findImage(item) {
  var itunesImage = item.getElementsByTagNameNS("*", "image")[0];
  if (itunesImage && itunesImage.getAttribute("href")) {
    return itunesImage.getAttribute("href");
  }
  var mediaThumb = item.getElementsByTagNameNS("*", "thumbnail")[0];
  if (mediaThumb && mediaThumb.getAttribute("url")) {
    return mediaThumb.getAttribute("url");
  }
  var enclosure = item.querySelector("enclosure[type^='image']");
  if (enclosure) return enclosure.getAttribute("url");
  return null;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function stripHtml(str) {
  var div = document.createElement("div");
  div.innerHTML = str;
  return (div.textContent || div.innerText || "").trim();
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}
