# Zenow for iOS and Android

Expo, one codebase, talking to the same API as everything else. It imports
`@zenow/shared` directly, so `ItemCard`, the list query and the save request
are the same zod schemas the web app and the worker validate against — the
client cannot drift from the contract without failing to compile.

## Run it

    pnpm --filter @zenow/mobile start

The share extension and background audio are native, so this needs a **dev
build** rather than Expo Go:

    pnpm --filter @zenow/mobile prebuild
    pnpm --filter @zenow/mobile ios      # or android

## Signing in

There is no password field. *Sign in* opens `/pair` in the system browser,
where you are already signed in or can be, and it hands back a token for that
one device through the `zenow://auth` deep link. The token lives in the
keychain, is only readable when the phone is unlocked, and is revocable on its
own under Settings → Extension tokens on the web.

The app never sees a password, and losing the phone costs one token.

## What it does that the web app cannot

- **Share → Zenow** from any app, on iOS as well as Android. Safari has never
  supported the Web Share Target API, so this is the whole reason the phone
  wants an app rather than the installed PWA.
- **Listen with the screen locked.** `expo-speech` is the platform
  synthesiser and `UIBackgroundModes: audio` keeps it running in your pocket,
  which is when you actually wanted it. The browser's `speechSynthesis` stops
  the moment the screen goes off.

## Notes

`react-native` and friends are pinned to what Expo SDK 57 bundles, not to
latest — `npx expo install --check` is the authority, and taking latest gets
you a Metro that cannot find react-native's own polyfills.

Metro is pointed at the workspace root and keeps hierarchical lookup on, which
is what lets pnpm's layout resolve each package's own dependencies.
