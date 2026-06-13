# Ceph Cluster Planner

**Live site → https://lancealot.github.io/ceph-cluster-planner/**

Static, browser-based sizing and costing tool for Ceph clusters. Build configurations bottom-up — pick chassis and parts, assemble nodes into racks, then assemble racks into a cluster with pools — and watch every derived value (raw vs usable capacity, $/TB, kW, $/TB usable, W/TB usable) update live, with validation rules that flag the common pitfalls.

All computation is client-side. There is no backend.

## Quickstart

Requires Node 20 (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173/ceph-cluster-planner/
npm run typecheck
npm test           # watch mode
npm run test:ci    # one-shot
npm run build      # production bundle into dist/
```

## Using the planner

The app is a numbered pipeline — work the stages left to right.

1. **Components** — start here. Category sidebar plus a live search across vendor / model / spec. Per-row freshness dot (green ≤ 3 months, amber ≤ 9, red beyond) flags pricing that should be re-checked. Click any price to edit it inline — that creates an override stored in your browser's localStorage; rows with edits get an `overridden` chip and a `*`. `+ Custom part` opens a full form for adding new parts.
2. **Nodes** — assemble a server. Stat tiles across the top show derived values (raw capacity, OSD count by class, RAM req / have, power typ / max with the N+1 PSU budget called out, PCIe slots used / available, cost). A live drive-bay map renders the chassis layout, colored by drive role: `osd` (accent), `db_wal` (violet), `metadata_osd` (green). `SC846 ref` and `+ metadata variant` buttons seed the canonical reference fixture.
3. **Racks** — drop node configs into a rack with RU and power caps. RU/power utilization meters turn warning-colored at ≥ 90 %. A binding-constraint badge tells you which limit a next-added node would hit first. The rack elevation column draws the U layout top-down, with diagonal stripes for free space.
4. **Cluster** — group racks, define pools (replicated vs EC, capacity share, failure domain, tier), tune cluster defaults (nearfull, BlueStore overhead, RAM/OSD, lanes/slot). The capacity cascade is promoted to the top of the page, showing raw → BlueStore → EC/replication → nearfull as a horizontal waterfall. `Print / Save as PDF` produces a clean printable report (prints hide the header, stepper, rail, drawer).
5. **Scenarios** — save snapshots, load any saved scenario back into the workspace, copy a share link, import/export JSON, diff any two scenarios. Each scenario embeds its own component library snapshot so prices reflect what was saved.

Across all five tabs:

- The **right rail** (or, ≤ 980 px viewport, the horizontal **summary strip**) shows live cluster outputs — hero usable PB, raw / cost / $-per-TB / power KV grid, mini capacity cascade, validation severity chips, and a contextual next-step hint.
- Clicking any severity chip opens the **issues drawer** — bottom sheet with severity filter, Esc / scrim-click dismissal, focus trapped while open.
- The active tab is mirrored in the URL hash (`#components`, `#nodes`, …) so refresh and share preserve position.
- **Share link** in the header encodes the workspace into a `#s=...` hash (base64-url, utf-8 safe); opening that link prompts before replacing the recipient's workspace.

## Reference scenario

`Load SC846 reference` (on the Scenarios tab) populates the workspace with a 30-node planning baseline — 3 racks × 10 nodes, each a Supermicro SC846 with 24 × Seagate Exos X24 24 TB HDDs, 6 × Micron 7500 PRO 3.84 TB NVMe (DB/WAL), a single EPYC 7543, 256 GB RAM, ConnectX-5 dual-port 100 GbE, 3 × LSI 9300-8i. One EC 8+3 pool, host failure domain, 75 % nearfull, 1 % BlueStore overhead. Expected: 17.28 PB raw → ~9.33 PB usable on the HDD tier. Loading it is the fastest way to see the rail, cascade, and meters with real numbers.

## Editing parts

**Per-browser overrides** — Click any price on the Components tab. Hover a row to expose Edit (the full form) and either Revert (for overrides) or Hide (tombstone a bundled part; restorable). Overrides travel with JSON exports and share links.

**Permanent updates for everyone** — Edit `src/data/components.json`. Each part has `price_usd` and an `as_of_date`; bump the date when you bump the price so the freshness dot stays honest. Commit and push to `main` and the deploy workflow ships it. `CONTRIBUTING.md` covers conventions.

## Design system

The app's visual layer is a token sheet in `src/styles/planner.css`:

- oklch color scales scoped to `[data-theme="light"]` / `[data-theme="dark"]` on `<html>`. A `--hue` CSS variable retints the whole UI (defaults to 230).
- IBM Plex Sans for UI, IBM Plex Mono with `font-variant-numeric: tabular-nums` for every number, label, and microlabel. 13 px base.
- 7 px panel radius, hairline 1 px borders, no shadows except the drawer.

The theme is persisted in `localStorage` (`ccp.v1.theme`) and seeded from `prefers-color-scheme`. An inline `<head>` script applies it before first paint to avoid a flash.

## Architecture

```
src/
  calc/                  pure derivation + validation; the math contract
    units.ts             single source of $/W/byte formatters
    node.ts              deriveNode
    rack.ts              deriveRack + validateRack
    cluster.ts           deriveCluster (tier-aware per-host counts)
    validation.ts        node-level rules (PSU N+1, HBA ports, CPU budget, …)
    clusterValidation.ts pool + cluster rules (per-tier share, failure domain)
    scenario.ts          serialize / deserialize / diff (per-scenario library)
    shareLink.ts         #s=... base64url workspace encoding
    library.ts           pure merge of bundled + custom − tombstones
    fixtures/            SC846 reference fixture
  components/
    Shell/               Header, Stepper, SummaryRail, SummaryStrip,
                         IssuesDrawer, Panel/Field primitives,
                         NumericInput (uncommitted draft), Disclaimers
    ComponentLibrary/    library viewer, custom-part form, inline price editor
    NodeBuilder/         + BayMap (drive layout)
    RackBuilder/         + RackElevation (U column)
    ClusterView/         + BigWaterfall (capacity cascade)
    ScenarioManager/     scenario cards + diff table
  state/                 workspace reducer, theme, scenarios, share-link
                         loader, hash-tab router, useClusterOutputs
  data/                  bundled component library
  scenarios/             bundled scenario builders
  types/                 data model
```

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on push to `main`. `.github/workflows/ci.yml` runs the same typecheck / tests / build on every pull request.

**Before the first deploy**, set the repository's Pages source manually: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Without this, the workflow runs green but nothing publishes. Vite's `base: '/ceph-cluster-planner/'` is wired in `vite.config.ts` so asset paths resolve under the GH Pages subpath; a broken `base` would show as a blank page with 404s.

## Disclaimers (read before procurement)

1. **Pricing** reflects approximate public list prices at each component's as-of date; actual quotes vary by vendor, region, and volume.
2. **Power** numbers are derived from datasheet typical/max ratings, not measured draw; real-world consumption depends on workload, ambient temperature, and PSU efficiency at load. The N+1 budget assumes redundant PSUs.
3. **Capacity** uses decimal TB (10^12 bytes). Usable values include BlueStore overhead, EC/replication efficiency, and the configured nearfull ratio — they do not reflect Ceph internal metadata, OMAP growth, or RGW overhead, all of which can reduce usable capacity further.
4. **Validation** rules surface common pitfalls but are not exhaustive. Treat warnings as prompts to investigate, not as a substitute for vendor sizing guidance, Ceph upstream documentation, or your own operational runbooks.

## License

See `LICENSE`.
