// background.js — Service Worker for Tab Manager

function updateBadge() {
  chrome.tabs.query({}, (tabs) => {
    const urlCount = {};
    tabs.forEach(t => {
      if (t.url.startsWith('chrome-extension://') || t.url.startsWith('chrome://')) return;
      urlCount[t.url] = (urlCount[t.url] || 0) + 1;
    });

    const dupCount = Object.values(urlCount).filter(c => c > 1).length;

    if (dupCount > 0) {
      chrome.action.setBadgeText({ text: String(dupCount) });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  });
}

chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onUpdated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);
