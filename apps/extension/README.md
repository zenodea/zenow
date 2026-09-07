# Reader extension (Firefox)

Plain MV3, no build step. The files here are the extension.

## Try it without installing

    pnpm --filter @reader/extension start

Or load it by hand: `about:debugging#/runtime/this-firefox` → *Load Temporary
Add-on* → pick `manifest.json`. Temporary add-ons disappear on restart.

## Set it up

1. Mint a token: `pnpm --filter @reader/web token firefox`
2. Open the extension's options and paste the API address and the token.
   Saving asks for permission for that one host; the manifest requests no host
   access up front.

## Use it

- Toolbar button: shows the current tab and saves it.
- `Ctrl+Shift+U`: saves without opening the popup. The toolbar badge flashes
  `✓` for a new save, `=` if it was already in the list, `!` on an error.
- Right-click a link or a page: *Save link to Reader*.

The background page performs the request, so closing the popup cannot cancel a
save in flight.

## Install it permanently

Firefox will not load an unsigned extension outside of temporary loading, so
sign it against your own AMO account (free, unlisted is enough):

    pnpm --filter @reader/extension sign --api-key=... --api-secret=...

That writes a `.xpi` to `dist/`, which installs from `about:addons` →
*Install Add-on From File*.
