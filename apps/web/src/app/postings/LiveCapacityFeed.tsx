'use client';

import { useEffect, useRef, useState } from 'react';
import { DataValue } from '@/components/ui/Typography';
import { getFeedAction, type CapacityFeedPosting } from './actions';

const POLL_INTERVAL_MS = 15_000;
const NEW_ENTRY_HIGHLIGHT_MS = 2_500;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);
  return reduced;
}

export function LiveCapacityFeed({
  memberId,
  initialPostings,
}: {
  memberId: string | undefined;
  initialPostings: readonly CapacityFeedPosting[];
}) {
  const [postings, setPostings] = useState(initialPostings);
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<ReadonlySet<string>>(new Set());
  const knownIds = useRef(new Set(initialPostings.map((p) => p.id)));
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!memberId) return;
    const interval = setInterval(async () => {
      const fresh = await getFeedAction(memberId);
      const freshIds = new Set(fresh.map((p) => p.id));
      const arrived = new Set([...freshIds].filter((id) => !knownIds.current.has(id)));
      knownIds.current = freshIds;
      setPostings(fresh);
      if (arrived.size > 0 && !reducedMotion) {
        setNewlyArrivedIds(arrived);
        setTimeout(() => setNewlyArrivedIds(new Set()), NEW_ENTRY_HIGHLIGHT_MS);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [memberId, reducedMotion]);

  if (!memberId) {
    return (
      <p className="mt-6 border border-slate-200 bg-slate-50 p-4 text-body text-slate-600">
        Select which member you are acting as (above) to see the capacity feed.
      </p>
    );
  }

  if (postings.length === 0) {
    return (
      <p className="mt-6 border border-slate-200 bg-slate-50 p-4 text-body text-slate-600">
        No open capacity postings visible to you right now. A young network has less liquidity than
        a mature one — this is an honest zero, not a display bug.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-2">
      {postings.map((posting) => {
        const isNew = newlyArrivedIds.has(posting.id);
        return (
          <li
            key={posting.id}
            className={`border border-slate-200 bg-white p-3 transition-all duration-700 motion-reduce:transition-none ${
              isNew ? 'border-slate-900 bg-slate-50' : ''
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-body font-medium capitalize text-slate-900">
                {posting.originCity} ↔ {posting.destinationCity}
              </span>
              <span className="text-caption text-slate-500">{posting.memberName}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-caption text-slate-600">
              <span>{posting.vehicleType}</span>
              <span className="capitalize">{posting.temperatureClass}</span>
              {posting.adrClasses.length > 0 && <span>ADR {posting.adrClasses.join(', ')}</span>}
              <span>
                <DataValue className="text-caption">
                  {Number(posting.capacityKg).toLocaleString()}
                </DataValue>{' '}
                kg
              </span>
              <span>
                <DataValue className="text-caption">{posting.capacityLoadingMetres}</DataValue> ldm
              </span>
              <span>
                {formatDateTime(posting.availableFrom)} – {formatDateTime(posting.availableUntil)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
