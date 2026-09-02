# Daybook

A year of days, one square at a time. Tap a square to log it; the colour is the record.
No account, no server — everything lives in the browser storage of the phone that drew it.

## The four levels

The grid keeps its shape all the way down; only what a *row* means changes, and the
closer you get, the more categories are on screen at once.

| Level | Columns | Rows | Categories shown |
|-------|---------|------|------------------|
| Year  | 12 months | days 1–31 | one — the selected tab |
| Month | weeks | Sun–Sat | all, stacked as bands in each day |
| Week  | 7 days | **categories** | all, one cell each |
| Day   | — | categories | all, with exact numbers and notes |

Move between them with the Year / Month / Week / Day switcher, or drill in by tapping a
column header — a month letter, a week number, a day. The arrows step within the current
level (a year, a month, a week, a day) and stop at today.

**Tap** logs. In Year and Month a tap logs the *selected* category; in Week each cell is
one category on one day, so a tap logs exactly that. **Hold** opens the detail sheet.

## Categories

Drinks, Move, Steps, Reading, Tidy, Mind, Fuel — plus any you add yourself. Each owns its
own colour ramp and its own idea of a good day, so the streak counter means something
different (and correct) on every tab.

## Layout

    design/prototype.html    the design review / clickable mockup
    app/                     the real app (this is what you install)
      index.html
      app.js
      sw.js                  service worker — makes it work offline
      manifest.webmanifest
      icons/

## Run it locally

    cd app && python3 -m http.server 8000

Then open http://localhost:8000 — service workers are allowed on localhost.

## Put it on your iPhone

The app needs to be on an HTTPS URL before iOS will install it properly.
Any of these work; all are free.

### Option A — Surge (fastest, one command)

    npx surge ./app

First run asks for an email and password and makes the account there and then.
It prints a URL like `https://something.surge.sh`. To pick your own name:

    npx surge ./app your-name-daybook.surge.sh

Re-run the same command to publish an update.

### Option B — GitHub Pages

1. Make an empty repo on github.com.
2. From this folder:

        git init && git add . && git commit -m "Daybook"
        git branch -M main
        git remote add origin https://github.com/YOU/YOUR-REPO.git
        git push -u origin main

3. Repo → Settings → Pages → Source: `main`, folder `/ (root)`.
4. Your URL is `https://YOU.github.io/YOUR-REPO/app/`.

### Then, on the phone

1. Open the URL **in Safari** (not Chrome — Safari is the one that installs a real
   standalone app on iOS).
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open it from the home screen icon. It runs fullscreen with no browser chrome,
   and works with no signal.

## Backups matter here

There is no account, so nothing is recoverable if the phone is lost or the browser
storage is cleared. Settings → Your data → **Export a backup** writes a single JSON
file with everything in it; **Restore from a backup** reads one back. Do it
occasionally.

## Updating the app

Edit the files, re-deploy, then reopen the app. The service worker caches the shell,
so bump `CACHE` in `app/sw.js` (`daybook-v1` → `daybook-v2`) whenever you change
`index.html` or `app.js`, or the phone may keep serving the old version.

## Known limits of the web-app route

- **No Apple Health.** Steps and reading minutes are entered by hand; a web app cannot read HealthKit.
- **No home screen widget.**
- **Notifications** need iOS 16.4+ and only work once it is installed to the home screen.

All three of those need a native app — see the notes on the Expo/App Store route.
