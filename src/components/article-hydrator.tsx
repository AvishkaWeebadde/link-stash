"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hydrateArticle } from "@/app/actions/items";

/**
 * Shown in place of the reader for an imported article that has a URL but no
 * saved content. On mount it fetches the full text once, then refreshes so the
 * reader renders. If fetching fails, it offers the original link.
 */
export default function ArticleHydrator({
  id,
  url,
}: {
  id: string;
  url: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const res = await hydrateArticle(id);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Couldn't fetch this article.");
    })();
  }, [id, router]);

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center">
        <p className="text-muted">{error}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-accent hover:underline"
        >
          Open the original ↗
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      Fetching the full article…
    </div>
  );
}
