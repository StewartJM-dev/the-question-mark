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
var CORS_PROXY = "https://api.codetabs.com/v1/proxy?quest=";

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
   2. A forgiving "starts with Question Mark" check — going
      forward, any episode titled starting with those two words
      gets picked up automatically, regardless of what
      punctuation follows (colon, dash, em dash, etc.). This was
      originally a strict "Question Mark: " match, but the very
      first real episode after that convention was set used a
      dash instead of a colon and got missed — so the check is
      now punctuation-agnostic on purpose.

   A given episode shows up here if EITHER condition matches.
   ========================================================= */

var FILTER_ENABLED = true;

var KNOWN_TITLES = [
  "Growing Or Going Through The Motions",
  "Are You Willing To Serve Jesus",
  "What Cant God Do?",
  "What Does Christmas Mean To You?",
  "Who Are You?",
  "How Important Is Prayer",
  "Do You Know Jesus?",
  "The Question Mark Promo",
  "The Question We're Afraid To Ask",
  "Question Mark - Our Freedom Wasn't Free - And Neither Was Our Salvation"
];

function normalizeTitle(str) {
  return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

var KNOWN_TITLES_NORMALIZED = KNOWN_TITLES.map(normalizeTitle);

function isQuestionMarkEpisode(title) {
  var norm = normalizeTitle(title);
  if (KNOWN_TITLES_NORMALIZED.indexOf(norm) !== -1) return true;
  if (/^question mark\b/.test(norm)) return true;
  return false;
}

function fetchQuestionMarkEpisodes(callback) {
  fetch(EPISODES_JSON_URL, { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("no static feed yet: " + res.status);
      return res.json();
    })
    .then(function (data) {
      callback(filterEpisodes((data && data.episodes) || []), null);
    })
    .catch(function () {
      fetchQuestionMarkEpisodesLive(callback);
    });
}

function fetchQuestionMarkEpisodesLive(callback) {
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
          audio: findAudio(item),
        };
      });

      callback(filterEpisodes(episodes), null);
    })
    .catch(function (err) {
      console.error(err);
      callback([], err);
    });
}

function filterEpisodes(episodes) {
  if (!FILTER_ENABLED) return episodes;
  return episodes.filter(function (ep) {
    return isQuestionMarkEpisode(ep.title);
  });
}

function loadEpisodes(opts) {
  var target = document.querySelector(opts.target);
  if (!target) return;

  fetchQuestionMarkEpisodes(function (episodes) {
    renderList(target, episodes, opts);
  });
}

function renderEpisode(ep) {
  var title = ep.title || "Untitled episode";
  var link = ep.link || "#";
  var pubDate = ep.pubDate || "";
  var description = ep.description || "";
  var image = ep.image || null;
  var audio = ep.audio || "";

  var artInner = image
    ? '<img src="' + escapeAttr(image) + '" alt="" loading="lazy">'
    : generateArt(title);

  if (audio) {
    // Playable inline via the site's own mini-player — no navigating away.
    return (
      '<li>' +
        '<div class="featured-player episode-playable" data-audio="' + escapeAttr(audio) + '" ' +
          'data-title="' + escapeAttr(title) + '" data-art="' + escapeAttr(image || "") + '" ' +
          'role="button" tabindex="0" aria-label="Play ' + escapeAttr(title) + '">' +
          '<div class="fp-art">' + artInner +
            '<span class="episode-play-icon fp-play-icon" aria-hidden="true">&#9658;</span>' +
          '</div>' +
          '<div class="fp-info">' +
            '<span class="fp-date">' + formatDate(pubDate) + '</span>' +
            '<h2 class="fp-title">' + escapeHtml(title) + '</h2>' +
            '<p class="fp-desc">' + escapeHtml(description) + '</p>' +
            '<span class="fp-cta">&#9658; Play Episode</span>' +
          '</div>' +
        '</div>' +
      '</li>'
    );
  }

  // No playable audio found for this one — fall back to the PodPoint page.
  return (
    '<li>' +
      '<a class="featured-player" href="' + escapeAttr(link) + '" target="_blank" rel="noopener">' +
        '<div class="fp-art">' + artInner + '</div>' +
        '<div class="fp-info">' +
          '<span class="fp-date">' + formatDate(pubDate) + '</span>' +
          '<h2 class="fp-title">' + escapeHtml(title) + '</h2>' +
          '<p class="fp-desc">' + escapeHtml(description) + '</p>' +
          '<span class="fp-cta">Listen on PodPoint &rarr;</span>' +
        '</div>' +
      '</a>' +
    '</li>'
  );
}

function renderList(target, episodes, opts) {
  if (opts.limit) episodes = episodes.slice(0, opts.limit);

  if (!episodes.length) {
    target.innerHTML = '<li class="feed-status">No episodes found in the feed yet.</li>';
    return;
  }

  target.innerHTML = episodes.map(renderEpisode).join("");

  if (opts.autoplayFirst) {
    var firstRow = target.querySelector(".episode-playable");
    if (firstRow) {
      firstRow.scrollIntoView({ behavior: "smooth", block: "center" });
      playEpisodeFromRow(firstRow);
    }
  }
}

