# Wandura Toolkit

Two free tools for the Wandura AI community, in one mobile-first page.

- **Credit Planner**: pick a plan or type your balance, add shots per model, and see total credits, credits left and how many clips each plan covers. Every price is read from wandura.ai with its source page and date (`site/data/prices.json`).
- **Weekly Challenge Kit**: turns the weekly film challenge brief into a 30s 9:16 shot list with Cinema Studio settings, a copy-ready prompt per shot, a cast line, a rules checklist and a credit estimate.

Static site, no build step. Deploy on Vercel with the defaults (vercel.json serves `site/`).

Tests: `node --test test/`

by [@iamlogtun](https://x.com/iamlogtun)
