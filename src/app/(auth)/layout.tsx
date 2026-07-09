export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-2xl text-accent-fg">
            📚
          </div>
          <h1 className="text-2xl font-bold tracking-tight">LinkStash</h1>
          <p className="mt-1 text-sm text-muted">
            Your personal knowledge library
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
