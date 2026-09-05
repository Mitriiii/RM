'use server';

import {
  countOpenPostingsOnMemberLanes,
  createCapacityPosting,
  findOrCreateSite,
  listVisibleCapacityFeed,
} from '@freyo/db';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { resolveCity } from '@/lib/diagnostic/gazetteer';

export interface CapacityFeedPosting {
  readonly id: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly originCity: string;
  readonly destinationCity: string;
  readonly vehicleType: string;
  readonly temperatureClass: string;
  readonly adrClasses: readonly string[];
  readonly availableFrom: string;
  readonly availableUntil: string;
  readonly capacityKg: string;
  readonly capacityLoadingMetres: string;
}

/**
 * Polled from the client every so often to give the feed its "something is happening here"
 * feeling (see the "pooling network" kickoff's Session 9 spec) without websocket
 * infrastructure. Visibility is enforced entirely by RLS inside listVisibleCapacityFeed — this
 * function does no additional filtering, so it can never accidentally show a member a
 * posting their visibility permissions exclude.
 */
export async function getFeedAction(memberId: string): Promise<readonly CapacityFeedPosting[]> {
  if (!memberId) return [];
  const rows = await listVisibleCapacityFeed(getDb(), memberId);
  return rows.map((row) => ({
    id: row.id,
    memberId: row.memberId,
    memberName: row.memberName,
    originCity: row.originCity,
    destinationCity: row.destinationCity,
    vehicleType: row.vehicleType,
    temperatureClass: row.temperatureClass,
    adrClasses: row.adrClasses,
    availableFrom: row.availableFrom.toISOString(),
    availableUntil: row.availableUntil.toISOString(),
    capacityKg: row.capacityKg,
    capacityLoadingMetres: row.capacityLoadingMetres,
  }));
}

export async function getLiquidityCountAction(memberId: string): Promise<number> {
  if (!memberId) return 0;
  return countOpenPostingsOnMemberLanes(getDb(), memberId);
}

/**
 * Deliberately has no price, rate, bid, or cost-to-carrier field anywhere in this input type
 * — see CLAUDE.md and the "pooling network" kickoff's guardrails. If a future change adds
 * one "just to show the member their own numbers," that's the violation the kickoff warns
 * about — don't.
 */
export interface CreatePostingActionInput {
  readonly memberId: string;
  readonly originCity: string;
  readonly destinationCity: string;
  readonly vehicleType: string;
  readonly temperatureClass: 'ambient' | 'chilled' | 'frozen';
  readonly adrClasses: readonly string[];
  readonly availableFrom: string;
  readonly availableUntil: string;
  readonly capacityKg: number;
  readonly capacityLoadingMetres: number;
}

export type CreatePostingActionResult =
  | { readonly ok: true; readonly postingId: string }
  | { readonly ok: false; readonly message: string };

function titleCase(city: string): string {
  return city.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function createPostingAction(
  input: CreatePostingActionInput,
): Promise<CreatePostingActionResult> {
  if (!input.memberId) {
    return { ok: false, message: 'Select which member you are acting as first.' };
  }

  const origin = resolveCity(input.originCity);
  if (!origin.ok) {
    return { ok: false, message: `Unknown origin city "${input.originCity}".` };
  }
  const destination = resolveCity(input.destinationCity);
  if (!destination.ok) {
    return { ok: false, message: `Unknown destination city "${input.destinationCity}".` };
  }

  const availableFrom = new Date(input.availableFrom);
  const availableUntil = new Date(input.availableUntil);
  if (Number.isNaN(availableFrom.getTime()) || Number.isNaN(availableUntil.getTime())) {
    return { ok: false, message: 'Enter a valid available-from and available-until date/time.' };
  }
  if (availableUntil <= availableFrom) {
    return { ok: false, message: 'Available-until must be after available-from.' };
  }
  if (!(input.capacityKg > 0) || !(input.capacityLoadingMetres > 0)) {
    return {
      ok: false,
      message: 'Capacity (kg) and loading metres must both be greater than zero.',
    };
  }

  const db = getDb();
  const originCityName = titleCase(input.originCity);
  const destinationCityName = titleCase(input.destinationCity);

  const [originSite, destinationSite] = await Promise.all([
    findOrCreateSite(db, input.memberId, {
      name: originCityName,
      city: originCityName,
      countryCode: 'ES',
      coordinates: origin.coordinates,
    }),
    findOrCreateSite(db, input.memberId, {
      name: destinationCityName,
      city: destinationCityName,
      countryCode: 'ES',
      coordinates: destination.coordinates,
    }),
  ]);

  const posting = await createCapacityPosting(db, input.memberId, {
    originSiteId: originSite.id,
    originCity: originCityName,
    destinationSiteId: destinationSite.id,
    destinationCity: destinationCityName,
    vehicleType: input.vehicleType,
    temperatureClass: input.temperatureClass,
    adrClasses: input.adrClasses,
    availableFrom,
    availableUntil,
    capacityKg: input.capacityKg,
    capacityLoadingMetres: input.capacityLoadingMetres,
  });

  revalidatePath('/postings');
  return { ok: true, postingId: posting.id };
}
