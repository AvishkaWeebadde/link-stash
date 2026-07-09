"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createNote, saveArticle, type SaveState } from "@/app/actions/items";
import { uploadFile } from "@/app/actions/upload";

type Tab = "link" | "upload" | "note";

export default function AddItem() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("link");

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90"
      >
        + Add
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-1 border-b border-line p-2">
              <TabButton active={tab === "link"} onClick={() => setTab("link")}>
                🌐 Link
              </TabButton>
              <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
                📄 Upload
              </TabButton>
              <TabButton active={tab === "note"} onClick={() => setTab("note")}>
                📝 Note
              </TabButton>
              <div className="flex-1" />
              <button
                onClick={() => setOpen(false)}
                className="px-2 text-muted hover:text-fg"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {tab === "link" && <LinkForm />}
              {tab === "upload" && <UploadForm />}
              {tab === "note" && <NoteForm />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? "bg-accent-soft font-medium text-fg"
          : "text-muted hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

function LinkForm() {
  const [state, action, pending] = useActionState<SaveState, FormData>(
    saveArticle,
    undefined,
  );
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Paste a URL. We&apos;ll fetch the page and save a clean, readable copy.
      </p>
      <input
        ref={ref}
        name="url"
        type="url"
        required
        placeholder="https://example.com/great-article"
        className="rounded-lg border border-line bg-bg px-3 py-2.5 outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Fetching…" : "Save to library"}
      </button>
    </form>
  );
}

function UploadForm() {
  const [state, action, pending] = useActionState<SaveState, FormData>(
    uploadFile,
    undefined,
  );
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Import a PDF or EPUB to read, highlight, and track your progress.
      </p>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg px-4 py-8 text-center transition hover:border-ring">
        <span className="text-3xl">📚</span>
        <span className="text-sm font-medium">
          {fileName ?? "Choose a PDF or EPUB"}
        </span>
        <span className="text-xs text-faint">up to 50 MB</span>
        <input
          type="file"
          name="file"
          accept=".pdf,.epub,application/pdf,application/epub+zip"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="hidden"
        />
      </label>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Import to library"}
      </button>
    </form>
  );
}

function NoteForm() {
  const [state, action, pending] = useActionState<SaveState, FormData>(
    createNote,
    undefined,
  );
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        ref={ref}
        name="title"
        required
        placeholder="Note title"
        className="rounded-lg border border-line bg-bg px-3 py-2.5 outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <textarea
        name="contentHtml"
        rows={6}
        placeholder="Write your thoughts… (basic HTML supported)"
        className="resize-y rounded-lg border border-line bg-bg px-3 py-2.5 outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Create note"}
      </button>
    </form>
  );
}
