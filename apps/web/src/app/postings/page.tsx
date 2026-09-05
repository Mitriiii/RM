import { countOpenPostingsOnMemberLanes, listVisibleCapacityFeed } from '@freyo/db';
import Link from 'next/link';
import { DevMemberSwitcher } from '@/components/DevMemberSwitcher';
import { Caption, DataValue, PageTitle } from '@/components/ui/Typography';
import { getDb } from '@/lib/db/client';
import { getDevMemberId } from '@/lib/devMember';
import { LiveCapacityFeed } from './LiveCapacityFeed';
import type { CapacityFeedPosting } from './actions';

export default async function PostingsPage() {
  const memberId = await getDevMemberId();

  const [rows, liquidityCount] = memberId
    ? await Promise.all([
        listVisibleCapacityFeed(getDb(), memberId),
        countOpenPostingsOnMemberLanes(getDb(), memberId),
      ])
    : [[], 0];

  const initialPostings: readonly CapacityFeedPosting[] = rows.map((row) => ({
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <DevMemberSwitcher returnTo="/postings" />
      <div className="mt-6 flex items-center justify-between">
        <PageTitle>Capacity feed</PageTitle>
        <Link
          href="/postings/new"
          className="border border-slate-900 bg-slate-900 px-3 py-1.5 text-label font-medium text-white"
        >
          Post capacity
        </Link>
      </div>
      <Caption className="mt-1">
        Open capacity postings visible to you — respecting tenant isolation and any visibility
        preferences a poster has set. Never a public load board.
      </Caption>

      {memberId && (
        <div className="mt-4 border border-slate-300 bg-slate-50 px-4 py-3">
          <span className="text-caption text-slate-600">Open postings on lanes you run: </span>
          <DataValue className="text-body font-medium">{liquidityCount}</DataValue>
          {liquidityCount === 0 && (
            <Caption className="mt-1">
              Zero, honestly — a young network has less liquidity than a mature one. This isn&apos;t
              a display bug; it&apos;s a go-to-market problem, not a UI one.
            </Caption>
          )}
        </div>
      )}

      <LiveCapacityFeed memberId={memberId} initialPostings={initialPostings} />
    </main>
  );
}
