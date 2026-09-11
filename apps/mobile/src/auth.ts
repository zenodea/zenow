import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

const TOKEN_KEY = "zenow.token";
const NAME_KEY = "zenow.token.name";

export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "https://news.zenodea.com";

export async function readToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function readTokenName(): Promise<string | null> {
  return SecureStore.getItemAsync(NAME_KEY);
}

async function store(token: string, name: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(NAME_KEY, name);
}

export async function forgetToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(NAME_KEY);
}

function deviceName(): string {
  const model = Constants.deviceName?.trim();
  if (model) return model.slice(0, 40);
  return Platform.OS === "ios" ? "iphone" : "android";
}

export class PairingCancelled extends Error {
  constructor() {
    super("Pairing was cancelled");
    this.name = "PairingCancelled";
  }
}

/**
 * Signing in happens in a browser, not here. The app never sees a password,
 * and what it ends up holding is a token for this device that can be revoked
 * on its own.
 */
export async function pairDevice(): Promise<string> {
  const url = `${API_URL}/pair?device=${encodeURIComponent(deviceName())}`;
  const result = await WebBrowser.openAuthSessionAsync(url, Linking.createURL("auth"));

  if (result.type !== "success") throw new PairingCancelled();

  const token = Linking.parse(result.url).queryParams?.token;
  if (typeof token !== "string" || !token) throw new Error("No token came back from pairing");

  const name = Linking.parse(result.url).queryParams?.name;
  await store(token, typeof name === "string" && name ? name : deviceName());
  return token;
}
