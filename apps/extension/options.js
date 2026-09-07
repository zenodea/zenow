const apiBaseInput = document.getElementById("apiBase");
const tokenInput = document.getElementById("token");
const statusEl = document.getElementById("status");

browser.storage.local.get({ apiBase: "", token: "" }).then((settings) => {
  apiBaseInput.value = settings.apiBase;
  tokenInput.value = settings.token;
});

document.getElementById("save").addEventListener("click", async () => {
  let origin;
  try {
    origin = `${new URL(apiBaseInput.value).origin}/*`;
  } catch {
    statusEl.textContent = "That is not a valid address.";
    return;
  }

  // Asked for here rather than declared in the manifest, so the extension only
  // ever gets access to the one host it actually talks to.
  const granted = await browser.permissions.request({ origins: [origin] });
  if (!granted) {
    statusEl.textContent = "Permission for that address was declined.";
    return;
  }

  await browser.storage.local.set({
    apiBase: apiBaseInput.value.replace(/\/+$/, ""),
    token: tokenInput.value.trim(),
  });
  statusEl.textContent = "Saved.";
});
