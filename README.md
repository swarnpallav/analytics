# NavAIgate

Visualise funnels and user journeys from the analytics events your website already fires.

## What it does

- **Funnel**: pick events or pages as ordered steps; see conversion and drop-off per user (or per session).
- **Journey Graph / Timeline**: replay one user's or session's event sequence, optionally grouped by page.
- **Insights**: event distribution, activity by hour, engagement per user.

## Getting data in

Any of these work; the event, page, timestamp, user and session fields are detected automatically and can be
remapped on the Import tab.

- **Script tag (recommended)**: add one line to your site's `<head>`:

  ```html
  <script async src="https://YOUR-NAVAIGATE-HOST/collector.js"></script>
  ```

  It records page views (including SPA navigations) and picks up events the site already sends through
  GTM/gtag (`dataLayer`), Segment and Mixpanel, with an anonymous visitor ID and a 30-minute session ID.
  Custom events: `window.navaigate.track('signup_clicked', { plan: 'pro' })`. Optional attributes:
  `data-site`, `data-endpoint`, `data-pageviews="false"`, `data-debug="true"`. Try it locally at
  `http://localhost:5173/collector-test.html`, then "Analyse live events" on the Import tab.
- **DevTools console (no site access needed)**: on the Import tab, switch to "DevTools console", copy the
  snippet, and paste it into the Console of any page (Chrome may ask you to type `allow pasting` first). It records
  the same events as the script tag, including anything already in `dataLayer`, but only in your tab, and it stops on
  a full page reload (paste again, or save it under Sources → Snippets to re-run quickly). Sites with a strict
  Content-Security-Policy `connect-src` may block sending events.
- **Upload / paste** a JSON, NDJSON or CSV export. Segment, GA4 (BigQuery), Mixpanel, Amplitude and GTM
  `dataLayer` shapes are recognised; so is any flat `{ event, userId, timestamp, page }` style.
- **Push events** to the server: `POST /api/events` with one event, an array, or `{ "events": [...] }`.
  Events are appended to the live stream (`GET /api/events`, `DELETE /api/events` to clear), which the app
  loads on startup.
- **Saved datasets**: JSON files in `datasets/` show up under "Load saved dataset".
- **Demo data**: a synthetic e-commerce dataset (`public/demo-events.json`).

## Getting started

```bash
npm install
npm run dev      # Vite client on :5173 + API server on :8787
```

## AI features

Chat, voice and AI insights are disabled by default. To enable them, set `ENABLE_AI=true`,
`VITE_ENABLE_AI=true` and `OPENAI_API_KEY` in `.env` (see `env.example`).

## Development

```bash
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```
