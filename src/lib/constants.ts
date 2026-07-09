// App-level enumerations. SQLite/Prisma stores these as plain strings, so we
// centralize the allowed values here and validate at the edges.
//
// `type` is the user-facing KIND of item, chosen by intent — deliberately
// decoupled from the file FORMAT. A book, for example, can be a PDF or an
// EPUB; the reader picks its renderer from the file extension (see itemFormat).

export const ITEM_TYPES = ["article", "paper", "book", "note"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

// Kinds the user can assign to an uploaded file.
export const UPLOAD_KINDS = ["paper", "book"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

// File formats we can render. Derived from an item's stored file path.
export type ItemFormat = "pdf" | "epub" | "html";

export function itemFormat(filePath: string | null | undefined): ItemFormat {
  if (!filePath) return "html";
  if (filePath.toLowerCase().endsWith(".epub")) return "epub";
  if (filePath.toLowerCase().endsWith(".pdf")) return "pdf";
  return "html";
}

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
  paper: "Paper",
  book: "Book",
  note: "Note",
};

export const ITEM_TYPE_ICONS: Record<ItemType, string> = {
  article: "🌐",
  paper: "📄",
  book: "📖",
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
