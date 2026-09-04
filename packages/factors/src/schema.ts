import { z } from 'zod';

export const factorSetIdSchema = z.object({
  source: z.string().min(1),
  version: z.string().min(1),
  effectiveDate: z.string().date(),
});

export const tocKeySchema = z.object({
  vehicleType: z.string().min(1),
  fuelType: z.string().min(1),
  loadProfile: z.string().min(1),
  region: z.string().min(1),
});

const WTW_TOLERANCE_GRAMS_PER_TONNE_KM = 1e-6;

export const emissionFactorEntrySchema = z
  .object({
    toc: tocKeySchema,
    wellToTankGramsPerTonneKm: z.number().finite().nonnegative(),
    tankToWheelGramsPerTonneKm: z.number().finite().nonnegative(),
    wellToWheelGramsPerTonneKm: z.number().finite().nonnegative(),
  })
  .refine(
    (entry) =>
      Math.abs(
        entry.wellToTankGramsPerTonneKm +
          entry.tankToWheelGramsPerTonneKm -
          entry.wellToWheelGramsPerTonneKm,
      ) < WTW_TOLERANCE_GRAMS_PER_TONNE_KM,
    { message: 'wellToWheel must equal wellToTank + tankToWheel' },
  );

export const factorSetFileSchema = z.object({
  id: factorSetIdSchema,
  gwpSet: z.string().min(1),
  factors: z.array(emissionFactorEntrySchema).min(1),
});

export type FactorSetFile = z.infer<typeof factorSetFileSchema>;
