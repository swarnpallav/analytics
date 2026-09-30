# NavAIgate

Visualise funnels and user journeys from the analytics events your website already fires.

## What it does

- **Funnel**: pick events or pages as ordered steps; see conversion and drop-off per user (or per session).
- **Journey Graph / Timeline**: replay one user's or session's event sequence, optionally grouped by page.
- **Insights**: event distribution, activity by hour, engagement per user.

## Getting data in

Any of these work; the event, page, timestamp, user and session fields are detected automatically and can be
remapped on the Import tab. None of them needs a server.

- **Record a session (recommended)**: on the Import tab, enter a page address and click "Open site to record". In the
  tab that opens, paste the console snippet into DevTools (Chrome may ask you to type `allow pasting` first). It
  records page views (including SPA navigations) and the events the site already sends through GTM/gtag
  (`dataLayer`), Segment and Mixpanel, with an anonymous visitor ID and a 30-minute session ID. Custom events:
  `window.navaigate.track('signup_clicked', { plan: 'pro' })`.
  - Events go straight back to the dashboard tab with `window.opener.postMessage` and are kept in this browser's
    IndexedDB, so they survive a dashboard reload and never leave the machine. Keep the dashboard tab open while
    recording. "Export JSON" saves them to share; a teammate loads the file with Upload.
  - A full page reload in the recording tab stops recording; paste again, or save the snippet under
    Sources → Snippets to re-run it quickly.
  - A site that sends `Cross-Origin-Opener-Policy: same-origin` cuts the link between the two tabs, so it can't be
    recorded this way; the console says "not connected to NavAIgate" when that happens.
  - "Use the test page" opens `collector-test.html`, a small shop that records without pasting anything.
- **Upload / paste** a JSON, NDJSON or CSV export. Segment, GA4 (BigQuery), Mixpanel, Amplitude and GTM
  `dataLayer` shapes are recognised; so is any flat `{ event, userId, timestamp, page }` style.
- **Demo data**: a synthetic e-commerce dataset (`public/demo-events.json`).

## Getting started

```bash
npm install
npm run dev:client   # the dashboard on :5173; all you need to record and analyse
npm run build        # static files in dist/ (including collector.js); host them anywhere
```

## Optional server

`server.js` (`npm run dev` starts it alongside the dashboard on :8787) is only needed for the AI features and the
server-side collection below. The dashboard no longer reads from it.

- **Script tag**: `<script async src="https://YOUR-NAVAIGATE-HOST/collector.js"></script>` POSTs visitors' events to
  `/api/events` (attributes: `data-site`, `data-endpoint`, `data-pageviews="false"`, `data-debug="true"`,
  `data-team`, `data-recorder`). Also `POST /api/events` with one event, an array or `{ "events": [...] }`.
- **Teams and recorders**: `GET /api/events?recorder=<id>` or `?team=<name>` filters the stream; `DELETE
  /api/events?recorder=<id>` removes one recorder's events, and clearing everything needs `ADMIN_TOKEN` in `.env` sent
  as the `X-Admin-Token` header. Events without a team are assigned by page path using `config/teams.json` (paths
  shipped there are placeholders); `GET`/`POST /api/teams` list and add teams (`datasets/meta/teams.json`). None of
  this is authenticated.
- **Saved datasets**: JSON files in `datasets/` show up under "Load saved dataset".

## AI features

Chat, voice and AI insights are disabled by default. To enable them, set `ENABLE_AI=true`,
`VITE_ENABLE_AI=true` and `OPENAI_API_KEY` in `.env` (see `env.example`), and run the optional server.

## Development

```bash
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```
