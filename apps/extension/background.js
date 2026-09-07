const SETTINGS = { apiBase: "", token: "" };

async function readSettings() {
  return browser.storage.local.get(SETTINGS);
}

/** Single place that talks to the API, so popup, shortcut and menu agree. */
async function saveUrl(url, savedFrom) {
  const { apiBase, token } = await readSettings();
  if (!apiBase || !token) {
    return { ok: false, error: "Set the API address and token in the extension options first." };
  }

  let response;
  try {
    response = await fetch(new URL("/api/items", apiBase).toString(), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ url, saved_from: savedFrom }),
    });
  } catch {
    return { ok: false, error: `Could not reach ${apiBase}` };
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, error: body?.error ?? `Reader returned ${response.status}` };
  }
  return { ok: true, id: body.id, created: body.created, apiBase };
}

/** The popup may already be closed, so feedback goes on the toolbar icon. */
async function flashBadge(text, color) {
  await browser.action.setBadgeBackgroundColor({ color });
  await browser.action.setBadgeText({ text });
  setTimeout(() => browser.action.setBadgeText({ text: "" }), 2500);
}

async function saveAndFlash(url, savedFrom) {
  const result = await saveUrl(url, savedFrom);
  if (!result.ok) await flashBadge("!", "#b00020");
  else await flashBadge(result.created ? "✓" : "=", "#ef4056");
  return result;
}

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "save") return saveUrl(message.url, message.savedFrom ?? "extension");
  return undefined;
});

browser.commands.onCommand.addListener(async (command) => {
  if (command !== "save-tab") return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) await saveAndFlash(tab.url, "extension");
});

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "save-link",
    title: "Save link to Reader",
    contexts: ["link"],
  });
  browser.contextMenus.create({
    id: "save-page",
    title: "Save this page to Reader",
    contexts: ["page"],
  });
});

browser.contextMenus.onClicked.addListener(async (info) => {
  const url = info.menuItemId === "save-link" ? info.linkUrl : info.pageUrl;
  if (url) await saveAndFlash(url, "extension");
});
