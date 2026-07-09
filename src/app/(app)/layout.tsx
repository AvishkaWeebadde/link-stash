import { Suspense } from "react";
import AppShell from "@/components/app-shell";
import { requireUser, getCurrentUser } from "@/lib/dal";
import { IS_LOCAL } from "@/lib/mode";
import {
  getSidebarCounts,
  listCollections,
  listTags,
} from "@/lib/items";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await requireUser();
  const [user, counts, collections, tags] = await Promise.all([
    getCurrentUser(),
    getSidebarCounts(userId),
    listCollections(userId),
    listTags(userId),
  ]);

  return (
    <Suspense fallback={null}>
      <AppShell
        user={{ name: user?.name ?? "You", email: user?.email ?? "" }}
        counts={counts}
        collections={collections}
        tags={tags}
        isLocal={IS_LOCAL}
      >
        {children}
      </AppShell>
    </Suspense>
  );
}
