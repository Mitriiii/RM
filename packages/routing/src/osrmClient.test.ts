import { describe, expect, it } from 'vitest';
import { createOsrmClient } from './osrmClient.js';
import { RoutingUnavailableError } from './types.js';

const MADRID = { longitude: -3.7038, latitude: 40.4168 };
const ZARAGOZA = { longitude: -0.8891, latitude: 41.6488 };

function fakeFetch(response: Response): typeof fetch {
  return (() => Promise.resolve(response)) as typeof fetch;
}

function fakeFetchThatThrows(error: Error): typeof fetch {
  return (() => Promise.reject(error)) as typeof fetch;
}

describe('createOsrmClient', () => {
  it('returns a routed distance and duration from a successful OSRM response', async () => {
    const client = createOsrmClient({
      baseUrl: 'http://localhost:5000',
      routingEngineVersion: 'osrm-5.27.1-iberia-TEST_ONLY',
      fetchImpl: fakeFetch(
        new Response(
          JSON.stringify({ code: 'Ok', routes: [{ distance: 325_000, duration: 14_400 }] }),
          {
            status: 200,
          },
        ),
      ),
    });

    const result = await client.route(MADRID, ZARAGOZA, 'car');

    expect(result.distance).toBe(325);
    expect(result.durationSeconds).toBe(14_400);
    expect(result.routingEngineVersion).toBe('osrm-5.27.1-iberia-TEST_ONLY');
    expect(result.profile).toBe('car');
  });

  it('requests the OSRM API with the given profile and coordinates in the URL', async () => {
    let requestedUrl: string | undefined;
    const client = createOsrmClient({
      baseUrl: 'http://localhost:5000',
      routingEngineVersion: 'osrm-5.27.1-iberia-TEST_ONLY',
      fetchImpl: ((url: string) => {
        requestedUrl = url;
        return Promise.resolve(
          new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 1000, duration: 60 }] }), {
            status: 200,
          }),
        );
      }) as typeof fetch,
    });

    await client.route(MADRID, ZARAGOZA, 'car');

    expect(requestedUrl).toContain('/route/v1/car/');
    expect(requestedUrl).toContain(`${MADRID.longitude},${MADRID.latitude}`);
    expect(requestedUrl).toContain(`${ZARAGOZA.longitude},${ZARAGOZA.latitude}`);
  });

  it('throws RoutingUnavailableError, never a distance, when the engine is unreachable', async () => {
    const client = createOsrmClient({
      baseUrl: 'http://localhost:5000',
      routingEngineVersion: 'osrm-5.27.1-iberia-TEST_ONLY',
      fetchImpl: fakeFetchThatThrows(new Error('ECONNREFUSED')),
    });

    await expect(client.route(MADRID, ZARAGOZA, 'car')).rejects.toThrow(RoutingUnavailableError);
  });

  it('throws RoutingUnavailableError on a non-OK HTTP status', async () => {
    const client = createOsrmClient({
      baseUrl: 'http://localhost:5000',
      routingEngineVersion: 'osrm-5.27.1-iberia-TEST_ONLY',
      fetchImpl: fakeFetch(new Response('Internal Server Error', { status: 500 })),
    });

    await expect(client.route(MADRID, ZARAGOZA, 'car')).rejects.toThrow(RoutingUnavailableError);
  });

  it('throws RoutingUnavailableError when OSRM reports no route, rather than estimating one', async () => {
    const client = createOsrmClient({
      baseUrl: 'http://localhost:5000',
      routingEngineVersion: 'osrm-5.27.1-iberia-TEST_ONLY',
      fetchImpl: fakeFetch(
        new Response(JSON.stringify({ code: 'NoRoute', message: 'Impossible route' }), {
          status: 200,
        }),
      ),
    });

    await expect(client.route(MADRID, ZARAGOZA, 'car')).rejects.toThrow(RoutingUnavailableError);
  });

  it('throws RoutingUnavailableError on an unparseable response body', async () => {
    const client = createOsrmClient({
      baseUrl: 'http://localhost:5000',
      routingEngineVersion: 'osrm-5.27.1-iberia-TEST_ONLY',
      fetchImpl: fakeFetch(new Response('not json', { status: 200 })),
    });

    await expect(client.route(MADRID, ZARAGOZA, 'car')).rejects.toThrow(RoutingUnavailableError);
  });
});
