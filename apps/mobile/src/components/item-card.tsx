import { Link } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ItemCard as Item } from "@zenow/shared";
import { useTheme } from "../theme";

const BADGES: Partial<Record<Item["source_type"], string>> = {
  research: "Research",
  pdf: "PDF",
  digest: "Week",
};

function hostOf(url: string): string {
  const match = /^[a-z]+:\/\/(?:www\.)?([^/]+)/i.exec(url);
  return match?.[1] ?? url;
}

export function ItemRow({ item, onArchive }: { item: Item; onArchive: (id: string) => void }) {
  const theme = useTheme();
  const badge = BADGES[item.source_type];
  const failed = item.status === "failed";

  return (
    <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.surface }]}>
      <Link href={`/item/${item.id}`} asChild>
        <Pressable style={styles.press}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.blank, { backgroundColor: theme.paper }]}>
              <Text style={{ color: theme.muted, fontSize: 22, fontWeight: "600" }}>
                {hostOf(item.url).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.body}>
            <View style={styles.metaRow}>
              {item.read ? null : <View style={[styles.unread, { backgroundColor: theme.accent }]} />}
              <Text numberOfLines={1} style={[styles.meta, { color: theme.muted }]}>
                {item.source_type === "research" || item.source_type === "digest"
                  ? "Zenow"
                  : hostOf(item.url)}
                {item.read_time_min ? ` · ${item.read_time_min} min` : ""}
              </Text>
              {badge ? (
                <Text style={[styles.badge, { backgroundColor: theme.accent }]}>{badge}</Text>
              ) : null}
            </View>

            <Text numberOfLines={2} style={[styles.title, { color: theme.ink }]}>
              {item.title ?? item.url}
            </Text>

            {item.error ? (
              <Text numberOfLines={2} style={[styles.lead, { color: failed ? theme.accent : theme.muted }]}>
                {failed ? item.error : `Retrying — ${item.error}`}
              </Text>
            ) : item.lead ? (
              <Text numberOfLines={2} style={[styles.lead, { color: theme.muted }]}>
                {item.lead}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link>

      <Pressable
        onPress={() => onArchive(item.id)}
        hitSlop={10}
        style={({ pressed }) => [styles.archive, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Text style={[styles.archiveText, { color: theme.muted }]}>
          {item.archived ? "Restore" : "Archive"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, marginBottom: 12, overflow: "hidden" },
  press: { flexDirection: "row", gap: 12, padding: 12 },
  thumb: { width: 88, height: 88, borderRadius: 10 },
  blank: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minHeight: 88 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  unread: { width: 6, height: 6, borderRadius: 3 },
  meta: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 1 },
  badge: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  title: { fontSize: 15, fontWeight: "600", lineHeight: 20, marginBottom: 3 },
  lead: { fontSize: 13, lineHeight: 18 },
  archive: { alignSelf: "flex-end", paddingHorizontal: 12, paddingBottom: 10, paddingTop: 2 },
  archiveText: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
});
