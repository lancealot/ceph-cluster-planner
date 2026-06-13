import type { NodeConfig, DriveRole } from '../../types/node';
import type { ComponentLibrary, DriveFormFactor } from '../../types/components';
import { isChassis, isStorageDrive } from '../../types/components';

type BayKind = 'lff' | 'sff' | 'nvme';

function bayKind(ff: DriveFormFactor): BayKind {
  if (ff === '3.5in') return 'lff';
  if (ff === '2.5in') return 'sff';
  return 'nvme';
}

function roleClass(role: DriveRole): string {
  if (role === 'db_wal') return 'db';
  if (role === 'metadata_osd') return 'meta';
  return 'osd';
}

interface Counts {
  lff: number;
  sff: number;
  nvme: number;
}

function emptyCounts(): Counts {
  return { lff: 0, sff: 0, nvme: 0 };
}

export function BayMap({ node, library }: { node: NodeConfig; library: ComponentLibrary }) {
  const chassis = library[node.chassis_id];
  const cap = chassis && isChassis(chassis)
    ? { lff: chassis.drive_bays_lff, sff: chassis.drive_bays_sff, nvme: chassis.drive_bays_nvme }
    : emptyCounts();

  const used: Record<BayKind, DriveRole[]> = { lff: [], sff: [], nvme: [] };
  for (const slot of node.drives) {
    const d = library[slot.component_id];
    if (!d || !isStorageDrive(d)) continue;
    const kind = bayKind(d.form_factor);
    for (let i = 0; i < slot.count; i++) used[kind].push(slot.role);
  }

  function row(label: string, kind: BayKind, columns: number) {
    if (cap[kind] === 0) return null;
    const bays: (DriveRole | null)[] = [];
    for (const r of used[kind]) bays.push(r);
    while (bays.length < cap[kind]) bays.push(null);
    return (
      <div className="stack-sm">
        <span className="microlabel">{label} — {cap[kind]} {kind.toUpperCase()}</span>
        <div className="baygrid" style={{ gridTemplateColumns: `repeat(${columns}, 21px)` }}>
          {bays.map((r, i) => (
            <span
              key={i}
              className={'bay' + (r ? ' ' + roleClass(r) : '')}
              title={r ? `${kind} · ${r}` : 'empty'}
            />
          ))}
        </div>
      </div>
    );
  }

  const lffCols = Math.min(6, cap.lff || 6);
  const sffCols = Math.min(4, cap.sff || 4);
  const nvmeCols = Math.min(3, cap.nvme || 3);

  return (
    <div className="baywrap">
      {row('Front', 'lff', lffCols)}
      {row('Rear', 'sff', sffCols)}
      {row('NVMe', 'nvme', nvmeCols)}
      <div className="legend">
        <span className="li"><span className="sw osd" />osd</span>
        <span className="li"><span className="sw db" />db_wal</span>
        <span className="li"><span className="sw meta" />metadata_osd</span>
        <span className="li"><span className="sw empty" />empty</span>
      </div>
    </div>
  );
}
