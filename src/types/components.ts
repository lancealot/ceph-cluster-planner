export type ComponentCategory =
  | 'chassis'
  | 'cpu'
  | 'ram'
  | 'hdd'
  | 'nvme_ssd'
  | 'sata_ssd'
  | 'hba'
  | 'nic'
  | 'psu';

export type DriveFormFactor = '3.5in' | '2.5in' | 'm.2' | 'u.2' | 'u.3' | 'e1.s';
export type DriveInterface = 'sata' | 'sas' | 'nvme_pcie3' | 'nvme_pcie4' | 'nvme_pcie5';
export type PcieGen = 3 | 4 | 5;

export interface BaseComponent {
  id: string;
  category: ComponentCategory;
  vendor: string;
  model: string;
  price_usd: number;
  watts_typical: number;
  watts_max: number;
  as_of_date: string;
  notes?: string;
}

export interface ChassisComponent extends BaseComponent {
  category: 'chassis';
  ru: number;
  drive_bays_lff: number;
  drive_bays_sff: number;
  drive_bays_nvme: number;
  pcie_slots: number;
  max_psu_w: number;
}

export interface CpuComponent extends BaseComponent {
  category: 'cpu';
  cores: number;
  threads: number;
  base_clock_ghz: number;
  socket: string;
  tdp_w: number;
}

export interface RamComponent extends BaseComponent {
  category: 'ram';
  capacity_gb: number;
  speed_mhz: number;
  ecc: boolean;
}

export interface StorageDriveComponent extends BaseComponent {
  category: 'hdd' | 'nvme_ssd' | 'sata_ssd';
  capacity_tb: number;
  form_factor: DriveFormFactor;
  interface: DriveInterface;
  rpm?: number;
  endurance_dwpd?: number;
}

export interface HbaComponent extends BaseComponent {
  category: 'hba';
  ports: number;
  port_type: 'sas' | 'sata' | 'nvme';
  pcie_lanes: number;
  pcie_gen: PcieGen;
}

export interface NicComponent extends BaseComponent {
  category: 'nic';
  ports: number;
  port_speed_gbps: number;
  pcie_lanes: number;
  pcie_gen: PcieGen;
}

export interface PsuComponent extends BaseComponent {
  category: 'psu';
  wattage: number;
  efficiency_rating: '80plus_gold' | '80plus_platinum' | '80plus_titanium' | 'other';
}

export type Component =
  | ChassisComponent
  | CpuComponent
  | RamComponent
  | StorageDriveComponent
  | HbaComponent
  | NicComponent
  | PsuComponent;

export type ComponentLibrary = Record<string, Component>;

export const isStorageDrive = (c: Component): c is StorageDriveComponent =>
  c.category === 'hdd' || c.category === 'nvme_ssd' || c.category === 'sata_ssd';

export const isChassis = (c: Component): c is ChassisComponent => c.category === 'chassis';
export const isCpu = (c: Component): c is CpuComponent => c.category === 'cpu';
export const isRam = (c: Component): c is RamComponent => c.category === 'ram';
export const isHba = (c: Component): c is HbaComponent => c.category === 'hba';
export const isNic = (c: Component): c is NicComponent => c.category === 'nic';
export const isPsu = (c: Component): c is PsuComponent => c.category === 'psu';
