import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { API_URL, forgetToken, pairDevice, PairingCancelled, readTokenName } from "@/auth";
import { whoAmI } from "@/api";
import { useTheme } from "@/theme";

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    setName(await readTokenName());
    try {
      await whoAmI();
      setConnected(true);
    } catch {
      setConnected(false);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect() {
    try {
      await pairDevice();
      await refresh();
      router.replace("/");
    } catch (error) {
      if (error instanceof PairingCancelled) return;
      Alert.alert("Could not connect", error instanceof Error ? error.message : "Try again");
    }
  }

  function disconnect() {
    Alert.alert("Disconnect this device?", "The token stays revocable from the web app too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          await forgetToken();
          await refresh();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.surface }]}>
        <Text style={[styles.label, { color: theme.muted }]}>Connected to</Text>
        <Text style={[styles.value, { color: theme.ink }]}>{API_URL.replace(/^https?:\/\//, "")}</Text>

        <Text style={[styles.label, { color: theme.muted, marginTop: 16 }]}>This device</Text>
        <Text style={[styles.value, { color: connected ? theme.ink : theme.accent }]}>
          {checking ? "Checking…" : connected ? (name ?? "connected") : "Not connected"}
        </Text>
      </View>

      <Pressable
        onPress={connected ? disconnect : connect}
        style={[
          styles.button,
          connected
            ? { borderColor: theme.line, borderWidth: 1 }
            : { backgroundColor: theme.accent },
        ]}
      >
        <Text style={{ color: connected ? theme.muted : "#fff", fontWeight: "700", fontSize: 15 }}>
          {connected ? "Disconnect" : "Sign in"}
        </Text>
      </Pressable>

      <Text style={[styles.note, { color: theme.muted }]}>
        Signing in happens in your browser, so the app never sees your password. It ends up holding a
        token for this device alone, which you can revoke under Settings → Extension tokens.
      </Text>

      <Pressable onPress={() => void Linking.openURL(`${API_URL}/settings`)}>
        <Text style={[styles.link, { color: theme.accent }]}>Open Zenow settings in a browser</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  label: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: "600" },
  button: { borderRadius: 999, paddingVertical: 13, alignItems: "center" },
  note: { fontSize: 13, lineHeight: 20 },
  link: { fontSize: 14, fontWeight: "600" },
});
