# Frontend conventions (apps/admin)

Read this before writing a page. The style is the WIT house style: soft grey canvas, borderless
white cards, one dark ink surface, one red accent, pill controls. The full guide lives in
`~/.claude/skills/wit-ui-style/SKILL.md` and its `references/*.md`; the summary below is what
matters day to day.

## Where things live

- `packages/types/src/enums.ts` and `entities.ts`: the domain. Every union has a `*_LABEL` map
  next to it. Never hard-code a label string that a map already provides.
- `packages/fixtures/src/store.ts`: `AppState` and the reducer. Pages change data only through
  `dispatch({ type: 'entity/verb', ... })`. The action list is fixed; if an action you need is
  missing, use a generic `<collection>/upsert` with a full item and note it in your report.
- `packages/fixtures/src/derive.ts`: shared derivations (`moProgress`, `isMoDelayed`,
  `materialReadiness`, `traceBackward`, `traceForward`, `capacityByWorkCenter`, `oeeAverage`,
  `orgPath`, `shiftAt`, `groupBy`, `sumBy`). Page-local derivations go in `lib.ts` in the page folder.
- `packages/fixtures/src/format.ts`: `fmtDate`, `fmtDateShort`, `fmtTime`, `fmtDateTime`,
  `fmtWhen`, `fmtAgo`, `fmtDuration`, `fmtNumber`, `fmtPercent`, `fmtIdr`, `plural`. Never call
  `toLocaleString` in JSX.
- `packages/fixtures/src/dates.ts`: `toMs`, `toIso`, `addDays`, `addHours`, `startOfDay`,
  `dayKey`, `toDateInput`, `toDateTimeInput`, `fromInput`, `DAY`, `HOUR`, `MINUTE`.
- `apps/admin/src/state/scoped.ts`: `useScoped()` returns every collection filtered to the current
  site plus `maps.<entity>.get(id)`, name helpers (`productName`, `materialName`, `personName`,
  `orgName`, `orgPath`, `locationName`, `reasonLabel`, `uomCode`) and `dispatch`. `useNow(ms)`
  gives a ticking clock in ms. Pages never filter the raw store by site themselves.
- `apps/admin/src/auth/auth.tsx`: `useAuth()` gives `user`, `site`, `can(permission)`. Gate
  mutating buttons with `can(...)`; permissions are listed in `packages/fixtures/src/permissions.ts`.
- `apps/admin/src/components/badges.tsx`: one badge per status union (`MoStatusBadge`,
  `WoStatusBadge`, `PriorityBadge`, `WipStateBadge`, `InspectionStatusBadge`, ...). Use them.
- `apps/admin/src/components/links.tsx`: `paths.*` route builders and `MoLink`, `WoLink`,
  `ProductLink`, `MachineLink`, `PersonChip`, `PersonAvatar`.
- `apps/admin/src/components/pickers.tsx`: searchable comboboxes for every data-backed choice
  (`ProductPicker`, `MaterialPicker`, `MachinePicker`, `OperatorsPicker`, `ShiftPicker`,
  `LocationPicker`, `ReasonPicker`, `LotPicker`, `MoPicker`, ...). Plain `NativeSelect` only for
  fixed enums of six or fewer values.
- `apps/admin/src/components/create.tsx`: `useCreate().manufacturingOrder(preset)` and
  `.marketingOrder()` open the shared create dialogs.
- `apps/admin/src/lib/history-state.ts`: `useHistoryState(name, initial)` for list search and
  filters (survives Back), `useTableHistory()` to spread onto a `DataTable`.
- `apps/admin/src/lib/storage.ts`: `usePersistentState(key, initial)` for per-viewer preferences
  under `mes.admin.<thing>` keys.
- `packages/ui/src/index.ts`: the component kit. Read the barrel for names; props are typed.

## Reference pages

Copy the structure of these before inventing your own:

- `pages/dashboard/DashboardPage.tsx`: attention row, dark hero card, accent card, stat tiles,
  two list columns plus an analysis card.
- `pages/manufacturing/ManufacturingOrdersPage.tsx`: list page = `PageHeader` (title, description,
  search pill, primary button) → stat tiles → chip filters → `DataTable` with `hideBelow` columns
  and a compact status line under the title on phones.
- `pages/manufacturing/ManufacturingOrderDetailPage.tsx`: detail page = `BackButton` + actions
  row → dark hero card with big numbers → `Steps` lifecycle → `KeyValue` cards → related lists →
  history. Actions use `ActionMenu` for the overflow and `ConfirmDialog` for anything with a reason.

## Layout rules that break on phones

- Every breakpoint grid has a `grid-cols-1` base: `grid grid-cols-1 gap-4 xl:grid-cols-[...]`.
- Rows with a button on the right are `flex flex-wrap items-center justify-between gap-2`.
- No negative-margin bleed inside pages. `ChipRow` scrolls horizontally without one.
- Tables: hide secondary columns with `hideBelow`, and put the key badges in a
  `mt-1.5 flex flex-wrap gap-1.5 sm:hidden` line inside the first cell.
- Cards: `rounded-card bg-card shadow-card`, never a border. Nested rows sit on `bg-surface-2`
  with `rounded-2xl p-3`. Page body is `space-y-4`.
- One accent element per region. The next emphasis is ink (`variant="ink"`, `tone="ink"`).
- Numbers big with the unit muted beside them; identifiers in `font-mono text-xs`.
- Every button does something real (dispatch, navigate, open a dialog). Empty states carry a
  title, a one-line description and, when possible, the next action.
- Toast tones are `default | success | danger` only.

## Page checklist

1. `PageHeader` with a one-sentence description that says what the screen is for.
2. Stat tiles or a summary strip when the list is long enough to need orientation.
3. Filters as `Chip variant="filter"` in a `ChipRow`, plus `Combobox variant="inline"` for
   data-backed filters. Keep filter state in `useHistoryState` or the URL (`useSearchParams`).
4. `DataTable` with `getRowKey`, `onRowClick` to a detail or a side `Sheet`, `resetPageKey`.
5. Dialogs: one `<Entity>Dialog` component per entity, `open` prop, form inside with `FormField`,
   validation shown after the first submit (`tried` pattern), footer outline Cancel + primary Save.
6. Support deep links the rest of the app already emits (see `paths` in links.tsx and query params
   like `?view=`, `?mo=`, `?id=`, `?wo=`, `?machine=`, `?new=1`, `?receive=1`).
7. `pnpm --filter @mes/admin typecheck` clean, then `pnpm prettier --write <your folder>`.

## Prose

UI copy is plain and specific: "No inspections yet. Requests appear here when an operation with a
quality check starts." No em dashes, no exclamation marks, no filler adverbs.
