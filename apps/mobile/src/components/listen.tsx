import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { markdownToSpeech, speechChunks } from "@zenow/shared";
import { useTheme } from "../theme";

const RATES = [1, 1.25, 1.5, 0.75] as const;

export function Listen({
  title,
  summaryMd,
}: {
  title: string;
  summaryMd: string;
}) {
  const theme = useTheme();
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [spoken, setSpoken] = useState(0);
  const [rate, setRate] = useState<number>(1);

  const chunks = useRef<string[]>([]);
  const index = useRef(0);
  const rateRef = useRef(1);

  if (chunks.current.length === 0) {
    chunks.current = speechChunks(
      markdownToSpeech(`${title}.\n\n${summaryMd}`),
    );
  }

  // Leaving the screen mid-sentence should stop it, not leave a voice behind.
  useEffect(() => () => void Speech.stop(), []);

  const speakFrom = useCallback((start: number) => {
    const queue = chunks.current;
    if (start >= queue.length) {
      setPlaying(false);
      setSpoken(0);
      index.current = 0;
      return;
    }

    const chunk = queue[start];
    if (!chunk) return;

    index.current = start;
    setSpoken(start);
    setPlaying(true);
    setPaused(false);

    // One utterance at a time, chained on completion: a whole queue handed
    // over at once cannot be restarted at a new speed without losing the
    // place.
    Speech.speak(chunk, {
      rate: rateRef.current,
      onDone: () => speakFrom(start + 1),
      onStopped: () => undefined,
      onError: () => setPlaying(false),
    });
  }, []);

  async function toggle() {
    if (!playing) return speakFrom(0);

    if (paused) {
      setPaused(false);
      // Android has no resume, so it re-speaks the sentence it was in.
      if (await Speech.isSpeakingAsync()) await Speech.resume();
      else speakFrom(index.current);
      return;
    }

    setPaused(true);
    await Speech.pause();
  }

  async function stop() {
    await Speech.stop();
    setPlaying(false);
    setPaused(false);
    setSpoken(0);
    index.current = 0;
  }

  async function cycleRate() {
    const next =
      RATES[
        (RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length
      ] ?? 1;
    setRate(next);
    rateRef.current = next;
    if (playing) {
      await Speech.stop();
      speakFrom(index.current);
    }
  }

  if (chunks.current.length === 0) return null;

  const progress = playing ? (spoken + 1) / chunks.current.length : 0;

  return (
    <View
      style={[
        styles.bar,
        { borderColor: theme.line, backgroundColor: theme.surface },
      ]}
    >
      <Pressable
        onPress={toggle}
        style={[styles.play, { backgroundColor: theme.accent }]}
        accessibilityLabel={!playing || paused ? "Listen" : "Pause"}
      >
        <Text style={styles.glyph}>{!playing || paused ? "▶" : "❚❚"}</Text>
      </Pressable>

      <View style={styles.middle}>
        <Text style={[styles.label, { color: theme.ink }]}>
          {playing
            ? paused
              ? "Paused"
              : "Listening"
            : "Listen to the summary"}
        </Text>
        <View style={[styles.track, { backgroundColor: theme.line }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: theme.accent, width: `${progress * 100}%` },
            ]}
          />
        </View>
      </View>

      <Pressable
        onPress={cycleRate}
        hitSlop={8}
        style={[styles.rate, { borderColor: theme.line }]}
      >
        <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}>
          {rate}×
        </Text>
      </Pressable>

      {playing ? (
        <Pressable onPress={stop} hitSlop={8}>
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}>
            Stop
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  play: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: { color: "#fff", fontSize: 13 },
  middle: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
  rate: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
