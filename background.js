// Unique ID for the context-menu entry
const MENU_ID = "copy-highlight-link";

// Create (or re-create) the context-menu entry
const ensureContextMenu = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Select & Highlight",
      contexts: ["selection"],
    });
  });
};

chrome.runtime.onInstalled.addListener(ensureContextMenu);
chrome.runtime.onStartup.addListener(ensureContextMenu);

/**
 * Returns true when the URL belongs to a restricted scheme where
 * content scripts cannot be injected (chrome://, edge://, about:, etc.).
 */
const isRestrictedUrl = (url) => {
  if (!url) return true;
  return /^(chrome|edge|about|devtools|chrome-extension):\/\//i.test(url);
};

// Handle context-menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  try {
    const selectedText = (info.selectionText || "").trim();
    if (!selectedText) {
      await showBadge(tab.id, "Fail", "#e74c3c");
      return;
    }

    // Normalize whitespace, limit length, and URL-encode for a safe text fragment
    const normalized = selectedText.replace(/\s+/g, " ").slice(0, 300);
    const baseUrl = new URL(tab.url || "");
    baseUrl.hash = "";
    const link = `${baseUrl.toString()}#:~:text=${encodeURIComponent(normalized)}`;

    // Fall back to badge-only on restricted pages (e.g. chrome://)
    if (isRestrictedUrl(tab.url)) {
      console.warn("Cannot inject scripts on restricted page:", tab.url);
      await showBadge(tab.id, "Fail", "#e74c3c");
      return;
    }

    // Inject clipboard-write helper into the active tab
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copyTextToClipboard,
      args: [link],
    });

    const result = results?.[0]?.result;
    if (result?.ok) {
      await showBadge(tab.id, "Copied", "#2ecc71");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showToast,
        args: ["Link copied"],
      });
    } else {
      console.warn("Copy failed:", result?.error || "Unknown error");
      await showBadge(tab.id, "Fail", "#e74c3c");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showToast,
        args: ["Copy failed"],
      });
    }
  } catch (err) {
    // Script injection failed (e.g. restricted page) — show badge as fallback
    console.error("Execute script failed:", err);
    try {
      await showBadge(tab.id, "Fail", "#e74c3c");
    } catch {
      // Badge API may also fail if the tab closed
    }
  }
});

// Show a brief status badge on the extension icon
const showBadge = async (tabId, text, color) => {
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" });
  }, 1500);
};

/**
 * Injected into the page — copies `text` to the clipboard using the
 * modern async Clipboard API. All variables are block-scoped within
 * the try/catch to avoid polluting the host page's globals.
 */
async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Injected into the page — shows a short-lived toast notification.
 * Wrapped in an IIFE to keep all variables in block scope and
 * ensure the element is fully removed from the DOM after fading out.
 */
function showToast(message) {
  (() => {
    try {
      const TOAST_ID = "copy-highlight-toast";

      // Remove any lingering toast from a previous invocation
      const existing = document.getElementById(TOAST_ID);
      if (existing) existing.remove();

      const toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.textContent = message;
      Object.assign(toast.style, {
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: "2147483647",
        background: "rgba(0, 0, 0, 0.85)",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: "8px",
        font: '12px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
        opacity: "0",
        transition: "opacity 150ms ease",
      });

      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
      });

      // Fade out, then fully remove the element from the DOM
      setTimeout(() => {
        toast.style.opacity = "0";
        toast.addEventListener(
          "transitionend",
          () => toast.remove(),
          { once: true }
        );
        // Safety net: remove even if transitionend never fires
        setTimeout(() => {
          document.getElementById(TOAST_ID)?.remove();
        }, 500);
      }, 1200);
    } catch {
      // Silently ignore — toast is non-critical UI
    }
  })();
}
