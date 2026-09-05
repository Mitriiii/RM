'use server';

import { createOsrmClient, RoutingUnavailableError } from '@freyo/routing';
import type { VehicleCategory } from '@/lib/diagnostic/equipment';
import { buildDiagnosticReport, type DiagnosticReport } from '@/lib/diagnostic/report';
import type { MappedShipmentRow } from '@/lib/diagnostic/types';

export interface RunDiagnosticInput {
  readonly rows: readonly MappedShipmentRow[];
  readonly dieselPriceEurPerLitre: number;
  readonly dieselConsumptionLPerKm: Readonly<Record<VehicleCategory, number>>;
  readonly dieselWttKgCO2ePerLitre: number;
  readonly dieselTtwKgCO2ePerLitre: number;
}

export type RunDiagnosticResult =
  | { readonly ok: true; readonly report: DiagnosticReport }
  | { readonly ok: false; readonly message: string };

/**
 * Runs the diagnostic server-side: the routing engine call needs a server-side fetch (a
 * self-hosted OSRM instance typically has no CORS headers for a browser to call it directly,
 * and ROUTING_ENGINE_URL/ROUTING_ENGINE_VERSION shouldn't be exposed to the client bundle).
 * Returns a result object rather than throwing — Next.js redacts a thrown Server Action
 * error's message in production, which would hide exactly the "what happened and how to fix
 * it" detail CLAUDE.md's design direction requires.
 */
export async function runDiagnostic(input: RunDiagnosticInput): Promise<RunDiagnosticResult> {
  const baseUrl = process.env['ROUTING_ENGINE_URL'];
  const routingEngineVersion = process.env['ROUTING_ENGINE_VERSION'];
  if (!baseUrl || !routingEngineVersion) {
    return {
      ok: false,
      message:
        'ROUTING_ENGINE_URL and ROUTING_ENGINE_VERSION are not configured on the server — see .env.example.',
    };
  }

  const routingClient = createOsrmClient({ baseUrl, routingEngineVersion });

  try {
    const report = await buildDiagnosticReport({
      rows: input.rows,
      routingClient,
      // No truck/HGV profile ships with osrm-backend — see packages/routing/README.md.
      // Distances computed here use the car profile and are not truck-accurate until a
      // real truck profile is sourced or written.
      routingProfile: 'car',
      dieselPriceEurPerLitre: input.dieselPriceEurPerLitre,
      dieselConsumptionLPerKm: input.dieselConsumptionLPerKm,
      dieselWttKgCO2ePerLitre: input.dieselWttKgCO2ePerLitre,
      dieselTtwKgCO2ePerLitre: input.dieselTtwKgCO2ePerLitre,
    });
    return { ok: true, report };
  } catch (error) {
    if (error instanceof RoutingUnavailableError) {
      return {
        ok: false,
        message: `Routing engine unavailable: ${error.message}. See packages/routing/README.md to set up a local instance.`,
      };
    }
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'The diagnostic failed for an unknown reason.',
    };
  }
}
