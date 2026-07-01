/* =========================================================
   The Question Mark Podcast — episode feed loader
   =========================================================
   Episodes are read from data/episodes.json — a plain JSON
   file kept in this repo, refreshed automatically every few
   hours by a GitHub Action (.github/workflows/update-episodes.yml)
   that fetches PodPoint's RSS feed server-side and commits the
   result.

   Why not fetch the RSS feed directly in the browser? PodPoint's
   feed doesn't send CORS headers, so a browser can't read it
   cross-domain without going through a third-party CORS proxy —
   and free public proxies are rate-limited and unreliable
   (confirmed firsthand: the one this site used before got rate
   limited and started failing silently). Reading a same-origin
   JSON file avoids that entirely — no proxy, no CORS, no flaky
   third party in the loop.

   To manually refresh right now instead of waiting for the
   schedule: GitHub repo → Actions tab → "Update episode feed" →
   Run workflow.
   ========================================================= */

var EPISODES_JSON_URL = "data/episodes.json";

// NOTE: this feed currently returns ALL episodes of the "LWBC Let's Connect"
// channel, not just The Question Mark. "The Question Mark" is a series
// inside that channel, not its own top-level PodPoint show — so Pastor
// Purdy's Sunday sermons will show up here too unless PodPoint offers a
// series-only feed URL. Worth asking Gordon about a dedicated channel,
// or filtering here client-side (see FILTER_SERIES_TITLE below).
var FILTER_SERIES_TITLE = ""; // e.g. "The Question Mark" — leave blank to show everything in the feed

function loadEpisodes(opts) {
  var target = document.querySelector(opts.target);
  if (!target) return;

  fetch(EPISODES_JSON_URL, { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("episodes.json request failed: " + res.status);
      return res.json();
    })
    .then(function (data) {
      var episodes = (data && data.episodes) || [];

      if (FILTER_SERIES_TITLE) {
        episodes = episodes.filter(function (ep) {
          return (ep.category || "").trim().toLowerCase() === FILTER_SERIES_TITLE.toLowerCase();
        });
      }

      if (opts.limit) episodes = episodes.slice(0, opts.limit);

      if (!episodes.length) {
        target.innerHTML = '<li class="feed-status">No episodes found in the feed yet.</li>';
        return;
      }

      target.innerHTML = episodes.map(renderEpisode).join("");
    })
    .catch(function (err) {
      console.error(err);
      target.innerHTML =
        '<li class="feed-status">Episodes couldn\u2019t be loaded right now. Check back soon.</li>';
    });
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

function formatDate(dateStr) {
  if (!dateStr) return "";
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}
