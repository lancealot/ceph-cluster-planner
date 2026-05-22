import { z } from 'zod';

const driveRoleSchema = z.enum(['osd', 'db_wal', 'metadata_osd', 'cache', 'system']);
const failureDomainSchema = z.enum(['osd', 'host', 'rack', 'datacenter']);
const poolTypeSchema = z.enum(['replicated', 'ec']);
const deviceTierSchema = z.enum(['hdd', 'nvme', 'ssd']);

const componentCategorySchema = z.enum([
  'chassis',
  'cpu',
  'ram',
  'hdd',
  'nvme_ssd',
  'sata_ssd',
  'hba',
  'nic',
  'psu',
]);

const componentSchema = z
  .object({
    id: z.string().min(1),
    category: componentCategorySchema,
    vendor: z.string(),
    model: z.string(),
    price_usd: z.number().nonnegative(),
    watts_typical: z.number().nonnegative(),
    watts_max: z.number().nonnegative(),
    as_of_date: z.string(),
    notes: z.string().optional(),
  })
  .passthrough();

const driveSlotSchema = z.object({
  component_id: z.string(),
  count: z.number().int().nonnegative(),
  role: driveRoleSchema,
});

const componentSlotSchema = z.object({
  component_id: z.string(),
  count: z.number().int().nonnegative(),
});

const nodeConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  role: z.string().optional(),
  chassis_id: z.string(),
  cpu_id: z.string(),
  cpu_count: z.number().int().nonnegative(),
  ram_module_id: z.string(),
  ram_module_count: z.number().int().nonnegative(),
  drives: z.array(driveSlotSchema),
  hbas: z.array(componentSlotSchema),
  nics: z.array(componentSlotSchema),
  psu_id: z.string(),
  psu_count: z.number().int().nonnegative(),
});

const rackConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  ru_capacity: z.number().nonnegative(),
  power_capacity_w: z.number().nonnegative(),
  nodes: z.array(
    z.object({
      node_config_id: z.string(),
      count: z.number().int().nonnegative(),
    })
  ),
});

const poolConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: poolTypeSchema,
  replicas: z.number().int().positive().optional(),
  k: z.number().int().positive().optional(),
  m: z.number().int().positive().optional(),
  failure_domain: failureDomainSchema,
  capacity_share: z.number().min(0).max(1),
  target_tier: deviceTierSchema.optional(),
});

const clusterConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  racks: z.array(
    z.object({
      rack_config_id: z.string(),
      count: z.number().int().nonnegative(),
    })
  ),
  pools: z.array(poolConfigSchema),
  defaults: z.object({
    nearfull_ratio: z.number(),
    bluestore_overhead_pct: z.number(),
    ram_per_osd_gb: z.number(),
    lanes_per_slot: z.number().int().positive(),
  }),
});

export const workspaceSchema = z.object({
  nodes: z.array(nodeConfigSchema),
  racks: z.array(rackConfigSchema),
  cluster: clusterConfigSchema,
  custom_components: z.array(componentSchema),
  deleted_component_ids: z.array(z.string()),
});

export const scenarioSchema = z.object({
  schema_version: z.literal('1'),
  id: z.string().min(1),
  name: z.string(),
  created_at: z.string(),
  workspace: workspaceSchema,
});

export type ScenarioSchemaType = z.infer<typeof scenarioSchema>;
