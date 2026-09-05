import { members } from '@freyo/db';
import { getDb } from '@/lib/db/client';
import { getDevMemberId } from '@/lib/devMember';
import { setDevMemberAction } from './devMemberActions';

/**
 * A visible, clearly-labeled stand-in for real authentication — see lib/devMember.ts. Reads
 * the real `members` table (network-wide readable, no RLS — see
 * packages/db/src/schema/members.ts) to populate the switcher, never a hard-coded list.
 */
export async function DevMemberSwitcher({ returnTo }: { returnTo: string }) {
  const [allMembers, currentMemberId] = await Promise.all([
    getDb().select().from(members),
    getDevMemberId(),
  ]);

  return (
    <form
      action={setDevMemberAction}
      className="flex flex-wrap items-center gap-2 border border-amber-400 bg-amber-50 px-3 py-1.5 text-caption text-amber-900"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <span className="font-medium">Dev: acting as</span>
      <select
        name="memberId"
        defaultValue={currentMemberId ?? ''}
        className="border border-amber-400 bg-white px-1.5 py-0.5 text-caption text-slate-900"
      >
        <option value="">— select a member —</option>
        {allMembers.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name} ({member.kind})
          </option>
        ))}
      </select>
      <button type="submit" className="underline">
        Set
      </button>
    </form>
  );
}
