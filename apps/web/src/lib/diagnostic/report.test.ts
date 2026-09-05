import type { Coordinates, RoutedDistance, RoutingClient } from '@freyo/routing';
import { kilometres } from '@freyo/shared';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIESEL_PRICE_EUR_PER_LITRE,
  DEFAULT_DIESEL_WTW_KG_CO2E_PER_LITRE,
  DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM,
} from './costs';
import { buildDiagnosticReport } from './report';
import type { MappedShipmentRow } from './types';

const ROUTING_ENGINE_VERSION = 'osrm-fake-TEST_ONLY';

interface FakeRoutingClient extends RoutingClient {
  readonly callCount: () => number;
}

function fakeRoutingClient(distanceKmByPair: Record<string, number>): FakeRoutingClient {
  let calls = 0;
  return {
    route(origin: Coordinates, destination: Coordinates, profile: string): Promise<RoutedDistance> {
      calls += 1;
      const key = `${origin.longitude},${origin.latitude}->${destination.longitude},${destination.latitude}`;
      const reverseKey = `${destination.longitude},${destination.latitude}->${origin.longitude},${origin.latitude}`;
      const distanceKm = distanceKmByPair[key] ?? distanceKmByPair[reverseKey];
      if (distanceKm === undefined) {
        throw new Error(`fakeRoutingClient: no distance configured for ${key}`);
      }
      return Promise.resolve({
        distance: kilometres(distanceKm),
        durationSeconds: distanceKm * 60,
        routingEngineVersion: ROUTING_ENGINE_VERSION,
        profile,
      });
    },
    callCount: () => calls,
  };
}

function row(
  rowNumber: number,
  origin: string,
  destination: string,
  equipmentType: string,
  weightKg = 8000,
): MappedShipmentRow {
  return { rowNumber, origin, destination, date: '2026-01-15', weightKg, equipmentType };
}

const COST_INPUTS = {
  routingProfile: 'car',
  dieselPriceEurPerLitre: DEFAULT_DIESEL_PRICE_EUR_PER_LITRE,
  dieselConsumptionLPerKm: DEFAULT_UNLADEN_DIESEL_CONSUMPTION_L_PER_KM,
  dieselWtwKgCO2ePerLitre: DEFAULT_DIESEL_WTW_KG_CO2E_PER_LITRE,
};

describe('buildDiagnosticReport', () => {
  it('reports zero empty km for a perfectly balanced lane', async () => {
    const routingClient = fakeRoutingClient({ '-3.7038,40.4168->-0.8891,41.6488': 325 });
    const report = await buildDiagnosticReport({
      rows: [
        row(1, 'Madrid', 'Zaragoza', 'Articulated'),
        row(2, 'Zaragoza', 'Madrid', 'Articulated'),
      ],
      routingClient,
      ...COST_INPUTS,
    });
    expect(report.lanes).toEqual([]);
    expect(report.totalEmptyKm).toBe(0);
    expect(report.issues).toEqual([]);
  });

  it('computes empty km, diesel cost, and CO2e for an imbalanced lane', async () => {
    const routingClient = fakeRoutingClient({ '-3.7038,40.4168->-0.8891,41.6488': 325 });
    const report = await buildDiagnosticReport({
      rows: [
        row(1, 'Madrid', 'Zaragoza', 'Articulated'),
        row(2, 'Madrid', 'Zaragoza', 'Articulated'),
        row(3, 'Madrid', 'Zaragoza', 'Articulated'),
      ],
      routingClient,
      ...COST_INPUTS,
    });

    expect(report.lanes).toHaveLength(1);
    const lane = report.lanes[0]!;
    expect(lane.probableEmptyTrips).toBe(3);
    expect(lane.distanceKm).toBe(325);
    expect(lane.emptyKm).toBe(325 * 3);
    expect(lane.emptyDieselCostEur).toBeGreaterThan(0);
    expect(lane.emptyCO2eGrams).toBeGreaterThan(0);
    expect(report.totalEmptyKm).toBe(lane.emptyKm);
    expect(report.routingEngineVersion).toBe(ROUTING_ENGINE_VERSION);
  });

  it('reports an unknown city as an issue and excludes that row from the lane calculation', async () => {
    const routingClient = fakeRoutingClient({});
    const report = await buildDiagnosticReport({
      rows: [row(1, 'Madrid', 'Atlantis', 'Articulated')],
      routingClient,
      ...COST_INPUTS,
    });
    expect(report.lanes).toEqual([]);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.message).toMatch(/atlantis/i);
  });

  it('reports an unrecognized equipment type as an issue', async () => {
    const routingClient = fakeRoutingClient({});
    const report = await buildDiagnosticReport({
      rows: [row(1, 'Madrid', 'Zaragoza', 'Hovercraft')],
      routingClient,
      ...COST_INPUTS,
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.message).toMatch(/hovercraft/i);
  });

  it('does not call the routing client at all when no lane has a probable empty leg', async () => {
    const routingClient = fakeRoutingClient({});
    await buildDiagnosticReport({
      rows: [
        row(1, 'Madrid', 'Zaragoza', 'Articulated'),
        row(2, 'Zaragoza', 'Madrid', 'Articulated'),
      ],
      routingClient,
      ...COST_INPUTS,
    });
    expect(routingClient.callCount()).toBe(0);
  });

  it('sorts lanes by empty km descending, worst lane first', async () => {
    const routingClient = fakeRoutingClient({
      '-3.7038,40.4168->-0.8891,41.6488': 325, // Madrid-Zaragoza
      '-3.7038,40.4168->-0.3763,39.4699': 357, // Madrid-Valencia
    });
    const report = await buildDiagnosticReport({
      rows: [
        row(1, 'Madrid', 'Zaragoza', 'Articulated'),
        row(2, 'Madrid', 'Valencia', 'Articulated'),
        row(3, 'Madrid', 'Valencia', 'Articulated'),
        row(4, 'Madrid', 'Valencia', 'Articulated'),
      ],
      routingClient,
      ...COST_INPUTS,
    });
    expect(report.lanes).toHaveLength(2);
    expect(report.lanes[0]?.probableEmptyTrips).toBe(3); // Madrid-Valencia: bigger imbalance first
  });
});
