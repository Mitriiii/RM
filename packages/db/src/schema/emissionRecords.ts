import {
  date,
  doublePrecision,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { members } from './members.js';
import { movementLegs } from './movementLegs.js';
import { movements } from './movements.js';

/**
 * An immutable calculated emissions result — mirrors packages/emissions's
 * ShipmentEmissionRecord exactly, so a row here is a direct, lossless persistence of what
 * the engine produced. Append-only: see migrations/0001_policies.sql's
 * emission_records_append_only trigger. A correction is a new row with supersedesId set to
 * the row it corrects — never an UPDATE. Row-level security scoped by memberId (the
 * shipment's owner).
 */
export const emissionRecords = pgTable('emission_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  movementId: uuid('movement_id')
    .notNull()
    .references(() => movements.id),
  movementLegId: uuid('movement_leg_id')
    .notNull()
    .references(() => movementLegs.id),
  vehicleType: text('vehicle_type').notNull(),
  fuelType: text('fuel_type').notNull(),
  loadProfile: text('load_profile').notNull(),
  region: text('region').notNull(),
  distanceKm: numeric('distance_km', { precision: 10, scale: 3 }).notNull(),
  routingSource: text('routing_source').notNull(),
  dataQuality: text('data_quality', { enum: ['primary', 'modelled', 'default'] }).notNull(),
  shipmentMassKg: numeric('shipment_mass_kg', { precision: 10, scale: 2 }).notNull(),
  legTotalMassKg: numeric('leg_total_mass_kg', { precision: 10, scale: 2 }).notNull(),
  allocationShare: doublePrecision('allocation_share').notNull(),
  factorSetSource: text('factor_set_source').notNull(),
  factorSetVersion: text('factor_set_version').notNull(),
  factorSetEffectiveDate: date('factor_set_effective_date').notNull(),
  gwpSet: text('gwp_set').notNull(),
  engineVersion: text('engine_version').notNull(),
  wellToTankGrams: numeric('well_to_tank_grams', { precision: 14, scale: 4 }).notNull(),
  tankToWheelGrams: numeric('tank_to_wheel_grams', { precision: 14, scale: 4 }).notNull(),
  wellToWheelGrams: numeric('well_to_wheel_grams', { precision: 14, scale: 4 }).notNull(),
  supersedesId: uuid('supersedes_id').references((): AnyPgColumn => emissionRecords.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
