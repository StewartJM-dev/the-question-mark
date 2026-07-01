# The Question Mark Podcast — site

Static site for The Question Mark Podcast (Gordon Conger, LWBC Media Outreach).
Pure HTML/CSS/JS, no build step, no frameworks — deploys straight to GitHub Pages.

## Pages
- `index.html` — Home
- `about.html` — About
- `episodes.html` — Episodes (auto-pulled from RSS)
- `submit.html` — Submit a Question (opens email to thequestionmarkpodcast@yahoo.com)
- `subscribe.html` — Subscribe (platform links)

## Still needed before this goes live

1. **RSS feed — found, but with a caveat.** The feed is set:
   `https://podpoint.com/feed/12205`

   Here's the catch: "The Question Mark" turns out to be a *series* inside
   Gordon's broader PodPoint channel, **LWBC Let's Connect** — not its own
   top-level PodPoint show. That channel also carries Pastor Raymond Purdy's
   regular Sunday sermons. So this feed URL currently pulls in *everything*
   from LWBC Let's Connect, not just Gordon's Question Mark episodes.

   Three ways to handle this, worth discussing with Gordon:
   - **Simplest:** leave it as-is for now — the Episodes page shows the
     full LWBC Let's Connect feed. Not ideal for a dedicated Question Mark
     site, but it's live and accurate.
   - **Ask PodPoint/Gordon** whether "The Question Mark" can become its own
     top-level channel with its own feed (cleanest long-term fix).
   - **Client-side filter (stopgap):** `js/episodes.js` has a
     `FILTER_SERIES_TITLE` variable. Setting it to `"The Question Mark"`
     will filter episodes by their RSS `<category>` tag — but I haven't
     been able to confirm PodPoint actually tags episodes that way in the
     feed itself (couldn't retrieve the raw XML to check). Worth testing
     once the feed is live in a browser — if the filter doesn't catch
     anything, that tag isn't how PodPoint marks series in the feed.

2. **Logo — done.** Both files you sent are in `/images/`:
   - `question-mark-logo.jpg` (the show badge — lion/cross mark) is now used
     as the header icon on every page, the hero brand mark on the homepage,
     and the site favicon.
   - `lwbc-media-ministry-logo.jpg` appears as a small badge in the footer,
     next to the LWBC credit line.

   One naming note: your logo files say "LWBC Connections Podcast" and
   "LWBC Media Ministry" — different from "LWBC Media Outreach," which is
   what the original brief used. I went with the logos' wording throughout
   (footer credit now reads "part of the LWBC Media Ministry"), since a
   logo file is likely more current than a verbal description — but flag
   if that's wrong and I'll switch it back.

3. **About copy.** `about.html` has a placeholder paragraph marked `[About
   copy goes here]` — paste Gordon's paragraph(s) in and I'll drop it in
   (each paragraph as its own `<p>` to match the site's rhythm).

4. **Gordon's headshot (optional).** `about.html` references
   `/images/gordon-conger.jpg`. If that file doesn't exist it just hides
   gracefully — no broken image icon.

5. **Subscribe platform links.** `subscribe.html` has placeholder `href="#"`
   links for Apple Podcasts, Spotify, YouTube, and Amazon Music. Once the
   show is submitted to each directory (which happens via the PodPoint RSS
   feed), swap in the real links.

6. **Episode artwork.** Per the brief, episode art is the only color on the
   site. The RSS loader pulls artwork automatically from each episode's
   `itunes:image` tag if PodPoint sets one — no manual work needed there,
   assuming Gordon uploads square cover art per episode in PodPoint.

## How the episode feed works

`js/episodes.js` fetches the RSS feed client-side and renders it into
`episodes.html` and the "Latest episodes" section on `index.html`. Since
GitHub Pages is static, there's no server to do this ahead of time — it
happens live in the visitor's browser.

Most podcast hosts don't set CORS headers on their feed, which blocks a
browser from fetching it cross-domain. To work around that, the script
routes the feed through a free CORS proxy (`api.allorigins.win`) by
default. If PodPoint's feed happens to support CORS directly, set
`USE_CORS_PROXY = false` in `episodes.js` — one less moving part.

## The submission form

GitHub Pages can't run server code, so `submit.html` currently opens the
visitor's email app with a pre-filled message to
`thequestionmarkpodcast@yahoo.com`. That works with zero setup, but:

- It needs an email client configured on the visitor's device.
- `thequestionmarkpodcast@yahoo.com` needs to actually exist — it wasn't
  created yet as of this build.

Optional upgrade later: a free [Formspree](https://formspree.io) account
would let the form submit silently in-page instead of opening email. Details
are in a comment at the top of `submit.html`.

## Deploying

1. Create the repo `the-question-mark` under `StewartJM-dev` on GitHub.
2. Push these files to the `main` branch.
3. In repo Settings → Pages, set source to `main` / root.
4. Site will publish at `https://stewartjm-dev.github.io/the-question-mark/`.

## Footer / credit

Every page footer reads:
> The Question Mark Podcast is part of the LWBC Media Outreach.
> Built by Covenant Creation & Design.

Both link out per the brief (LWBC Facebook page, and your CC&D portfolio site).
