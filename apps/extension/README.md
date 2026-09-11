# Zenow extension (Firefox)

Plain MV3, no build step. The files here are the extension.

## Try it without installing

    pnpm --filter @zenow/extension start

Or load it by hand: `about:debugging#/runtime/this-firefox` → *Load Temporary
Add-on* → pick `manifest.json`. Temporary add-ons disappear on restart.

## Set it up

1. Sign in to [news.zenodea.com](https://news.zenodea.com), open `/settings` →
   *Extension tokens* → **Create token**. It is shown once and stored as a
   sha256, so a lost one is revoked and replaced rather than looked up.
2. Open the extension's options and paste the token. The address is fixed at
   `news.zenodea.com`; saving asks for permission for that one host, which the
   manifest does not request up front.

There is also `pnpm --filter @zenow/web token <tenant-id> [name]` for a shell,
but it needs a database url and your tenant id, which the page does not.

## Use it

- Toolbar button: shows the current tab and saves it.
- `Ctrl+Shift+U`: saves without opening the popup. The toolbar badge flashes
  `✓` for a new save, `=` if it was already in the list, `!` on an error.
- Right-click a link or a page: *Save link to Zenow*.

The background page performs the request, so closing the popup cannot cancel a
save in flight.

## Install it permanently

Firefox will not load an unsigned extension outside of temporary loading, so
sign it against your own AMO account (free, unlisted is enough):

    pnpm --filter @zenow/extension sign --api-key=... --api-secret=...

That writes a `.xpi` to `dist/`, which installs from `about:addons` →
*Install Add-on From File*.
