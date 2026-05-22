# Ceph Cluster Planner

Static, browser-based sizing and costing tool for Ceph clusters. Build configurations bottom-up — pick chassis and parts, assemble nodes into racks, then assemble racks into a cluster with pools — and see every derived value (raw vs usable capacity, $/TB, kW, $/TB usable, W/TB usable) update live, with validation rules that flag the common pitfalls.

All computation is client-side. There is no backend.

## Live site

After the one-time GitHub Pages setup below, the app lives at:

`https://lancealot.github.io/ceph-cluster-planner/`

## Quickstart (local development)

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

1. **Components** — start here. Browse the seed library; add custom parts; hide bundled defaults you don't use. Pricing freshness is shown per row.
2. **Nodes** — assemble a server: chassis, CPU + sockets, RAM modules, drives (with role tags: `osd`, `db_wal`, `metadata_osd`, etc.), HBAs, NICs, PSUs. "Load SC846 ref" buttons seed the canonical reference fixture.
3. **Racks** — drop node configs into a rack with RU and power capacities. The binding-constraint badge tells you which limit you'd hit first if you tried to add one more node of the most common type.
4. **Cluster** — group racks, define pools (replicated vs EC, capacity share, failure domain, tier), tune cluster defaults (nearfull, BlueStore overhead, RAM/OSD, lanes/slot). The outputs panel rolls up totals; the capacity waterfall shows the cascade from raw → BlueStore → EC/replication → nearfull.
5. **Scenarios** — save snapshots, load any saved scenario back into the workspace, import/export JSON, and diff any two scenarios to see cost/power/capacity deltas and what warnings each side introduced or resolved.

The validation drawer at the bottom of every tab aggregates all node + rack + pool + cluster issues with severity filtering.

## Reference scenario

The bundled SC846 reference is a 30-node planning baseline: 3 racks × 10 nodes, each node a Supermicro SC846 with 24 × Exos X24 24 TB HDDs, 6 × Micron 7500 PRO 3.84 TB NVMe (DB/WAL), single EPYC 7543, 256 GB RAM, ConnectX-5 dual-port 100 GbE, 3 × LSI 9300-8i. Single EC 8+3 pool, host failure domain, 75 % nearfull, 1 % BlueStore overhead. The expected output is 17.28 PB raw → ~9.33 PB usable on the HDD tier.

Click **Load SC846 reference** on the Scenarios tab to populate the workspace with it.

## Design rationale

- **Pure calc functions**. Everything under `src/calc/` is React-free and IO-free. Derived values are functions of their inputs only. This is what makes "show the math" practical and what makes the test suite a meaningful contract.
- **Validation as data**. `ValidationIssue[]` is computed alongside derived values; the UI just renders the list. Adding a rule is a function in `validation.ts` and a test, never a touch to a UI component.
- **Per-phase test gates**. The SC846 reference values are pinned as named test constants (e.g. `9.3 PB usable within 0.5 %`, `5 PCIe slots at lanes_per_slot=8`). Regressions surface as expected-X-got-Y, not silent drift.
- **Schema-versioned persistence**. localStorage keys carry `v1`; JSON exports carry `schema_version: '1'`. Imports pass through a Zod schema before reaching the reducer.

## Architecture

```
src/
  calc/         pure derivation + validation; the math contract
    units.ts    display thresholds (kW ≥ 1000 W, PB ≥ 1000 TB)
    node.ts     deriveNode
    rack.ts     deriveRack + validateRack
    cluster.ts  deriveCluster
    validation.ts          node-level rules
    clusterValidation.ts   pool + cluster rules
    scenario.ts            serialize / deserialize / diff
    scenarioSchema.ts      Zod schema for import validation
    fixtures/   shared test fixtures (SC846 reference)
  components/   React UI; thin wrappers over calc/
  state/        workspace reducer + custom hooks (useLibrary, useAllIssues, useScenarios)
  data/         bundled component library
  scenarios/    bundled scenario builders
  types/        data model
```

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. **Before the first deploy**, set the repository's Pages source manually:

> **Settings → Pages → Build and deployment → Source: GitHub Actions**

Without this, the workflow runs green but nothing actually publishes. Vite's `base: '/ceph-cluster-planner/'` is wired in `vite.config.ts` so asset paths resolve under the GH Pages subpath; a broken `base` would show as a blank page with 404s in the network tab.

## Disclaimers (read before procurement)

1. **Pricing** reflects approximate public list prices at each component's as-of date; actual quotes vary by vendor, region, and volume.
2. **Power** numbers are derived from datasheet typical/max ratings, not measured draw; real-world consumption depends on workload, ambient temperature, and PSU efficiency at load.
3. **Capacity** uses decimal TB (10^12 bytes). Usable values include BlueStore overhead, EC/replication efficiency, and the configured nearfull ratio — they do not reflect Ceph internal metadata, OMAP growth, or RGW overhead, all of which can reduce usable capacity further.
4. **Validation** rules surface common pitfalls but are not exhaustive. Treat warnings as prompts to investigate, not as a substitute for vendor sizing guidance, Ceph upstream documentation, or your own operational runbooks.

## License

See `LICENSE`.
