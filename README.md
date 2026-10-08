# Quotex-style Live V6 — Render-ready

## Render deployment

This project is configured as a Node/Express web service.

Recommended Render settings:

- **Service type:** Web Service
- **Root Directory:** leave empty
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** Node

The included `render.yaml` contains the same service configuration and declares `OTCHARTS_API_KEY` as a secret environment variable.

## Environment variables

For the default provider (`otcharts`), add:

`OTCHARTS_API_KEY=YOUR_REAL_KEY`

Do not put the real API key into the ZIP or commit it to GitHub.

If using Twelve Data instead, set:

`DATA_PROVIDER=twelvedata`
`TWELVE_DATA_API_KEY=YOUR_REAL_KEY`

## What was fixed

- Added an explicit `/` route serving `public/index.html`.
- Changed static-file serving to use an absolute path based on `__dirname`, which is more reliable on Render.
- Added `render.yaml` with Render Web Service settings.
