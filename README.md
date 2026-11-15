# Pace Rooms

A small web app for exploring **MCSR Ranked private room matches**, sorted by the player's own pace — not the room winner's time.

![Tech](https://img.shields.io/badge/React-19-blue) ![Tech](https://img.shields.io/badge/Vite-8-purple) ![Tech](https://img.shields.io/badge/TypeScript-strict-blue)

## Why it exists

Ranked matches on [MCSR Ranked](https://mcsrranked.com) record a fastest time for each player, so leaderboards and pace tracking work out of the box. **Private rooms do not** — the only built-in way to find your private pace is opening your matches one by one and reading the timelines by hand.

This app automates that. It pulls a player's private matches (match type `3`) from the public MCSR Ranked API, keeps categories like Any%, All Advancements, and Kill Wither apart, and can read each match's split timeline to build a pace report for Any% runs.

## Features

**Matches tab**

- Full private match history per season, with a season picker (current + past seasons)
- Filter by category and room mode (Standard / Scout / Most%)
- Sort by your own finish times: fastest, slowest, newest, oldest
- Resets, DNFs ("won by someone else"), PB highlight, and per-match rank in your filtered set
- Direct links to each match on `mcsrranked.com/stats` and to VODs when available

**Analysis tab (Any% pace report)**

- Average / median / fastest / slowest finish across your private Any% runs
- Per-split breakdown (Overworld → Bastion → Fortress → Blind → Stronghold → End → Finish): average split, average leg, fastest split, and the splits of your fastest run
- Finish-time distribution buckets
- Optional inclusion of scout-route rooms

**Data handling**

- Match timelines are fetched one request per match, with 4 concurrent workers
- The API rate limit is 500 requests / 10 minutes — when it's hit, the app keeps every timeline already loaded and lets you continue later
- Timelines already fetched are cached in your browser (`localStorage`, capped at 700 entries) so revisits are instant; a "Forget saved timelines" button clears the cache
- All URL state (player, season, filters, sort, tab) is shareable via the address bar

## Getting started

Requires [Node.js](https://nodejs.org) 18+.

```bash
# install dependencies
npm install

# start the dev server
npm run dev
```

Then open <http://localhost:5173> in your browser, type a Minecraft name into the search box, and pick a season.

### Other scripts

```bash
# type-check (tsc --noEmit) and build for production into dist/
npm run build

# locally preview the production build
npm run preview
```

## Project structure

```
src/
  main.tsx        # entry point
  App.tsx         # layout, search, season picker, URL state, data loading
  MatchBoard.tsx  # match table with filters, sorting, pagination
  PacePanel.tsx   # Any% pace report and timeline loading
  api.ts          # MCSR Ranked API client (paginated fetch, concurrency, rate-limit handling)
  stats.ts        # sorting, summaries, and pace math
  format.ts       # time/date formatting, category labels, link builders
  cache.ts        # localStorage cache for fetched timelines
  types.ts        # shared types
  constants.ts    # API base, page size, current season
```

## Notes

- Data comes from the public MCSR Ranked API (`api.mcsrranked.com`). This project is not affiliated with MCSR Ranked.
- When a new ranked season starts, bump `CURRENT_SEASON` in `src/constants.ts`.
- Match detail pages on the stats site use the `/stats/{player}/{matchId}` URL format.