/* =========================================================
   Mini-player
   =========================================================
   A small, persistent player that stays fixed at the bottom of
   the screen once an episode starts, so people can keep browsing
   the list without losing playback — no PodPoint redirect, no
   full-page takeover. Only one episode plays at a time; tapping
   another row switches to it automatically.
   ========================================================= */

var miniPlayer = { row: null, audioEl: null };

/* Some browsers (especially iOS Safari) block audio.play() if it isn't
   triggered by a direct, immediate user gesture — which can happen even
   here, since the actual tap happened on the previous page (the homepage
   tile) before this one loaded. If that happens, play() just quietly
   fails rather than erroring — the mini-player still shows up ready to
   go, so one more tap starts it normally. */
function safePlay(audio) {
  var p = audio.play();
  if (p && typeof p.catch === "function") {
    p.catch(function () {
      /* Autoplay blocked — player is loaded and visible, ready for a tap. */
    });
  }
}

function ensureMiniPlayer() {
  if (document.getElementById("mini-player")) return;

  var el = document.createElement("div");
  el.id = "mini-player";
  el.className = "mini-player";
  el.hidden = true;
  el.innerHTML =
    '<div class="mp-art" id="mp-art"></div>' +
    '<div class="mp-info">' +
      '<div class="mp-title" id="mp-title"></div>' +
      '<div class="mp-progress"><div class="mp-progress-bar" id="mp-progress-bar"></div></div>' +
    "</div>" +
    '<button type="button" class="mp-toggle" id="mp-toggle" aria-label="Play or pause">&#9658;</button>' +
    '<button type="button" class="mp-close" id="mp-close" aria-label="Close player">&times;</button>';
  document.body.appendChild(el);

  var audio = document.createElement("audio");
  audio.id = "mini-player-audio";
  audio.preload = "none";
  document.body.appendChild(audio);
  miniPlayer.audioEl = audio;

  document.getElementById("mp-toggle").addEventListener("click", function () {
    if (audio.paused) safePlay(audio);
    else audio.pause();
  });

  document.getElementById("mp-close").addEventListener("click", function () {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    el.hidden = true;
    document.body.classList.remove("has-mini-player");
    setActiveRow(null);
  });

  audio.addEventListener("play", function () {
    document.getElementById("mp-toggle").innerHTML = "&#10074;&#10074;";
    if (miniPlayer.row) setRowIcon(miniPlayer.row, true);
  });

  audio.addEventListener("pause", function () {
    document.getElementById("mp-toggle").innerHTML = "&#9658;";
    if (miniPlayer.row) setRowIcon(miniPlayer.row, false);
  });

  audio.addEventListener("timeupdate", function () {
    if (audio.duration) {
      var pct = (audio.currentTime / audio.duration) * 100;
      document.getElementById("mp-progress-bar").style.width = pct + "%";
    }
  });

  audio.addEventListener("ended", function () {
    setActiveRow(null);
    el.hidden = true;
    document.body.classList.remove("has-mini-player");
  });
}

function setRowIcon(row, isPlaying) {
  var icon = row.querySelector(".episode-play-icon");
  if (icon) icon.innerHTML = isPlaying ? "&#10074;&#10074;" : "&#9658;";
}

function setActiveRow(row) {
  var prev = miniPlayer.row;
  if (prev && prev !== row) {
    prev.classList.remove("episode-active");
    setRowIcon(prev, false);
  }
  miniPlayer.row = row;
  if (row) row.classList.add("episode-active");
}

function playEpisodeFromRow(row) {
  ensureMiniPlayer();
  var audio = miniPlayer.audioEl;
  var player = document.getElementById("mini-player");
  var audioUrl = row.getAttribute("data-audio");
  var title = row.getAttribute("data-title");
  var art = row.getAttribute("data-art");

  if (miniPlayer.row === row) {
    // Same episode tapped again — just toggle play/pause.
    if (audio.paused) safePlay(audio);
    else audio.pause();
    return;
  }

  audio.src = audioUrl;
  safePlay(audio);
  player.hidden = false;
  document.body.classList.add("has-mini-player");

  document.getElementById("mp-title").textContent = title;

  var artEl = document.getElementById("mp-art");
  artEl.innerHTML = "";
  if (art) {
    var img = document.createElement("img");
    img.src = art;
    img.alt = "";
    artEl.appendChild(img);
  } else {
    artEl.innerHTML = generateArt(title);
  }

  setActiveRow(row);
}

document.addEventListener("click", function (e) {
  var row = e.target.closest && e.target.closest(".episode-playable");
  if (!row) return;
  e.preventDefault();
  playEpisodeFromRow(row);
});

document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  var row = e.target.closest && e.target.closest(".episode-playable");
  if (!row) return;
  e.preventDefault();
  playEpisodeFromRow(row);
});

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

function findAudio(item) {
  var enclosure = item.querySelector("enclosure[type^='audio']");
  if (enclosure) return enclosure.getAttribute("url");
  return null;
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
