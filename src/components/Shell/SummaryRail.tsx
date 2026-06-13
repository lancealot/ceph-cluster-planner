import { useClusterOutputs, type WaterfallStage } from '../../state/useClusterOutputs';
import { useAllIssues } from '../../state/useAllIssues';
import type { Tab } from './Stepper';

function MiniWaterfall({ rows }: { rows: WaterfallStage[] }) {
  const max = rows[0]?.tb ?? 1;
  return (
    <div className="wf-mini">
      {rows.map((r, i) => (
        <div className="wf-row" key={r.label}>
          <span className="lbl">{r.label}</span>
          <span className="val">{r.val}</span>
          <span className="wf-track">
            <span
              className={'wf-fill' + (i === rows.length - 1 ? ' final' : '')}
              style={{ width: `${max > 0 ? (r.tb / max) * 100 : 0}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

function nextHint(tab: Tab): string {
  switch (tab) {
    case 'components':
      return 'assemble parts into a node config on 02 Nodes.';
    case 'nodes':
      return 'drop node configs into a rack on 03 Racks.';
    case 'racks':
      return 'group racks and define pools on 04 Cluster.';
    case 'cluster':
      return 'snapshot this build on 05 Scenarios to compare alternatives.';
    default:
      return '';
  }
}

export function SummaryRail({ tab, openDrawer }: { tab: Tab; openDrawer: () => void }) {
  const o = useClusterOutputs();
  const issues = useAllIssues();
  const errs = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;

  return (
    <aside className="rail" aria-label="Cluster output summary">
      <div className="rail-hd">
        <span className="microlabel">Cluster output</span>
        <span className="rail-name mono">{o.clusterName}</span>
      </div>

      <div className="hero">
        <span className="microlabel">Usable capacity</span>
        <div className="hero-num">
          {o.usable}
          <em>{o.usableUnit}</em>
        </div>
      </div>

      <div className="kvgrid">
        <div className="kv"><span className="microlabel">Raw</span><div className="v">{o.raw}</div></div>
        <div className="kv"><span className="microlabel">Cost</span><div className="v">{o.cost}</div></div>
        <div className="kv"><span className="microlabel">$/TB usable</span><div className="v">{o.perTB}</div></div>
        <div className="kv"><span className="microlabel">Power typ.</span><div className="v">{o.power}</div></div>
      </div>

      <div className="counts">{o.counts}</div>

      {o.waterfall.length > 0 ? (
        <div className="stack-sm">
          <span className="microlabel">Capacity cascade</span>
          <MiniWaterfall rows={o.waterfall} />
        </div>
      ) : null}

      <div className="stack-sm">
        <span className="microlabel">Validation</span>
        <div className="sev-chips">
          <button type="button" className={'sev-chip' + (errs ? ' err' : '')} onClick={openDrawer}>
            <span className="dot err" />{errs} errors
          </button>
          <button type="button" className={'sev-chip' + (warns ? ' warn' : '')} onClick={openDrawer}>
            <span className="dot warn" />{warns} warnings
          </button>
          <button type="button" className="sev-chip info" onClick={openDrawer}>
            <span className="dot info" />{infos} info
          </button>
        </div>
      </div>

      {tab !== 'scenarios' ? (
        <div className="hint">
          <b>Next:</b> {nextHint(tab)}
        </div>
      ) : (
        <div className="hint">
          <b>Pipeline complete.</b> Save this configuration as a scenario to diff against alternatives.
        </div>
      )}
    </aside>
  );
}

export function SummaryStrip({ openDrawer }: { openDrawer: () => void }) {
  const o = useClusterOutputs();
  const issues = useAllIssues();
  const warns = issues.filter((i) => i.severity === 'warning').length;
  const errs = issues.filter((i) => i.severity === 'error').length;
  return (
    <div className="railbar">
      <span className="microlabel">Output</span>
      <span className="hero-sm">
        {o.usable} <em>{o.usableUnit} usable</em>
      </span>
      <span className="kv-inline"><span className="microlabel">Raw</span><span className="v">{o.raw}</span></span>
      <span className="kv-inline"><span className="microlabel">Cost</span><span className="v">{o.cost}</span></span>
      <span className="kv-inline"><span className="microlabel">$/TB</span><span className="v">{o.perTB}</span></span>
      <span className="kv-inline"><span className="microlabel">Power</span><span className="v">{o.power}</span></span>
      <span className="grow" />
      {errs > 0 ? (
        <button type="button" className="sev-chip err" onClick={openDrawer}>
          <span className="dot err" />{errs} errors
        </button>
      ) : null}
      <button type="button" className={'sev-chip' + (warns ? ' warn' : '')} onClick={openDrawer}>
        <span className="dot warn" />{warns} warnings
      </button>
    </div>
  );
}
