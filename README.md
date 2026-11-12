# Wandura Toolkit

Two free tools for the Wandura AI community, in one mobile-first page.

- **Credit Planner**: pick a plan or type your balance, add shots per model, and see total credits, credits left and how many clips each plan covers. Every price is read from wandura.ai with its source page and date (`site/data/prices.json`).
- **Weekly Challenge Kit**: turns the weekly film challenge brief into a 30s 9:16 shot list with Cinema Studio settings, a copy-ready prompt per shot, a cast line, a rules checklist and a credit estimate.

Static site, no build step. Deploy on Vercel with the defaults (vercel.json serves `site/`).

## Daily auto-update

`.github/workflows/update.yml` runs every day at 06:00 UTC (and on demand from the Actions tab). It runs `scripts/update.mjs` (plain Node 20, no dependencies), which:

- re-reads every wandura.ai page a price came from, plus `/pricing`. A price is kept only if its sentence is still on the page; if Wandura changes a number in the same sentence, the new number is taken. Nothing is guessed.
- checks new `/m/` and `/im/` model pages and adds one only if it states a credit price for a model that is not already listed.
- re-reads the weekly challenge (week, theme, genre, rules, deadline) from `/contests/film-weekly-challenges`.
- keeps the old data and changes nothing if a page cannot be fetched, fewer than 70% of the prices can be confirmed, a price the presets need is missing, or no challenge is found.

Then the tests run on the new data, and the workflow commits `site/data` only when it changed. Vercel redeploys on its own. The run summary lists changed, added and dropped prices.

Run it locally: `node scripts/update.mjs` (or `--dry-run`).

Tests: `node --test`

by [@iamlogtun](https://x.com/iamlogtun)
