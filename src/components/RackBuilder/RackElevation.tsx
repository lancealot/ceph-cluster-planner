import type { RackConfig } from '../../types/rack';
import type { NodeConfig } from '../../types/node';
import type { ComponentLibrary } from '../../types/components';
import { isChassis } from '../../types/components';

interface Segment {
  type: 'node' | 'free';
  u: number;
  label: string;
}

const U_PX = 13;

export function RackElevation({
  rack,
  nodeMap,
  library,
}: {
  rack: RackConfig;
  nodeMap: Map<string, NodeConfig>;
  library: ComponentLibrary;
}) {
  const segs: Segment[] = [];
  for (const slot of rack.nodes) {
    const node = nodeMap.get(slot.node_config_id);
    if (!node) continue;
    const chassis = library[node.chassis_id];
    const ru = chassis && isChassis(chassis) ? chassis.ru : 1;
    for (let i = 0; i < slot.count; i++) {
      segs.push({ type: 'node', u: ru, label: `${node.name} #${String(i + 1).padStart(2, '0')}` });
    }
  }
  const used = segs.reduce((s, x) => s + x.u, 0);
  const free = Math.max(0, rack.ru_capacity - used);
  if (free > 0) segs.unshift({ type: 'free', u: free, label: 'free' });
  return (
    <div className="elev-col">
      {segs.map((s, i) => (
        <div className="elev-u" key={i} style={{ height: s.u * U_PX + 'px' }}>
          <div className={'elev-block ' + s.type}>
            <span>{s.label}</span>
            <span style={{ color: 'var(--text3)' }}>{s.u}U</span>
          </div>
        </div>
      ))}
    </div>
  );
}
