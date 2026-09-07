const titleEl = document.getElementById("title");
const hostEl = document.getElementById("host");
const saveButton = document.getElementById("save");
const resultEl = document.getElementById("result");

let currentTab;

async function init() {
  [currentTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!currentTab?.url) {
    titleEl.textContent = "Nothing to save";
    return;
  }
  titleEl.textContent = currentTab.title ?? currentTab.url;
  hostEl.textContent = new URL(currentTab.url).hostname.replace(/^www\./, "");
  saveButton.disabled = false;
}

// The background page does the request so closing the popup cannot cancel it.
saveButton.addEventListener("click", async () => {
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  resultEl.textContent = "";

  const result = await browser.runtime.sendMessage({ type: "save", url: currentTab.url });

  if (!result?.ok) {
    resultEl.innerHTML = "";
    const error = document.createElement("span");
    error.className = "error";
    error.textContent = result?.error ?? "Could not save";
    resultEl.append(error);
    saveButton.disabled = false;
    saveButton.textContent = "Save";
    return;
  }

  saveButton.textContent = result.created ? "Saved" : "Already saved";
  const link = document.createElement("a");
  link.href = new URL(`/items/${result.id}`, result.apiBase).toString();
  link.target = "_blank";
  link.textContent = "Open in Reader";
  resultEl.append(link);
});

document.getElementById("options").addEventListener("click", (event) => {
  event.preventDefault();
  browser.runtime.openOptionsPage();
});

init();
