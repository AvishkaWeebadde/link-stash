import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { decryptSession, getSessionToken } from "@/lib/session";

/**
 * Verify the caller's session. Memoized per-request via React `cache` so
 * multiple calls in one render pass hit the cookie/JWT work only once.
 * Returns the userId, or null when unauthenticated.
 */
export const verifySession = cache(async (): Promise<{ userId: string } | null> => {
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
