"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "playing" | "paused";

// Split text into speakable chunks. Long single utterances are unreliable in
// some engines, so we break on sentence boundaries and cap chunk length.
function toChunks(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [clean];
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > 220) {
      if (buf) chunks.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

export default function ReadAloud({ text }: { text: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = useState<string>("");
  const [open, setOpen] = useState(false);

  const chunksRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef<string>("");
  const stoppedRef = useRef(false);

  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Load available voices (populated asynchronously in most engines).
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) {
        setVoices(v);
        setVoiceUri((cur) => {
          if (cur) return cur;
          const en = v.find((x) => x.lang.startsWith("en")) ?? v[0];
          voiceRef.current = en.voiceURI;
          return en.voiceURI;
        });
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  // Stop speech if the component unmounts (e.g. navigating away).
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speakFrom = useCallback(
    (i: number) => {
      const chunks = chunksRef.current;
      if (i >= chunks.length) {
        setStatus("idle");
        indexRef.current = 0;
        return;
      }
      indexRef.current = i;
      const u = new SpeechSynthesisUtterance(chunks[i]);
      u.rate = rateRef.current;
      const v = voices.find((x) => x.voiceURI === voiceRef.current);
      if (v) u.voice = v;
      u.onend = () => {
        if (!stoppedRef.current) speakFrom(i + 1);
      };
      window.speechSynthesis.speak(u);
    },
    [voices],
  );

  const play = useCallback(() => {
    if (!supported) return;
    // Read a selection if one exists inside the page; otherwise the whole item.
    const sel = window.getSelection()?.toString().trim();
    const source = sel && sel.length > 1 ? sel : text;
    window.speechSynthesis.cancel();
    stoppedRef.current = false;
    chunksRef.current = toChunks(source);
    rateRef.current = rate;
    if (chunksRef.current.length === 0) return;
    setStatus("playing");
    setOpen(true);
    speakFrom(0);
  }, [supported, text, rate, speakFrom]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setStatus("playing");
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    window.speechSynthesis.cancel();
    indexRef.current = 0;
    setStatus("idle");
  }, []);

  if (!supported) return null;

  const btn =
    "flex h-8 items-center justify-center rounded-lg px-2.5 text-sm transition";

  return (
    <div className="flex items-center gap-1">
      {status === "idle" ? (
        <button
          onClick={play}
          className={`${btn} text-muted hover:bg-surface-2 hover:text-fg`}
          title="Read aloud (reads your selection, or the whole item)"
        >
          🔊 Listen
        </button>
      ) : (
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface px-1 py-0.5">
          {status === "playing" ? (
            <button onClick={pause} className={`${btn} hover:bg-surface-2`} title="Pause">
              ⏸
            </button>
          ) : (
            <button onClick={resume} className={`${btn} hover:bg-surface-2`} title="Resume">
              ▶️
            </button>
          )}
          <button onClick={stop} className={`${btn} hover:bg-surface-2`} title="Stop">
            ⏹
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className={`${btn} hover:bg-surface-2`}
            title="Voice & speed"
          >
            ⚙️
          </button>
        </div>
      )}

      {open && status !== "idle" && (
        <div className="fixed right-4 top-16 z-40 w-64 rounded-xl border border-line bg-surface p-3 shadow-lg">
          <label className="mb-2 block text-xs font-medium text-muted">
            Speed: {rate.toFixed(1)}×
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={rate}
              onChange={(e) => {
                const r = parseFloat(e.target.value);
                setRate(r);
                rateRef.current = r;
              }}
              className="mt-1 w-full accent-accent"
            />
          </label>
          {voices.length > 0 && (
            <label className="block text-xs font-medium text-muted">
              Voice
              <select
                value={voiceUri}
                onChange={(e) => {
                  setVoiceUri(e.target.value);
                  voiceRef.current = e.target.value;
                }}
                className="mt-1 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-fg outline-none focus:border-ring"
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="mt-2 text-[11px] text-faint">
            Speed applies to the next sentence.
          </p>
        </div>
      )}
    </div>
  );
}
