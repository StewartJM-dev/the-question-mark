/* =========================================================
   The Question Mark Podcast — episode feed loader
   =========================================================
   HOW TO ACTIVATE:
   Set PODCAST_RSS_URL below to the show's real RSS feed URL
   from PodPoint (Settings / Distribution tab in the PodPoint
   dashboard — it will end in something like .xml or /feed).
   Until that's set, every page shows a friendly placeholder
   instead of episodes.
   ========================================================= */

var PODCAST_RSS_URL = "https://podpoint.com/feed/12205"; // LWBC Let's Connect channel feed (PodPoint)

// NOTE: this feed currently returns ALL episodes of the "LWBC Let's Connect"
// channel, not just The Question Mark. "The Question Mark" is a series
// inside that channel (podpoint.com/lwbc-lets-connect/series/the-question-mark),
// not its own top-level PodPoint show — so Pastor Purdy's Sunday sermons will
// show up in this feed too unless PodPoint offers a series-only feed URL.
// Worth asking Gordon whether he wants a dedicated "Question Mark" channel
// on PodPoint, or whether we filter this feed client-side (see FILTER_TITLE
// below) as a stopgap.
var FILTER_SERIES_TITLE = ""; // e.g. "The Question Mark" — leave blank to show everything in the feed

// Many podcast hosts don't send CORS headers, which blocks a browser
// from fetching their RSS feed directly from a different domain (like
// stewartjm-dev.github.io). This free proxy re-serves the feed with
// CORS allowed. If PodPoint's feed already supports CORS, this can be
// removed by setting USE_CORS_PROXY to false.
var USE_CORS_PROXY = true;
var CORS_PROXY = "https://api.allorigins.win/raw?url=";

function loadEpisodes(opts) {
  var target = document.querySelector(opts.target);
  if (!target) return;

  if (!PODCAST_RSS_URL) {
    target.innerHTML =
      '<li class="feed-status">Episodes will appear here once the show\u2019s RSS feed is connected.</li>';
    return;
  }

  var fetchUrl = USE_CORS_PROXY
    ? CORS_PROXY + encodeURIComponent(PODCAST_RSS_URL)
    : PODCAST_RSS_URL;

  fetch(fetchUrl)
    .then(function (res) {
      if (!res.ok) throw new Error("Feed request failed: " + res.status);
      return res.text();
    })
    .then(function (xmlText) {
      var parser = new DOMParser();
      var xml = parser.parseFromString(xmlText, "application/xml");

      if (xml.querySelector("parsererror")) {
        throw new Error("Could not parse RSS feed");
      }

      var items = Array.prototype.slice.call(xml.querySelectorAll("item"));

      if (typeof FILTER_SERIES_TITLE !== "undefined" && FILTER_SERIES_TITLE) {
        items = items.filter(function (item) {
          // PodPoint typically tags an episode's series via <category>.
          // This checks every <category> on the item for a case-insensitive
          // match against FILTER_SERIES_TITLE. If PodPoint uses a different
          // tag for series, this filter won't catch anything — in that case
          // it's safer to leave FILTER_SERIES_TITLE blank and show the full
          // feed than to silently hide every episode.
          var categories = Array.prototype.slice.call(item.querySelectorAll("category"));
          return categories.some(function (cat) {
            return cat.textContent.trim().toLowerCase() === FILTER_SERIES_TITLE.toLowerCase();
          });
        });
      }

      if (opts.limit) items = items.slice(0, opts.limit);

      if (!items.length) {
        target.innerHTML = '<li class="feed-status">No episodes found in the feed yet.</li>';
        return;
      }

      target.innerHTML = items.map(renderEpisode).join("");
    })
    .catch(function (err) {
      console.error(err);
      target.innerHTML =
        '<li class="feed-status">Episodes couldn\u2019t be loaded right now. Check back soon.</li>';
    });
}

function renderEpisode(item) {
  var title = textOf(item, "title") || "Untitled episode";
  var link = textOf(item, "link") || "#";
  var pubDate = textOf(item, "pubDate");
  var description = stripHtml(textOf(item, "description") || "");
  var image = findImage(item);

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
   episode title always produces the same graphic, so artwork
   stays stable across visits without needing to store anything.
   Not a substitute for real episode art — just a graceful
   fallback so the black background always has something to
   make the graphics "pop" against, per the brief.
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
  // Try common podcast RSS image tags in order of preference.
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
