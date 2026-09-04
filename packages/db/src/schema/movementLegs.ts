import { integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { legs } from './legs.js';
import { movements } from './movements.js';

/**
 * Allocates one movement's shipment mass onto one leg, at a position in that movement's
 * transport chain. A leg with more than one movement_legs row is a shared/pooled leg — see
 * packages/emissions's ShipmentOnLeg, which this mirrors. Row-level security allows either
 * the movement's shipper or the leg's carrier to see the link; neither sees the other
 * party's cost or rate data (that lives in the cost schema, never here).
 */
export const movementLegs = pgTable(
  'movement_legs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movementId: uuid('movement_id')
      .notNull()
      .references(() => movements.id),
    legId: uuid('leg_id')
      .notNull()
      .references(() => legs.id),
    sequenceIndex: integer('sequence_index').notNull(),
    shipmentMassKg: numeric('shipment_mass_kg', { precision: 10, scale: 2 }).notNull(),
    dataQuality: text('data_quality', { enum: ['primary', 'modelled', 'default'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('movement_legs_movement_leg_unique').on(table.movementId, table.legId)],
);
