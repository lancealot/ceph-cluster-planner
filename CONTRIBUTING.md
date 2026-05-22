# Contributing

Thanks for considering a contribution. This is a small static tool with a tight contract; the gates below are how we keep regressions out.

## Before you start

- Open an issue describing the change before non-trivial PRs — especially anything that touches `src/calc/`, validation thresholds, or the data model.
- Small, focused PRs land faster than sweeping refactors.

## Development loop

```bash
npm install
npm run dev
npm run typecheck
npm run test:ci
npm run build
```

Every PR must pass `typecheck`, `test:ci`, and `build`. CI runs all three before deploy.

## Adding a component to the seed library

1. Edit `src/data/components.json`. Use a stable `id` (vendor + model + key spec); other code references it.
2. Fill in all required fields for the category — see `src/types/components.ts` for the discriminated union.
3. Set `as_of_date` to the date you pulled the price (the freshness chip will go yellow at 90 days, red at 180).
4. Run `npm run test:ci` — schema and existing fixtures should still pass.
5. If the new component changes what the SC846 reference fixture references (`src/calc/fixtures/sc846.ts`), update tests so pinned values still hold.

## Adding a validation rule

1. Add a function (or extend an existing one) in `src/calc/validation.ts` (node-level) or `src/calc/clusterValidation.ts` (pool/cluster-level).
2. Define any numeric thresholds as exported `const` so tests reference them by name, not literal — see `CORES_PER_OSD_NVME_THRESHOLD`, `DB_WAL_RATIO_LOW/HIGH`.
3. Add tests in the matching `*.test.ts` covering both the firing case and the boundary case. Boundary inclusivity matters: the DB/WAL rule is `< 0.01 || > 0.04`, so 1.00 % and 4.00 % themselves are silent.
4. Pick a stable `code` (`scope.thing_specifics`) — the WarningsDrawer dedupes and filters by code.
5. Document severity intent in the test (`expect(w?.severity).toBe('warning')`).

## Style

- No comments in code unless the WHY is non-obvious. Don't paraphrase what the code already says.
- No backwards-compat shims; this is a new project. Delete unused code rather than commenting it out.
- Pure calc stays pure. UI components don't reach into `calc/` for IO or React state.
- Validation rules return data, not side effects. UI rendering of issues is the WarningsList/Drawer's job.

## Releasing

Push to `main`. The `Deploy to GitHub Pages` workflow runs typecheck → test → build → deploy. First-time setup: **Settings → Pages → Source: GitHub Actions** (without this, the workflow is green but nothing publishes).
