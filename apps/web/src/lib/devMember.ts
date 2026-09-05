import { cookies } from 'next/headers';

/**
 * There is no real authentication anywhere in this codebase yet — this cookie is a
 * deliberately visible, dev-only stand-in for "which member is logged in," never to be
 * mistaken for a real session. Every page that uses it labels the control "Dev: acting as"
 * so nobody confuses it with production auth. Row-level security is still enforced for real
 * server-side against whichever member id this names — the cookie only decides *which*
 * member's tenant context a request runs under, it does not itself grant any access.
 */
export const DEV_MEMBER_COOKIE = 'freyo_dev_member_id';

export async function getDevMemberId(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(DEV_MEMBER_COOKIE)?.value;
}
