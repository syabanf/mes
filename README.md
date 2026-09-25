# Manufacturing Operations Platform (MES) frontend

Frontend for the Manufacturing Operations Platform described in `docs/blueprint-v1.1.md`: master
data, PLM (BOM / BOR / BOP), marketing and demand, MTO / MTS fulfillment, manufacturing orders,
work order dispatch, shop floor execution, manufacturing inventory, WIP, quality, traceability,
planning, analytics, intelligence and closed-loop optimization (roadmap phases 20 to 22), and
the context layer for the existing OEE, Device Monitoring and CMMS systems.

The app runs on a seeded in-browser dataset (two sites of a precious-metal bar manufacturer) so
every screen works without a backend. Changes persist in the browser until you sign out and reset.

## Run

```bash
pnpm install
pnpm gen:fixtures   # regenerate the seed JSON (deterministic)
pnpm dev:admin      # http://localhost:5373
```

Sign in with any demo account on the login page. Roles gate what each account can do.

## Layout

```
apps/admin            desktop-first console (Vite + React 19 + Tailwind v4 + react-router 7)
apps/mobile           operator phone PWA (same stack plus vite-plugin-pwa)
packages/types        domain model: enums with label maps, entities
packages/fixtures     seed loader, single reducer store, formatters, shared derivations
packages/ui           component kit in the WIT house style
packages/tailwind-config  semantic colour tokens
scripts/              seeded fixture generator
docs/                 blueprint and frontend conventions
```

Dependencies only point downward: `apps → ui / fixtures → types`.

## Mobile operator app

`apps/mobile` is the phone PWA for the line (blueprint phase 8): an operator scans a badge, picks up
the operations dispatched to them or to their work centers, starts and pauses them, records output,
consumes material by lot, requests and records inspections, reads the frozen work instruction and
sees holds, pauses and machine alarms. Every action goes through the same reducer as the console,
stamped with the operator id, so the production history shows who did what.

```bash
pnpm dev:mobile       # http://localhost:5374
pnpm preview:mobile   # serves the built PWA on http://localhost:4374
```

Sign in with the PIN keypad (a badge number or its last four digits, listed on the login screen) or
"Simulate scan" with any operator. The app keeps its own copy of the dataset under `mes.mobile.*`
in browser storage; "Reset demo data" on the More screen drops it. Installed to a home screen it
works offline on the cached app shell.

## Conventions

See `docs/frontend-conventions.md` before adding a page. In short: pages compose data from
`useScoped()`, change it only through `dispatch({ type: 'entity/verb' })`, use the badge, link and
picker components in `apps/admin/src/components`, and keep every grid phone-safe.

## Checks

```bash
pnpm typecheck   # every package and app, plus the generator
pnpm lint        # ESLint: typescript-eslint, react-hooks
pnpm test        # reducer and journey tests (node:test)
pnpm build       # admin and mobile
pnpm format
```

CI runs the same set on every push and pull request, and fails if regenerating the seed changes
any file under `packages/fixtures/data`.
