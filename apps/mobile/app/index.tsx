import * as Haptics from "expo-haptics";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ItemCard } from "@zenow/shared";
import {
  isPending,
  listByIds,
  listItems,
  listTags,
  saveUrl,
  setArchived,
  Unauthorized,
  type Filter,
} from "@/api";
import { readToken } from "@/auth";
import { ItemRow } from "@/components/item-card";
import { useTheme } from "@/theme";

const TABS = [
  { label: "All", filter: {} as Filter },
  { label: "Unread", filter: { unread: true } as Filter },
  { label: "Archive", filter: { archived: true } as Filter },
];

const POLL_MS = 4000;

export default function ListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: true });

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);

  const [items, setItems] = useState<ItemCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const filter = useMemo<Filter>(
    () => ({ ...TABS[tab]?.filter, ...(search ? { q: search } : {}), ...(tag ? { tag } : {}) }),
    [tab, search, tag],
  );

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (mode: "replace" | "more" | "refresh") => {
      if (mode === "refresh") setRefreshing(true);
      else if (mode === "replace") setLoading(true);

      try {
        const page = await listItems(filter, mode === "more" ? cursor : null);
        setItems((current) => (mode === "more" ? [...current, ...page.items] : page.items));
        setCursor(page.next_cursor);
        setError(null);
      } catch (caught) {
        if (caught instanceof Unauthorized) setSignedIn(false);
        else setError(caught instanceof Error ? caught.message : "Could not load your list");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, cursor],
  );

  useEffect(() => {
    void readToken().then((token) => setSignedIn(Boolean(token)));
  }, []);

  useEffect(() => {
    if (signedIn) void load("replace");
    // load changes with the cursor, which must not retrigger a full reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, filter]);

  useEffect(() => {
    if (!signedIn) return;
    void listTags()
      .then((body) => setTags(body.tags))
      .catch(() => undefined);
  }, [signedIn]);

  // Coming back from the reader, read state and archives may have changed.
  useFocusEffect(
    useCallback(() => {
      if (signedIn) void load("refresh");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signedIn, filter]),
  );

  const pendingIds = items.filter(isPending).map((item) => item.id);
  const pendingKey = pendingIds.join(",");

  // Only polls while something is still working, and only for those ids.
  useEffect(() => {
    if (!pendingKey) return;
    const timer = setInterval(async () => {
      try {
        const page = await listByIds(pendingKey.split(","));
        setItems((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          for (const item of page.items) byId.set(item.id, item);
          return [...byId.values()];
        });
      } catch {
        // A failed poll is the next tick's problem.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pendingKey]);

  const save = useCallback(
    async (url: string) => {
      setSaving(true);
      try {
        const { id } = await saveUrl(url);
        setDraft("");
        Keyboard.dismiss();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push(`/item/${id}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save that");
      } finally {
        setSaving(false);
      }
    },
    [router],
  );

  // A link shared from another app is the reason this is an app.
  useEffect(() => {
    if (!hasShareIntent || !signedIn) return;
    const shared = shareIntent.webUrl ?? shareIntent.text?.match(/https?:\/\/\S+/)?.[0];
    resetShareIntent();
    if (shared) void save(shared);
  }, [hasShareIntent, shareIntent, signedIn, resetShareIntent, save]);

  async function archive(id: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((current) => current.filter((candidate) => candidate.id !== id));

    try {
      await setArchived(id, !item.archived);
    } catch {
      // Put it back rather than lie about what happened.
      setItems((current) => [...current, item].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setError("Could not archive that");
    }
  }

  if (signedIn === false) {
    return (
      <View style={styles.centre}>
        <Text style={[styles.emptyTitle, { color: theme.ink }]}>Sign in to see your list</Text>
        <Text style={[styles.emptyBody, { color: theme.muted }]}>
          It opens your browser, and this device gets a token of its own.
        </Text>
        <Link href="/settings" asChild>
          <Pressable style={[styles.cta, { backgroundColor: theme.accent }]}>
            <Text style={styles.ctaText}>Sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ItemRow item={item} onArchive={archive} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={theme.muted} />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (cursor && !loading && !refreshing) void load("more");
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.compose, { borderColor: theme.line, backgroundColor: theme.surface }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Paste a link"
                placeholderTextColor={theme.muted}
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="url"
                returnKeyType="go"
                onSubmitEditing={() => draft.trim() && void save(draft.trim())}
                style={[styles.composeInput, { color: theme.ink }]}
              />
              <Pressable
                onPress={() => draft.trim() && void save(draft.trim())}
                disabled={!draft.trim() || saving}
                style={[
                  styles.saveButton,
                  { backgroundColor: theme.accent, opacity: !draft.trim() || saving ? 0.4 : 1 },
                ]}
              >
                <Text style={styles.saveText}>{saving ? "…" : "Save"}</Text>
              </Pressable>
            </View>

            <View style={styles.tabs}>
              {TABS.map((entry, index) => (
                <Pressable
                  key={entry.label}
                  onPress={() => setTab(index)}
                  style={[styles.tab, index === tab && { backgroundColor: theme.ink }]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: index === tab ? theme.paper : theme.muted,
                    }}
                  >
                    {entry.label}
                  </Text>
                </Pressable>
              ))}

              <Link href="/settings" asChild>
                <Pressable style={[styles.tab, styles.settings, { borderColor: theme.line }]}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: theme.muted }}>Account</Text>
                </Pressable>
              </Link>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your list"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              style={[styles.search, { borderColor: theme.line, backgroundColor: theme.surface, color: theme.ink }]}
            />

            {tags.length > 0 ? (
              <View style={styles.tags}>
                {tags.slice(0, 12).map(({ tag: name, count }) => (
                  <Pressable
                    key={name}
                    onPress={() => setTag(tag === name ? null : name)}
                    style={[
                      styles.chip,
                      { borderColor: theme.line },
                      tag === name && { backgroundColor: theme.accentSoft, borderColor: theme.accent },
                    ]}
                  >
                    <Text style={{ fontSize: 11, color: tag === name ? theme.accent : theme.muted }}>
                      {name} {count}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {error ? <Text style={[styles.error, { color: theme.accent }]}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={theme.muted} />
          ) : (
            <Text style={[styles.empty, { color: theme.muted }]}>
              {search || tag ? "Nothing matches that." : "Nothing here yet. Paste a link above."}
            </Text>
          )
        }
        ListFooterComponent={
          cursor && items.length > 0 ? <ActivityIndicator style={{ marginVertical: 20 }} color={theme.muted} /> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12, marginBottom: 12 },
  compose: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, padding: 5, paddingLeft: 16 },
  composeInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  saveButton: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  tabs: { flexDirection: "row", gap: 6, alignItems: "center" },
  tab: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999 },
  settings: { borderWidth: 1, marginLeft: "auto" },
  search: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, fontSize: 13 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  error: { fontSize: 13 },
  empty: { textAlign: "center", marginTop: 64, fontSize: 14 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  cta: { borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
