# MiyeeBooks

MiyeeBooks is a complete MSME accounting suite that runs entirely in your
browser. No server, no installation - your data lives in your browser's
localStorage / IndexedDB and can be backed up to JSON or Google Drive.

## Why the app is split into modules

The app used to ship as one ~1.2 MB `index.html` whose entire ~19,000-line React
source was compiled **in the browser on every page load** (esbuild-wasm, with a
Babel fallback that could take 60-90s). That runtime compile was the main thing
making startup slow.

Now the source lives as small modules under `src/`, and a build step
**pre-compiles the JSX ahead of time** with esbuild. The deployed page loads
plain, ready-to-run JavaScript - the browser never compiles anything.

## Project layout

```
src/
  index.html          Page shell (meta, CDN libs, <link> to styles, script slot)
  styles.css          App styles (was the inline <style> block)
  js/
    01-utils.jsx      Formatting, ids, GST state codes
    02-storage.jsx    IndexedDB + localStorage engine
    03-firebase.jsx   Firebase config & init
    04-team-access.jsx  Multi-user / team Firestore helpers
    05-csv-utils.jsx  CSV import/export helpers
    06-pdf-templates.jsx  Invoice / print HTML templates
    07-seed-data.jsx  Seed chart of accounts
    08-sample-data.jsx  Demo datasets
    09-auth.jsx       Upgrade modal, login, company selector, auth gate
    10-app.jsx        Main App shell
    11-masters.jsx    Cost centres, departments, dashboard, team
    12-accounts-parties.jsx  Chart of accounts, parties, company settings
    13-vouchers.jsx   Vouchers & voucher modal
    14-reports.jsx    Sales docs, collections, assets, cash/fund flow, etc.
    15-gst.jsx        Period close, registers, GSTR-1/3B/2B, forex
    16-finance.jsx    MSME dues, forecasts, consolidation, MIS, ratios
    17-payroll.jsx    Google Drive sync, employees, payroll, TDS
    18-help.jsx       Help guide
    19-statements-inventory.jsx  Statements, inventory, BOM, production + mount

build.mjs             Pre-compiles src/js/*.jsx -> dist/js/*.js and assembles dist/
scripts/              One-time splitter + local smoke tests (dev only)
.github/workflows/    GitHub Actions: build + deploy to Pages
```

The `js/NN-*.jsx` modules are **classic scripts** that share one global scope
(exactly like the old single file), loaded in numeric order. The numeric prefix
is the load order; the last module performs the ReactDOM mount.

## Build

```bash
npm install
npm run build      # -> dist/  (index.html, styles.css, js/*.js, og-image.svg)
npm run watch      # rebuild on change during local development
```

Serve `dist/` with any static file server to run it locally, e.g.
`npx serve dist`.

## Deployment (GitHub Pages via Actions)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes `dist/` to GitHub Pages.

**One-time setup:** in the repo, go to **Settings -> Pages -> Build and
deployment -> Source** and select **GitHub Actions**.

## Dev notes

- `dist/` and `node_modules/` are git-ignored; CI rebuilds `dist/` on deploy.
- `scripts/split-source.mjs` was the one-time migration that produced `src/`
  from the original single file; it is kept for reference.
- `scripts/smoke*.mjs` are optional local checks (need `npm i -D playwright-core`).
