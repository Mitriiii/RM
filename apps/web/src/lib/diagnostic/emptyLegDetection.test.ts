import { describe, expect, it } from 'vitest';
import { detectEmptyLegs, type LaneTrip } from './emptyLegDetection';

describe('detectEmptyLegs', () => {
  it('reports no probable empty trips when both directions are balanced', () => {
    const trips: LaneTrip[] = [
      { origin: 'Madrid', destination: 'Barcelona' },
      { origin: 'Barcelona', destination: 'Madrid' },
    ];
    const [lane] = detectEmptyLegs(trips);
    expect(lane?.emptyDirection).toBe('balanced');
    expect(lane?.probableEmptyTrips).toBe(0);
  });

  it('infers empty trips in the direction with fewer recorded loaded trips', () => {
    const trips: LaneTrip[] = [
      { origin: 'Madrid', destination: 'Zaragoza' },
      { origin: 'Madrid', destination: 'Zaragoza' },
      { origin: 'Madrid', destination: 'Zaragoza' },
      { origin: 'Zaragoza', destination: 'Madrid' },
    ];
    const [lane] = detectEmptyLegs(trips);
    expect(lane?.tripsAtoB).toBe(3); // Madrid < Zaragoza alphabetically -> Madrid is "A"
    expect(lane?.tripsBtoA).toBe(1);
    expect(lane?.emptyDirection).toBe('BtoA'); // the deficit direction: Zaragoza -> Madrid
    expect(lane?.probableEmptyTrips).toBe(2);
  });

  it('groups a lane the same way regardless of which city is listed as origin', () => {
    const trips: LaneTrip[] = [
      { origin: 'Valencia', destination: 'Barcelona' },
      { origin: 'Barcelona', destination: 'Valencia' },
      { origin: 'Valencia', destination: 'Barcelona' },
    ];
    const lanes = detectEmptyLegs(trips);
    expect(lanes).toHaveLength(1);
  });

  it('is case-insensitive when grouping cities into a lane', () => {
    const trips: LaneTrip[] = [
      { origin: 'madrid', destination: 'ZARAGOZA' },
      { origin: 'Madrid', destination: 'Zaragoza' },
    ];
    const lanes = detectEmptyLegs(trips);
    expect(lanes).toHaveLength(1);
    expect(lanes[0]?.tripsAtoB).toBe(2);
  });

  it('ignores a trip whose origin and destination are the same city', () => {
    const trips: LaneTrip[] = [{ origin: 'Madrid', destination: 'Madrid' }];
    expect(detectEmptyLegs(trips)).toEqual([]);
  });

  it('keeps separate lanes for separate city pairs', () => {
    const trips: LaneTrip[] = [
      { origin: 'Madrid', destination: 'Zaragoza' },
      { origin: 'Madrid', destination: 'Valencia' },
    ];
    const lanes = detectEmptyLegs(trips);
    expect(lanes).toHaveLength(2);
  });
});
