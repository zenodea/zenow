const HOST = "https://news.zenodea.com/*";

const tokenInput = document.getElementById("token");
const statusEl = document.getElementById("status");

browser.storage.local.get({ token: "" }).then((settings) => {
  tokenInput.value = settings.token;
});

document.getElementById("save").addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    statusEl.textContent = "Paste a token first.";
    return;
  }

  // Asked for here rather than declared in the manifest, so the extension only
  // ever gets access to the one host it actually talks to.
  const granted = await browser.permissions.request({ origins: [HOST] });
  if (!granted) {
    statusEl.textContent = "Permission for news.zenodea.com was declined.";
    return;
  }

  await browser.storage.local.set({ token });
  statusEl.textContent = "Saved.";
});
