import ImportBackup from "@/components/import-backup";
import SyncPanel from "@/components/sync-panel";
import { requireUser } from "@/lib/dal";

export const metadata = { title: "Import, backup & sync · LinkStash" };

export default async function ImportPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Import, backup &amp; sync</h1>
        <p className="mt-1 text-sm text-muted">
          Bring your reading in, take your whole library out, and keep it in
          sync across your devices.
        </p>
      </header>
      <div className="space-y-8">
        <ImportBackup />
        <SyncPanel />
      </div>
    </div>
  );
}
