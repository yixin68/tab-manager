// manager.js — Tab Manager page logic

const DUPLICATE_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16', '#f97316'];

let allTabs = [];
let duplicateMap = {};
let duplicateColorMap = {};
let searchQuery = '';
let drawerOpen = false;
let todoActiveTab = 'todo';
let todoItems = [];

// === Duplicate Detection ===

function computeDuplicates(tabs) {
  const urlCount = {};
  tabs.forEach(t => {
    if (t.url.startsWith('chrome-extension://')) return;
    urlCount[t.url] = (urlCount[t.url] || 0) + 1;
  });

  duplicateMap = {};
  duplicateColorMap = {};
  let colorIndex = 0;
  for (const [url, count] of Object.entries(urlCount)) {
    if (count > 1) {
      duplicateMap[url] = count;
      duplicateColorMap[url] = DUPLICATE_COLORS[colorIndex % DUPLICATE_COLORS.length];
      colorIndex++;
    }
  }
}

// === Rendering ===

function renderTabs() {
  const tabList = document.getElementById('tab-list');
  const emptyState = document.getElementById('empty-state');
  const noResults = document.getElementById('no-results');
  const tabCount = document.getElementById('tab-count');

  const managerUrl = chrome.runtime.getURL('manager/manager.html');
  allTabs = allTabs.filter(t => t.url !== managerUrl);

  computeDuplicates(allTabs);
  tabCount.textContent = `(${allTabs.length})`;

  if (allTabs.length === 0) {
    tabList.innerHTML = '';
    emptyState.hidden = false;
    noResults.hidden = true;
    return;
  }

  emptyState.hidden = true;

  const windowGroups = {};
  allTabs.forEach(t => {
    if (!windowGroups[t.windowId]) windowGroups[t.windowId] = [];
    windowGroups[t.windowId].push(t);
  });

  const query = searchQuery.toLowerCase();
  let hasResults = false;

  let html = '';
  let windowIndex = 0;
  for (const [windowId, tabs] of Object.entries(windowGroups)) {
    const filtered = query
      ? tabs.filter(t => t.title.toLowerCase().includes(query) || t.url.toLowerCase().includes(query))
      : tabs;

    if (filtered.length === 0) continue;
    hasResults = true;

    const hasDups = filtered.some(t => duplicateMap[t.url]);

    windowIndex++;
    html += `<div class="window-group" data-window-id="${windowId}">`;
    html += `<div class="window-header" data-action="toggle-window">`;
    html += `<div class="window-title"><span class="window-arrow">▼</span> 窗口 ${windowIndex} (${filtered.length}个标签)</div>`;
    if (hasDups) {
      html += `<button class="close-dup-btn" data-action="close-duplicates" data-window-id="${windowId}">关闭重复项</button>`;
    }
    html += `</div>`;
    html += `<div class="window-body">`;

    filtered.forEach(tab => {
      const isDup = !!duplicateMap[tab.url];
      const dupColor = isDup ? duplicateColorMap[tab.url] : '';
      const dupCount = duplicateMap[tab.url] || 0;

      let favicon = '';
      if (tab.favIconUrl && !tab.url.startsWith('chrome://')) {
        favicon = `<img class="tab-favicon" src="${escapeHtml(tab.favIconUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="tab-favicon-placeholder" style="display:none">${getFirstLetter(tab.title)}</div>`;
      } else {
        favicon = `<div class="tab-favicon-placeholder">${getFirstLetter(tab.title)}</div>`;
      }

      html += `<div class="tab-row${isDup ? ' duplicate' : ''}" data-tab-id="${tab.id}" style="--dup-color:${dupColor}" tabindex="0" role="listitem" aria-label="标签页: ${escapeHtml(tab.title)}, ${escapeHtml(tab.url)}">`;
      html += favicon;
      html += `<div class="tab-info" data-action="activate-tab" data-tab-id="${tab.id}">`;
      html += `<div class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</div>`;
      html += `<div class="tab-url">${escapeHtml(tab.url)}</div>`;
      html += `</div>`;
      if (isDup) {
        html += `<span class="dup-badge">重复×${dupCount}</span>`;
      }
      html += `<div class="tab-actions">`;
      html += `<button class="tab-action-btn todo-btn" data-action="save-todo" data-tab-id="${tab.id}" aria-label="存为待办" title="存为待办">📌</button>`;
      html += `<button class="tab-action-btn close-btn" data-action="close-tab" data-tab-id="${tab.id}" aria-label="关闭" title="关闭">✕</button>`;
      html += `</div>`;
      html += `</div>`;
    });

    html += `</div></div>`;
  }

  tabList.innerHTML = html;
  noResults.hidden = hasResults;
  updateTodoBadge();
}

