export type DriveRole = 'osd' | 'db_wal' | 'metadata_osd' | 'cache' | 'system';

export interface DriveSlot {
  component_id: string;
  count: number;
  role: DriveRole;
}

export interface ComponentSlot {
  component_id: string;
  count: number;
}

export interface NodeConfig {
  id: string;
  name: string;
  role?: string;
  chassis_id: string;
  cpu_id: string;
  cpu_count: number;
  ram_module_id: string;
  ram_module_count: number;
  drives: DriveSlot[];
  hbas: ComponentSlot[];
  nics: ComponentSlot[];
  psu_id: string;
  psu_count: number;
}
