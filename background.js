const activeTabs = new Set();

chrome.action.onClicked.addListener(async (tab) => {
  const isActive = activeTabs.has(tab.id);

  if (isActive) {
    // Deactivate
    activeTabs.delete(tab.id);
    chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          window.dispatchEvent(new CustomEvent("contrast-check-deactivate"));
        },
      });
    } catch (e) {
      // Tab may have navigated away
    }
  } else {
    // Activate
    activeTabs.add(tab.id);
    chrome.action.setBadgeText({ tabId: tab.id, text: "ON" });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#22c55e" });
    chrome.action.setBadgeTextColor({ tabId: tab.id, color: "#ffffff" });

    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["content.css"],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch (e) {
      activeTabs.delete(tab.id);
      chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    }
  }
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

// Clean up when tab navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" && activeTabs.has(tabId)) {
    activeTabs.delete(tabId);
    chrome.action.setBadgeText({ tabId: tabId, text: "" });
  }
});