// === Helpers ===

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getFirstLetter(title) {
  if (!title) return '?';
  return title.charAt(0).toUpperCase();
}

function updateTodoBadge() {
  const badge = document.getElementById('todo-badge');
  const pending = todoItems.filter(i => i.status === 'todo').length;
  if (pending > 0) {
    badge.textContent = pending;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

// === Tab Actions ===

function closeTab(tabId, rowEl) {
  if (rowEl) rowEl.classList.add('closing');
  setTimeout(() => {
    chrome.tabs.remove(tabId);
  }, 200);
}

function saveToTodo(tabId) {
  const tab = allTabs.find(t => t.id === tabId);
  if (!tab) return;

  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    url: tab.url,
    title: tab.title,
    status: 'todo',
    createdAt: Date.now()
  };

  todoItems.unshift(item);
  chrome.storage.local.set({ todoItems });

  closeTab(tabId, document.querySelector(`.tab-row[data-tab-id="${tabId}"]`));
  showToast('已添加到待办');
  updateTodoBadge();
  if (drawerOpen) renderTodoList();
}

function closeDuplicatesInWindow(windowId) {
  const windowTabs = allTabs.filter(t => t.windowId === windowId);
  const seen = {};
  const toClose = [];

  windowTabs.forEach(t => {
    if (seen[t.url]) {
      toClose.push(t.id);
    } else {
      seen[t.url] = true;
    }
  });

  if (toClose.length === 0) return;

  toClose.forEach(id => {
    const row = document.querySelector(`.tab-row[data-tab-id="${id}"]`);
    if (row) row.classList.add('closing');
  });

  setTimeout(() => {
    chrome.tabs.remove(toClose);
  }, 200);
}

// === Toast ===

function showToast(message, duration = 2000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-exit');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}

// === Init ===

document.addEventListener('DOMContentLoaded', async () => {
  const tabs = await chrome.tabs.query({});
  allTabs = tabs;
  renderTabs();

  chrome.tabs.onCreated.addListener(tab => {
    allTabs.push(tab);
    renderTabs();
  });

  chrome.tabs.onRemoved.addListener(tabId => {
    allTabs = allTabs.filter(t => t.id !== tabId);
    renderTabs();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const idx = allTabs.findIndex(t => t.id === tabId);
    if (idx !== -1) {
      allTabs[idx] = tab;
      renderTabs();
    }
  });

  // Event delegation for tab actions
  document.getElementById('tab-list').addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const tabId = parseInt(target.dataset.tabId);

    if (action === 'toggle-window') {
      target.closest('.window-group').classList.toggle('collapsed');
    } else if (action === 'activate-tab') {
      chrome.tabs.update(tabId, { active: true });
      const tab = allTabs.find(t => t.id === tabId);
      if (tab) chrome.windows.update(tab.windowId, { focused: true });
    } else if (action === 'close-tab') {
      closeTab(tabId, target.closest('.tab-row'));
    } else if (action === 'save-todo') {
      saveToTodo(tabId);
    } else if (action === 'close-duplicates') {
      closeDuplicatesInWindow(parseInt(target.dataset.windowId));
    }
  });

  // Keyboard navigation on tab rows
  document.getElementById('tab-list').addEventListener('keydown', (e) => {
    const row = e.target.closest('.tab-row');
    if (!row) return;
    const tabId = parseInt(row.dataset.tabId);

    if (e.key === 'Enter') {
      chrome.tabs.update(tabId, { active: true });
    } else if (e.key === 'Delete') {
      closeTab(tabId, row);
    } else if (e.key === 's' || e.key === 'S') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        saveToTodo(tabId);
      }
    }
  });

  // Search
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  let searchTimer = null;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      searchClear.hidden = !searchQuery;
      renderTabs();
    }, 150);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.hidden = true;
    renderTabs();
    searchInput.focus();
  });
});
