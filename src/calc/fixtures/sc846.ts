import type { NodeConfig, DriveSlot } from '../../types/node';

const baseDrives: DriveSlot[] = [
  { component_id: 'hdd-seagate-exos-x24-24tb', count: 24, role: 'osd' },
  { component_id: 'nvme-micron-7500-pro-3p84tb', count: 6, role: 'db_wal' },
];

export const SC846_HDD_ONLY: NodeConfig = {
  id: 'sc846-hdd',
  name: 'SC846 (HDD-only)',
  role: 'osd',
  chassis_id: 'chassis-supermicro-sc846',
  cpu_id: 'cpu-amd-epyc-7543',
  cpu_count: 1,
  ram_module_id: 'ram-ddr4-32gb-rdimm-3200',
  ram_module_count: 8,
  drives: baseDrives,
  hbas: [{ component_id: 'hba-lsi-9300-8i', count: 3 }],
  nics: [{ component_id: 'nic-mellanox-cx5-100gbe', count: 1 }],
  psu_id: 'psu-supermicro-1200w-platinum',
  psu_count: 2,
};

export const SC846_WITH_METADATA: NodeConfig = {
  ...SC846_HDD_ONLY,
  id: 'sc846-meta',
  name: 'SC846 (HDD + metadata NVMe)',
  drives: [
    ...baseDrives,
    { component_id: 'nvme-micron-7500-pro-7p68tb', count: 2, role: 'metadata_osd' },
  ],
};
