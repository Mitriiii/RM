import type { Kilometres } from '@freyo/shared';

export interface Coordinates {
  readonly longitude: number;
  readonly latitude: number;
}

/**
 * A routing engine's own vehicle profile name (e.g. `car`, or a custom truck profile the
 * engine was built with) — not one of packages/factors's transport-operation-category
 * vehicle types. The two happen to overlap in spirit but are configured independently: a
 * profile selects which routing rules the engine applies (weight/height/hazmat
 * restrictions, road-class preferences), not which emission factor applies to the result.
 */
export type RoutingProfile = string;

/**
 * A routed distance and duration, always the output of an actual routing engine call —
 * never a great-circle estimate, not even as a fallback (CLAUDE.md non-negotiable #3).
 * `routingEngineVersion` identifies the exact engine build and map data that produced this
 * result, so a stored calculation stays reproducible even after the engine or the map data
 * is upgraded.
 */
export interface RoutedDistance {
  readonly distance: Kilometres;
  readonly durationSeconds: number;
  readonly routingEngineVersion: string;
  readonly profile: RoutingProfile;
}

/**
 * Thrown whenever a route cannot be obtained from the routing engine — the engine is
 * unreachable, returns a non-success status, or reports no route exists. There is
 * deliberately no fallback path from this error to a computed estimate; the caller decides
 * whether to retry, queue, or surface the failure.
 */
export class RoutingUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RoutingUnavailableError';
  }
}

export interface RoutingClient {
  route(
    origin: Coordinates,
    destination: Coordinates,
    profile: RoutingProfile,
  ): Promise<RoutedDistance>;
}
