import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ItemDetail } from "@zenow/shared";
import { deleteItem, getItem, markRead, retryItem, setArchived } from "@/api";
import { Listen } from "@/components/listen";
import { Markdown } from "@/components/markdown";
import { useTheme } from "@/theme";

const POLL_MS = 3000;

function hostOf(url: string): string {
  const match = /^[a-z]+:\/\/(?:www\.)?([^/]+)/i.exec(url);
  return match?.[1] ?? url;
}

function byline(item: ItemDetail): string {
  const meta = item.content?.meta ?? {};
  const parts: string[] = [item.url.startsWith("zenow:") ? "Zenow" : hostOf(item.url)];

  const author = meta.author ?? meta.byline ?? meta.channel ?? meta.subreddit;
  if (typeof author === "string" && author.trim()) parts.push(author.trim());
  if (typeof meta.pages === "number") parts.push(`${meta.pages} pages`);
  if (item.read_time_min) parts.push(`${item.read_time_min} min read`);

  return parts.join("  ·  ");
}

export default function ItemScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const marked = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const detail = await getItem(id);
      setItem(detail);
      setError(null);

      // The first open is the one that counts, and the server ignores the rest.
      if (!marked.current && !detail.read) {
        marked.current = true;
        void markRead(id).catch(() => undefined);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load that");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Something still being fetched or summarised finishes while you watch.
  const pending = item !== null && item.status !== "done" && item.status !== "failed";
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [pending, load]);

  if (error) {
    return (
      <View style={styles.centre}>
        <Text style={{ color: theme.accent, fontSize: 15, textAlign: "center" }}>{error}</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={theme.muted} />
      </View>
    );
  }

  const detail = item;
  const hero = item.summary?.images[0];
  const rest = item.summary?.images.slice(1) ?? [];

  async function act(run: () => Promise<void>, after?: () => void) {
    setBusy(true);
    try {
      await run();
      after?.();
    } catch (caught) {
      Alert.alert("That did not work", caught instanceof Error ? caught.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete this item?", "The summary goes with it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void act(() => deleteItem(detail.id), () => router.back()),
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={[styles.byline, { color: theme.muted }]}>{byline(item)}</Text>
      <Text style={[styles.title, { color: theme.ink }]}>{item.title ?? item.url}</Text>

      {item.tags.length > 0 ? (
        <View style={styles.tags}>
          {item.tags.map((tag) => (
            <View key={tag} style={[styles.chip, { borderColor: theme.line }]}>
              <Text style={{ fontSize: 11, color: theme.muted }}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {pending ? (
        <View style={[styles.status, { borderColor: theme.line, backgroundColor: theme.surface }]}>
          <ActivityIndicator size="small" color={theme.muted} />
          <Text style={{ color: theme.muted, fontSize: 14 }}>
            {item.status === "fetching" ? "Fetching the page…" : "Writing the summary…"}
          </Text>
        </View>
      ) : null}

      {item.error ? (
        <Text
          style={[
            styles.error,
            {
              borderColor: theme.line,
              backgroundColor: item.status === "failed" ? theme.accentSoft : theme.surface,
              color: item.status === "failed" ? theme.accent : theme.muted,
            },
          ]}
        >
          {item.status === "failed" ? item.error : `Still trying — ${item.error}`}
        </Text>
      ) : null}

      {hero ? (
        <View style={styles.figure}>
          <Image source={{ uri: hero.url }} style={styles.image} resizeMode="cover" />
          <Text style={[styles.caption, { color: theme.muted }]}>{hero.caption}</Text>
        </View>
      ) : null}

      {item.summary ? (
        <>
          <Listen
            title={item.title ?? "This item"}
            summaryMd={[...item.summary.key_points, item.summary.summary_md].join("\n\n")}
          />

          {item.summary.key_points.length > 0 ? (
            <View style={[styles.points, { borderColor: theme.line, backgroundColor: theme.surface }]}>
              {item.summary.key_points.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                  <Text style={[styles.point, { color: theme.ink }]}>{point}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Markdown>{item.summary.summary_md}</Markdown>

          {rest.map((image) => (
            <View key={image.url} style={styles.figure}>
              <Image source={{ uri: image.url }} style={styles.image} resizeMode="cover" />
              <Text style={[styles.caption, { color: theme.muted }]}>{image.caption}</Text>
            </View>
          ))}
        </>
      ) : null}

      <View style={styles.actions}>
        {item.url.startsWith("zenow:") ? null : (
          <Pressable
            onPress={() => void Linking.openURL(item.url)}
            style={[styles.action, { borderColor: theme.line }]}
          >
            <Text style={[styles.actionText, { color: theme.muted }]}>Original</Text>
          </Pressable>
        )}

        <Pressable
          disabled={busy}
          onPress={() => void act(() => setArchived(item.id, !item.archived), () => router.back())}
          style={[styles.action, { borderColor: theme.line }]}
        >
          <Text style={[styles.actionText, { color: theme.muted }]}>
            {item.archived ? "Restore" : "Archive"}
          </Text>
        </Pressable>

        <Pressable
          disabled={busy}
          onPress={() => void act(() => retryItem(item.id), load)}
          style={[styles.action, { borderColor: theme.line }]}
        >
          <Text style={[styles.actionText, { color: theme.muted }]}>
            {item.url.startsWith("zenow:") ? "Re-run" : "Re-read"}
          </Text>
        </Pressable>

        <Pressable disabled={busy} onPress={confirmDelete} style={[styles.action, { borderColor: theme.line }]}>
          <Text style={[styles.actionText, { color: theme.accent }]}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  byline: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  title: { fontSize: 27, fontWeight: "700", lineHeight: 34, marginBottom: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 20 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  status: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 20 },
  error: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 20, fontSize: 14, overflow: "hidden" },
  figure: { marginBottom: 24 },
  image: { width: "100%", aspectRatio: 16 / 9, borderRadius: 14 },
  caption: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  points: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 24, gap: 12 },
  pointRow: { flexDirection: "row", gap: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  point: { flex: 1, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  action: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  actionText: { fontSize: 12, fontWeight: "600" },
});
