import type { WaterfallStage } from '../../state/useClusterOutputs';

export function BigWaterfall({ rows }: { rows: WaterfallStage[] }) {
  if (rows.length === 0) {
    return <p className="note">Add a pool to see the capacity cascade.</p>;
  }
  const max = rows[0].tb;
  return (
    <div className="wf-big">
      {rows.map((r, i) => (
        <div className="wfb-row" key={r.label}>
          <div className="wfb-lbl">
            <span className="microlabel">{r.label}</span>
            {r.note ? <span className="t3">{r.note}</span> : null}
          </div>
          <div className="wfb-track">
            <div
              className={'wfb-fill' + (i === rows.length - 1 ? ' final' : '')}
              style={{ width: `${max > 0 ? (r.tb / max) * 100 : 0}%` }}
            />
          </div>
          <div className="wfb-val">
            {r.val}
            <span className="d">{r.delta ?? '100%'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
