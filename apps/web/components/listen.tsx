"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markdownToSpeech, speechChunks } from "@zenow/shared";

const RATES = [1, 1.25, 1.5, 0.75] as const;
const RATE_KEY = "zenow:speech-rate";

/**
 * Chrome stops speaking after about fifteen seconds unless something pokes it.
 * Firefox does not need this and does not mind it.
 */
const KEEPALIVE_MS = 10_000;

function storedRate(): number {
  try {
    const raw = Number(localStorage.getItem(RATE_KEY));
    return RATES.includes(raw as (typeof RATES)[number]) ? raw : 1;
  } catch {
    return 1;
  }
}

/** The best voice available for the language, preferring one that is local. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((voice) => voice.lang.startsWith("en"));
  const pool = english.length ? english : voices;
  return pool.find((voice) => voice.localService) ?? pool[0] ?? null;
}

export function Listen({ title, summaryMd }: { title: string; summaryMd: string }) {
  const [supported, setSupported] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [spoken, setSpoken] = useState(0);
  const [rate, setRate] = useState(1);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // Read inside callbacks that outlive the render they were made in.
  const indexRef = useRef(0);
  const rateRef = useRef(1);

  const chunks = useMemo(
    () => speechChunks(markdownToSpeech(`${title}.\n\n${summaryMd}`)),
    [title, summaryMd],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    setRate(storedRate());

    const load = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices());
    };
    load();
    // Voices arrive asynchronously on first load in most browsers.
    window.speechSynthesis.addEventListener("voiceschanged", load);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    if (!playing || paused) return;
    const timer = setInterval(() => window.speechSynthesis.resume(), KEEPALIVE_MS);
    return () => clearInterval(timer);
  }, [playing, paused]);

  const speakFrom = useCallback(
    (start: number) => {
      const synth = window.speechSynthesis;
      synth.cancel();

      for (const [offset, chunk] of chunks.slice(start).entries()) {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.rate = rateRef.current;
        if (voiceRef.current) utterance.voice = voiceRef.current;

        utterance.addEventListener("start", () => {
          indexRef.current = start + offset;
          setSpoken(start + offset);
        });

        if (start + offset === chunks.length - 1) {
          utterance.addEventListener("end", () => {
            setPlaying(false);
            setPaused(false);
            setSpoken(0);
            indexRef.current = 0;
          });
        }

        synth.speak(utterance);
      }

      setPlaying(true);
      setPaused(false);
    },
    [chunks],
  );

  if (!supported || chunks.length === 0) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (!playing) return speakFrom(0);
    if (paused) {
      synth.resume();
      setPaused(false);
      return;
    }
    synth.pause();
    setPaused(true);
  }

  function stop() {
    window.speechSynthesis.cancel();
    setPlaying(false);
    setPaused(false);
    setSpoken(0);
    indexRef.current = 0;
  }

  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length] ?? 1;
    setRate(next);
    rateRef.current = next;
    try {
      localStorage.setItem(RATE_KEY, String(next));
    } catch {
      // A remembered speed is a nicety, not a requirement.
    }
    // A rate change only affects utterances not yet queued, so the queue is
    // rebuilt from wherever it had got to.
    if (playing) speakFrom(indexRef.current);
  }

  const progress = playing ? (spoken + 1) / chunks.length : 0;

  return (
    <div className="mb-8 flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={!playing || paused ? "Listen" : "Pause"}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white transition hover:opacity-90"
      >
        {!playing || paused ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 translate-x-px">
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {playing ? (paused ? "Paused" : "Listening") : "Listen to the summary"}
        </p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={cycleRate}
        className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-medium tabular-nums text-muted transition hover:border-accent hover:text-accent"
      >
        {rate}×
      </button>

      {playing ? (
        <button
          type="button"
          onClick={stop}
          className="shrink-0 text-xs font-medium text-muted transition hover:text-accent"
        >
          Stop
        </button>
      ) : null}
    </div>
  );
}
