import type { FactorSet } from '@freyo/factors';
import {
  type Kilograms,
  applyEmissionIntensity,
  gramsCO2e,
  kilograms,
  transportActivity,
} from '@freyo/shared';
import type {
  LegEmissionsResult,
  LegEmissionsTotals,
  LegInput,
  ShipmentEmissionRecord,
  ShipmentOnLeg,
  TransportChainEmissions,
} from './types.js';

/**
 * Bump whenever a change to this file could change a previously-computed number for the same
 * inputs — CLAUDE.md requires every stored result to carry the engine version that produced
 * it, so a 2027 shipment re-run in 2032 can be checked against the version that ran it.
 */
export const EMISSIONS_ENGINE_VERSION = '0.1.0';

function sumMass(shipments: readonly ShipmentOnLeg[]): Kilograms {
  return kilograms(shipments.reduce((sum, shipment) => sum + shipment.mass, 0));
}

/**
 * Computes one leg's total well-to-tank / tank-to-wheel / well-to-wheel emissions from the
 * factor set's intensity for the leg's transport operation category, then allocates that
 * total across every shipment sharing the leg, in proportion to each shipment's mass share.
 * Mass-based allocation is the GLEC Framework / CLAUDE.md default: a shipment that is half
 * the leg's payload is charged half the leg's emissions, regardless of how far it travels
 * within the leg (a leg is one indivisible vehicle movement).
 *
 * Pure: no I/O, no database, no network, no clock. The exact same arguments always produce
 * the exact same result.
 */
export function calculateLegEmissions(
  leg: LegInput,
  shipments: readonly ShipmentOnLeg[],
  factorSet: FactorSet,
): LegEmissionsResult {
  if (shipments.length === 0) {
    throw new RangeError('calculateLegEmissions requires at least one shipment on the leg');
  }

  const lookup = factorSet.lookup(leg.toc);
  if (!lookup.ok) {
    return { ok: false, error: lookup.error };
  }

  const legTotalMass = sumMass(shipments);
  const activity = transportActivity(legTotalMass, leg.distance);
  const totals: LegEmissionsTotals = Object.freeze({
    activity,
    wellToTank: applyEmissionIntensity(activity, lookup.intensity.wellToTank),
    tankToWheel: applyEmissionIntensity(activity, lookup.intensity.tankToWheel),
    wellToWheel: applyEmissionIntensity(activity, lookup.intensity.wellToWheel),
  });
  const frozenLeg = Object.freeze({ ...leg, toc: Object.freeze({ ...leg.toc }) });

  const shipmentRecords: ShipmentEmissionRecord[] = shipments.map((shipment) => {
    const allocationShare = legTotalMass === 0 ? 0 : shipment.mass / legTotalMass;
    return Object.freeze({
      shipmentId: shipment.shipmentId,
      leg: frozenLeg,
      shipmentMass: shipment.mass,
      legTotalMass,
      allocationShare,
      factorSetId: factorSet.id,
      gwpSet: factorSet.gwpSet,
      engineVersion: EMISSIONS_ENGINE_VERSION,
      dataQuality: leg.dataQuality,
      wellToTank: gramsCO2e(totals.wellToTank * allocationShare),
      tankToWheel: gramsCO2e(totals.tankToWheel * allocationShare),
      wellToWheel: gramsCO2e(totals.wellToWheel * allocationShare),
    });
  });

  return { ok: true, totals, shipments: Object.freeze(shipmentRecords) };
}

/**
 * Sums one shipment's already-allocated records across every leg of its transport chain.
 * Every record must belong to the same shipment — mixing shipments here would silently
 * double-count someone else's emissions into this shipment's total.
 */
export function summarizeTransportChain(
  shipmentId: string,
  legRecords: readonly ShipmentEmissionRecord[],
): TransportChainEmissions {
  for (const record of legRecords) {
    if (record.shipmentId !== shipmentId) {
      throw new RangeError(
        `summarizeTransportChain(${shipmentId}, ...) received a record for shipment ` +
          `${record.shipmentId}`,
      );
    }
  }

  return Object.freeze({
    shipmentId,
    legs: Object.freeze([...legRecords]),
    wellToTank: gramsCO2e(legRecords.reduce((sum, record) => sum + record.wellToTank, 0)),
    tankToWheel: gramsCO2e(legRecords.reduce((sum, record) => sum + record.tankToWheel, 0)),
    wellToWheel: gramsCO2e(legRecords.reduce((sum, record) => sum + record.wellToWheel, 0)),
  });
}
