import { kilometres } from '@freyo/shared';
import type { Coordinates, RoutedDistance, RoutingClient, RoutingProfile } from './types.js';
import { RoutingUnavailableError } from './types.js';

export interface OsrmClientConfig {
  readonly baseUrl: string;
  /**
   * Identifies the exact engine build and map data serving `baseUrl` — e.g.
   * `osrm-5.27.1-iberia-2026.02`. Not auto-detected: OSRM's HTTP API doesn't expose a
   * queryable version, and inferring one from a response would defeat the point of
   * recording it. Whoever deploys the engine instance is responsible for naming it, the
   * same way packages/factors requires an explicit factor-set version rather than a
   * "latest".
   */
  readonly routingEngineVersion: string;
  readonly fetchImpl?: typeof fetch;
}

interface OsrmRouteResponse {
  readonly code: string;
  readonly message?: string;
  readonly routes?: readonly { readonly distance: number; readonly duration: number }[];
}

const METRES_PER_KILOMETRE = 1_000;

/**
 * A client for a self-hosted OSRM instance's `/route/v1` HTTP API. Never falls back to a
 * great-circle estimate: any failure to reach the engine, a non-OK HTTP status, or an OSRM
 * response that isn't `code: "Ok"` with at least one route throws RoutingUnavailableError.
 */
export function createOsrmClient(config: OsrmClientConfig): RoutingClient {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async route(
      origin: Coordinates,
      destination: Coordinates,
      profile: RoutingProfile,
    ): Promise<RoutedDistance> {
      const url =
        `${config.baseUrl}/route/v1/${profile}/` +
        `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}` +
        `?overview=false&alternatives=false`;

      let response: Response;
      try {
        response = await fetchImpl(url);
      } catch (cause) {
        throw new RoutingUnavailableError(`Routing engine unreachable at ${config.baseUrl}`, {
          cause,
        });
      }

      if (!response.ok) {
        throw new RoutingUnavailableError(
          `Routing engine returned HTTP ${response.status} for ${url}`,
        );
      }

      let body: OsrmRouteResponse;
      try {
        body = (await response.json()) as OsrmRouteResponse;
      } catch (cause) {
        throw new RoutingUnavailableError(`Routing engine returned an unparseable response`, {
          cause,
        });
      }

      const route = body.routes?.[0];
      if (body.code !== 'Ok' || !route) {
        throw new RoutingUnavailableError(
          `Routing engine found no route (code: ${body.code}${body.message ? `, message: ${body.message}` : ''})`,
        );
      }

      return {
        distance: kilometres(route.distance / METRES_PER_KILOMETRE),
        durationSeconds: route.duration,
        routingEngineVersion: config.routingEngineVersion,
        profile,
      };
    },
  };
}
