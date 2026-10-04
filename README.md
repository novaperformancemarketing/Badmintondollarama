# Smash Champs Dollarama

Doubles badminton round robins, a dollar a game. The app builds the schedule, takes results courtside, keeps the running tally, works out who pays who at the end, and keeps lifetime money, partner and head-to-head stats.

## How it works

- **Schedule:** players rotate partners every round. For 4, 5, 8, 9, 12, 13, 16 and 17 players (with enough courts) it uses balanced tables where everyone partners everyone exactly once. Every other group size gets a searched schedule that rotates sit-outs fairly and avoids repeat partners. Late arrivals and early leavers rebuild only the upcoming rounds.
- **Money:** each game, both winners get the stake and both losers pay it. At the end, settle-up lists the fewest payments that clear everyone.
- **History:** lifetime stats only count finished sessions. A session can be reopened to fix a result.

## Run locally

```bash
npm install
npm run dev
```

With no `DATABASE_URL`, the app uses an embedded PGlite database in `.data/`, so there is nothing else to set up.

```bash
npm test          # scheduler, settle-up and stats tests
npm run lint
npm run typecheck
```

## Deploy on Vercel

1. Import this repository into Vercel (Next.js is detected automatically).
2. In the project, open **Storage → Create Database → Neon (Postgres)** and connect it. This sets `DATABASE_URL`.
3. Add an environment variable **`APP_PASSCODE`** with the group passcode. Leave it out to make the app open to anyone with the link.
4. Deploy. `npm run build` applies the database migrations before building.

## Changing the database

Edit `src/db/schema.ts`, then run `npm run db:generate` and commit the new file in `drizzle/`. It is applied on the next deploy (and automatically on local dev).
