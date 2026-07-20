import ImportBackup from "@/components/import-backup";
import { requireUser } from "@/lib/dal";

export const metadata = { title: "Import & backup · LinkStash" };

export default async function ImportPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Import &amp; backup</h1>
        <p className="mt-1 text-sm text-muted">
          Bring your reading in, and take your whole library out whenever you
          want.
        </p>
      </header>
      <ImportBackup />
    </div>
  );
}
