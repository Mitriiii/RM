import { ADR_CLASS_OPTIONS, TEMPERATURE_CLASS_OPTIONS } from '@freyo/shared';
import Link from 'next/link';
import { DevMemberSwitcher } from '@/components/DevMemberSwitcher';
import { Caption, PageTitle } from '@/components/ui/Typography';
import { getEquipmentOptions } from '@/lib/calculator/equipmentOptions';
import { knownCities } from '@/lib/diagnostic/gazetteer';
import { getDevMemberId } from '@/lib/devMember';
import { PostCapacityForm } from '../PostCapacityForm';

export default async function NewPostingPage() {
  const [memberId, equipmentOptions] = await Promise.all([
    getDevMemberId(),
    Promise.resolve(getEquipmentOptions()),
  ]);
  const cityOptions = knownCities();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <DevMemberSwitcher returnTo="/postings/new" />
      <div className="mt-6 flex items-center justify-between">
        <PageTitle>Post capacity</PageTitle>
        <Link href="/postings" className="text-label underline">
          Back to feed
        </Link>
      </div>
      <Caption className="mt-1">
        Declare a truck available on a route and time window. Every field here is one of the hard
        constraints Freyo&apos;s matcher actually checks — nothing else, and never a rate.
      </Caption>
      <PostCapacityForm
        memberId={memberId}
        cityOptions={cityOptions}
        equipmentOptions={equipmentOptions}
        temperatureClassOptions={TEMPERATURE_CLASS_OPTIONS}
        adrClassOptions={ADR_CLASS_OPTIONS}
      />
    </main>
  );
}
