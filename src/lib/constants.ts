// App-level enumerations. SQLite/Prisma stores these as plain strings, so we
// centralize the allowed values here and validate at the edges.

export const ITEM_TYPES = ["article", "pdf", "epub", "note"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ["unread", "reading", "archived"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const HIGHLIGHT_COLORS = [
  "yellow",
  "green",
  "blue",
  "pink",
  "purple",
] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  article: "Article",
  pdf: "PDF",
  epub: "Book",
  note: "Note",
};

export const ITEM_TYPE_ICONS: Record<ItemType, string> = {
  article: "🌐",
  pdf: "📄",
  epub: "📖",
  note: "📝",
};

// Tailwind-friendly hex values for highlight colors (used in the reader).
export const HIGHLIGHT_COLOR_HEX: Record<HighlightColor, string> = {
  yellow: "#fde68a",
  green: "#bbf7d0",
  blue: "#bfdbfe",
  pink: "#fbcfe8",
  purple: "#ddd6fe",
};
