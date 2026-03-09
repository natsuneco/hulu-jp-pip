const isHuluJP = (url?: string): boolean =>
  /^https:\/\/([^.]+\.)?hulu\.jp\//.test(url ?? "");

const activeIconPath = {
  16: chrome.runtime.getURL("icons/16.png"),
  32: chrome.runtime.getURL("icons/32.png"),
  48: chrome.runtime.getURL("icons/48.png"),
  64: chrome.runtime.getURL("icons/64.png"),
  128: chrome.runtime.getURL("icons/128.png"),
} as const;

const inactiveIconPath = {
  16: chrome.runtime.getURL("icons/16-gray.png"),
  32: chrome.runtime.getURL("icons/32-gray.png"),
  48: chrome.runtime.getURL("icons/48-gray.png"),
  64: chrome.runtime.getURL("icons/64-gray.png"),
  128: chrome.runtime.getURL("icons/128-gray.png"),
} as const;

const updateIconState = (tabId: number, url?: string): void => {
  chrome.action.setIcon({
    tabId,
    path: isHuluJP(url) ? activeIconPath : inactiveIconPath,
  });
};

const syncAllTabsIconState = (): void => {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id !== undefined) {
        updateIconState(tab.id, tab.url);
      }
    });
  });
};

chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
  updateIconState(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    updateIconState(tabId, tab.url);
  });
});

chrome.runtime.onStartup.addListener(syncAllTabsIconState);
chrome.runtime.onInstalled.addListener(syncAllTabsIconState);

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined || !isHuluJP(tab.url)) {
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["dist/content.js"],
  });
});
