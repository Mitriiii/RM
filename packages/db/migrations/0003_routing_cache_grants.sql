-- routing_distance_cache: no row-level security, same as members/factor_sets — a routed
-- distance between two coordinates is a geographic fact shared by every member, not one
-- member's private data. See src/schema/routingDistanceCache.ts.
GRANT SELECT, INSERT, UPDATE ON routing_distance_cache TO freyo_tenant;
