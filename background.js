const MENU_ID = "copy-highlight-link";

function ensureContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Select & Highlight",
      contexts: ["selection"]
    });
  });
}

chrome.runtime.onInstalled.addListener(ensureContextMenu);
chrome.runtime.onStartup.addListener(ensureContextMenu);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  try {
    const selectedText = (info.selectionText || "").trim();
    if (!selectedText) {
      await showBadge(tab.id, "Fail", "#e74c3c");
      return;
    }

    const normalized = selectedText.replace(/\s+/g, " ").slice(0, 300);
    const baseUrl = new URL(tab.url || "");
    baseUrl.hash = "";
    const fragment = `#:~:text=${encodeURIComponent(normalized)}`;
    const link = `${baseUrl.toString()}${fragment}`;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copyTextToClipboard,
      args: [link]
    });

    const result = results?.[0]?.result;
    if (result?.ok) {
      await showBadge(tab.id, "Copied", "#2ecc71");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showToast,
        args: ["Link copied"]
      });
    } else {
      console.warn("Copy failed:", result?.error || "Unknown error");
      await showBadge(tab.id, "Fail", "#e74c3c");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showToast,
        args: ["Copy failed"]
      });
    }
  } catch (err) {
    console.error("Execute script failed:", err);
  }
});

async function showBadge(tabId, text, color) {
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" });
  }, 1500);
}

function copyTextToClipboard(text) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success
      ? { ok: true }
      : { ok: false, error: "Clipboard write failed" };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function showToast(message) {
  try {
    const existing = document.getElementById("copy-highlight-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "copy-highlight-toast";
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.right = "24px";
    toast.style.zIndex = "2147483647";
    toast.style.background = "rgba(0, 0, 0, 0.85)";
    toast.style.color = "#fff";
    toast.style.padding = "10px 14px";
    toast.style.borderRadius = "8px";
    toast.style.font = "12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    toast.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 150ms ease";

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 200);
    }, 1200);
  } catch {
    // ignore
  }
}
