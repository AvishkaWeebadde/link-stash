"use client";

import { useTransition } from "react";
import { deleteItem, setStatus } from "@/app/actions/items";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";

const STATUS_LABELS: Record<ItemStatus, string> = {
  unread: "Unread",
  reading: "Reading",
  archived: "Archived",
};

export default function ItemActions({
  id,
  status,
}: {
  id: string;
  status: ItemStatus;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        disabled={pending}
        onChange={(e) => start(() => setStatus(id, e.target.value as ItemStatus))}
        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-ring"
        aria-label="Reading status"
      >
        {ITEM_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      <button
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this item permanently?")) {
            start(() => deleteItem(id));
          }
        }}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-600"
        title="Delete"
        aria-label="Delete item"
      >
        🗑️
      </button>
    </div>
  );
}
