'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DEV_MEMBER_COOKIE } from '@/lib/devMember';

export async function setDevMemberAction(formData: FormData): Promise<void> {
  const memberId = formData.get('memberId');
  const returnTo = formData.get('returnTo');
  const store = await cookies();
  if (typeof memberId === 'string' && memberId) {
    store.set(DEV_MEMBER_COOKIE, memberId, { path: '/' });
  } else {
    store.delete(DEV_MEMBER_COOKIE);
  }
  redirect(typeof returnTo === 'string' && returnTo ? returnTo : '/postings');
}
