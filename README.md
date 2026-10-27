# PSX Personal Assistant

*Your shares. Our accounts.* A personal record-keeper for Pakistan Stock Exchange investors.

Live: https://psx-pilot.netlify.app

## What it does

- Portfolio with weighted-average cost, profit/loss, dividends and cash
- Entries through a simple form
- Your own current prices per share, so the portfolio value is real; demo prices fill in only where you haven't entered one
- Dividend assistant, reminders (exportable to your phone calendar), monthly account, tax-year report, broker statement match, charges check, WhatsApp tip checker
- Installable as a phone app, opens offline

Prices shown as "demo" and announcements shown as "sample" are not real PSX data.

## Automatic closing prices

Every weekday the database fetches end-of-day closing prices for every share Zahid holds from EODHD (licensed market data, free plan: 20 calls/day, one call per share). `public._psx_auto_prices()` runs from pg_cron at 13:00 and 17:00 UTC Mon–Fri and 05:00 UTC Saturday, skips shares already updated that day, and writes `prices` + the daily `log` into the `_shared` row (`by: "auto"`). The token is kept in Supabase Vault as `eodhd_key`. Screenshot / paste on the Prices page stays as a manual fallback.

## Layout

| Path | What |
| --- | --- |
| `app/index.html` | The whole app: one self-contained page (engine + UI) |
| `scripts/build.mjs` | Builds `site/index.html` from the app, adds metadata, versions the service worker |
| `scripts/sw.template.js` | Service worker source |
| `site/` | What Netlify publishes: built page, icons, share image, manifest, privacy page |
| `tests/` | Engine tests (`npm test`) |

## Develop

```
npm test        # engine tests
npm run build   # writes site/index.html and site/sw.js
```

Netlify runs both on every push to `main`; a failing test stops the deploy.

## Data

On the website the app is a private one-person portfolio (Zahid, `SOLO` in the code). It opens only with the secret link (`/?k=<secret>`); the secret is remembered on each device and removed from the address bar, and the lock page lets you paste the link (needed once for a home-screen icon). Earlier family rows (Tahira, Javeria) are kept in the database but not shown.

Data lives in the Supabase project `psx-assistant`: `public.family` (members + sha256 of the secret) and `public.family_state` (one row per member plus `_shared` for prices). Tables have no direct access; the page calls the functions `psx_load`, `psx_save` and `psx_prices`, which check the secret first. To issue a new link, generate a new secret and update `family.key_hash`.

Inside claude.ai the same page stays a one-person app using Claude's private storage, with its AI helpers.
