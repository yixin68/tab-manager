// popup.js

document.addEventListener('DOMContentLoaded', async () => {
  const tabs = await chrome.tabs.query({});
  const normalTabs = tabs.filter(t => !t.url.startsWith('chrome-extension://'));
  const tabCountEl = document.getElementById('tab-count');
  const dupCountEl = document.getElementById('dup-count');

  tabCountEl.textContent = normalTabs.length;

  const urlCounts = {};
  normalTabs.forEach(t => {
    const url = t.url;
    urlCounts[url] = (urlCounts[url] || 0) + 1;
  });
  const dupUrls = Object.keys(urlCounts).filter(u => urlCounts[u] > 1);
  dupCountEl.textContent = dupUrls.length;

  document.getElementById('open-manager').addEventListener('click', () => {
    const managerUrl = chrome.runtime.getURL('manager/manager.html');
    chrome.tabs.create({ url: managerUrl });
    window.close();
  });
});
