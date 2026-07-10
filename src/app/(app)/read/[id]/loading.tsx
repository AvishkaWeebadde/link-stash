export default function ReaderLoading() {
  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-20 border-b border-line bg-bg">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <div className="h-6 w-6 animate-pulse rounded bg-surface-2" />
          <div className="h-4 flex-1 animate-pulse rounded bg-surface-2" />
          <div className="h-6 w-16 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-8 space-y-3">
          <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
          <div className="h-9 w-4/5 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-surface-2"
              style={{ width: `${70 + ((i * 7) % 30)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
