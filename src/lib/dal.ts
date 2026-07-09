import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { decryptSession, getSessionToken } from "@/lib/session";
import { IS_LOCAL, LOCAL_USER_EMAIL, LOCAL_USER_NAME } from "@/lib/mode";

// In local (desktop) mode there is exactly one user. Cache its id for the
// lifetime of the process so we don't hit the DB on every request.
let cachedLocalUserId: string | null = null;

async function getLocalUserId(): Promise<string> {
  if (cachedLocalUserId) return cachedLocalUserId;
  const existing = await db.user.findUnique({
    where: { email: LOCAL_USER_EMAIL },
    select: { id: true },
  });
  const id =
    existing?.id ??
    (
      await db.user.create({
        data: {
          email: LOCAL_USER_EMAIL,
          name: LOCAL_USER_NAME,
          // No login in local mode; this hash is never used to authenticate.
          passwordHash: "local-mode",
        },
        select: { id: true },
      })
    ).id;
  cachedLocalUserId = id;
  return id;
}

/**
 * Verify the caller's session. Memoized per-request via React `cache` so
 * multiple calls in one render pass hit the cookie/JWT work only once.
 * Returns the userId, or null when unauthenticated.
 *
 * In local mode, always resolves to the single built-in local user.
 */
export const verifySession = cache(async (): Promise<{ userId: string } | null> => {
  if (IS_LOCAL) {
    return { userId: await getLocalUserId() };
  }
  const token = await getSessionToken();
  const session = await decryptSession(token);
  if (!session?.userId || session.expiresAt < Date.now()) {
    return null;
  }
  return { userId: session.userId };
});

/**
 * Like verifySession, but redirects to /login when unauthenticated.
 * Use this in Server Components / Actions that require a signed-in user.
 */
export async function requireUser(): Promise<{ userId: string }> {
  const session = await verifySession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/** Fetch the current user's safe profile fields, or null. */
export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  if (!session) return null;
  try {
    return await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
  } catch {
    return null;
  }
});
