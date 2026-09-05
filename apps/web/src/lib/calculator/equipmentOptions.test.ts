import { describe, expect, it } from 'vitest';
import {
  getEquipmentOptions,
  getProductionFactorSet,
  unmappedVehicleTypes,
} from './equipmentOptions';

describe('equipmentOptions', () => {
  it('loads the real production factor set (never a TEST_ONLY fixture) for a public-facing screen', () => {
    const factorSet = getProductionFactorSet();
    expect(factorSet.id.source).not.toBe('TEST_ONLY');
    expect(factorSet.id.source).toBe('uk-desnz-ghg-conversion-factors');
  });

  it("populates the dropdown from the registry's own entries, not a hand-written list", () => {
    const options = getEquipmentOptions();
    expect(options.length).toBeGreaterThan(0);
    const values = options.map((o) => o.value);
    expect(values).toContain('rigid-12t');
    expect(values).toContain('articulated-40t');
  });

  it('never silently drops a registered vehicle type it does not know how to categorise', () => {
    // If this fails, the registry has grown a vehicle type equipmentOptions.ts's
    // VEHICLE_TYPE_TO_CATEGORY map doesn't cover yet — add it there, don't ignore this test.
    expect(unmappedVehicleTypes()).toEqual([]);
  });

  it('assigns the correct simplified vehicle category to each equipment option', () => {
    const options = getEquipmentOptions();
    const rigid = options.find((o) => o.value === 'rigid-12t');
    const articulated = options.find((o) => o.value === 'articulated-40t');
    expect(rigid?.category).toBe('rigid');
    expect(articulated?.category).toBe('articulated');
  });
});
