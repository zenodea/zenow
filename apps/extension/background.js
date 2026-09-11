const API_BASE = "https://news.zenodea.com";

/** Single place that talks to the API, so popup, shortcut and menu agree. */
async function saveUrl(url, savedFrom) {
  const { token } = await browser.storage.local.get({ token: "" });
  if (!token) {
    return { ok: false, error: "Paste a token in the extension options first." };
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/api/items`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ url, saved_from: savedFrom }),
    });
  } catch {
    return { ok: false, error: `Could not reach ${API_BASE}` };
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, error: body?.error ?? `Zenow returned ${response.status}` };
  }
  return { ok: true, id: body.id, created: body.created, apiBase: API_BASE };
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
    title: "Save link to Zenow",
    contexts: ["link"],
  });
  browser.contextMenus.create({
    id: "save-page",
    title: "Save this page to Zenow",
    contexts: ["page"],
  });
});

browser.contextMenus.onClicked.addListener(async (info) => {
  const url = info.menuItemId === "save-link" ? info.linkUrl : info.pageUrl;
  if (url) await saveAndFlash(url, "extension");
});
