# PSX Personal Assistant

*Shares Aapke. Hisaab Hamara.* A personal record-keeper for Pakistan Stock Exchange investors, in English and Roman Urdu.

Live: https://psx-pilot.netlify.app

## What it does

- Portfolio with weighted-average cost, profit/loss, dividends and cash
- Entries by typing, by voice (in-app mic) or from a broker screenshot (screenshot reading works inside claude.ai)
- Your own current prices per share, so the portfolio value is real; demo prices fill in only where you haven't entered one
- Dividend assistant, reminders (exportable to your phone calendar), monthly account, tax-year report, broker statement match, charges check, WhatsApp tip checker
- Free account (email + password) that saves everything and syncs across devices
- Installable as a phone app, opens offline

Prices shown as "demo" and announcements shown as "sample" are not real PSX data. A licensed PSX data feed is needed for live prices.

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

## Accounts and data

Accounts and synced data live in the Supabase project `psx-assistant` (table `public.user_state`, one row per user, row-level security so each user can only read and write their own row). The publishable key in the page is meant to be public; the rules protect the data.

In Supabase → Authentication → URL Configuration, set **Site URL** to `https://psx-pilot.netlify.app` so confirmation and password-reset emails return to the site.
