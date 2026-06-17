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
        favicon = `<img class="tab-favicon" src="${escapeHtml(tab.favIconUrl)}" alt="" data-fallback><div class="tab-favicon-placeholder" style="display:none">${getFirstLetter(tab.title)}</div>`;
      } else {
        favicon = `<div class="tab-favicon-placeholder">${getFirstLetter(tab.title)}</div>`;
      }

      html += `<div class="tab-card${isDup ? ' duplicate' : ''}" data-tab-id="${tab.id}" style="--dup-color:${dupColor}" tabindex="0" role="listitem" aria-label="标签页: ${escapeHtml(tab.title)}, ${escapeHtml(tab.url)}">`;
      html += `<div class="tab-card-header">`;
      html += favicon;
      html += `<div class="tab-info" data-action="activate-tab" data-tab-id="${tab.id}">`;
      html += `<div class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</div>`;
      html += `<div class="tab-url">${escapeHtml(tab.url)}</div>`;
      html += `</div>`;
      html += `</div>`;
      html += `<div class="tab-card-footer">`;
      if (isDup) {
        html += `<span class="dup-badge">重复×${dupCount}</span>`;
      } else {
        html += `<span></span>`;
      }
      html += `<div class="tab-actions">`;
      html += `<button class="tab-action-btn todo-btn" data-action="save-todo" data-tab-id="${tab.id}" aria-label="存为待办" title="存为待办，并关闭标签页">📌</button>`;
      html += `<button class="tab-action-btn close-btn" data-action="close-tab" data-tab-id="${tab.id}" aria-label="关闭标签页" title="关闭标签页">✕</button>`;
      html += `</div>`;
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
  if (rowEl) {
    const rect = rowEl.getBoundingClientRect();
    bloomFlower(rect.left + rect.width / 2, rect.top + rect.height / 2);
    rowEl.classList.add('closing');
  }
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

  closeTab(tabId, document.querySelector(`.tab-card[data-tab-id="${tabId}"]`));
  showToast('已添加到待办');
  updateTodoBadge();
  if (drawerOpen) renderTodoList();
}

function closeDuplicatesInWindow(windowId) {
  // windowId may be string from data attribute, normalize to number
  const wid = Number(windowId);
  const windowTabs = allTabs.filter(t => t.windowId === wid);
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
    const row = document.querySelector(`.tab-card[data-tab-id="${id}"]`);
    if (row) {
      const rect = row.getBoundingClientRect();
      bloomFlower(rect.left + rect.width / 2, rect.top + rect.height / 2);
      row.classList.add('closing');
    }
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

// === Todo List ===

function renderTodoList() {
  const list = document.getElementById('todo-list');
  const todoEmpty = document.getElementById('todo-empty');
  const doneEmpty = document.getElementById('done-empty');
  const clearDoneBtn = document.getElementById('clear-done');

  const filtered = todoItems.filter(i =>
    todoActiveTab === 'todo' ? i.status === 'todo' : i.status === 'done'
  );

  const doneCount = todoItems.filter(i => i.status === 'done').length;
  clearDoneBtn.hidden = todoActiveTab !== 'done' || doneCount === 0;

  if (filtered.length === 0) {
    list.innerHTML = '';
    todoEmpty.hidden = todoActiveTab !== 'todo';
    doneEmpty.hidden = todoActiveTab !== 'done';
    return;
  }

  todoEmpty.hidden = true;
  doneEmpty.hidden = true;

  list.innerHTML = filtered.map(item => `
    <div class="todo-item${item.status === 'done' ? ' status-done' : ''}" data-todo-id="${item.id}">
      <div class="todo-item-info">
        <div class="todo-item-title" data-action="reopen-todo" data-todo-id="${item.id}" title="${escapeHtml(item.url)}">${escapeHtml(item.title)}</div>
        <div class="todo-item-time">${timeAgo(item.createdAt)}</div>
      </div>
      <div class="todo-item-actions">
        <button class="todo-item-btn reopen" data-action="reopen-todo" data-todo-id="${item.id}" aria-label="重新打开" title="重新打开">↗</button>
        <button class="todo-item-btn done" data-action="mark-done" data-todo-id="${item.id}" aria-label="标记完成" title="标记完成">✓</button>
        <button class="todo-item-btn delete" data-action="delete-todo" data-todo-id="${item.id}" aria-label="删除" title="删除">🗑</button>
      </div>
    </div>
  `).join('');
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

// === Flower Bloom ===

const PETAL_COLORS = ['#f9a8d4', '#fda4af', '#fdba74', '#fde68a', '#c4b5fd'];

function bloomFlower(x, y) {
  const container = document.getElementById('flower-container');
  const petalCount = 6 + Math.floor(Math.random() * 3); // 6-8 petals

  for (let i = 0; i < petalCount; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';

    const angle = (i / petalCount) * 360 + (Math.random() * 30 - 15);
    const spread = 20 + Math.random() * 30;
    const dx = Math.cos(angle * Math.PI / 180) * spread;
    const dy = Math.sin(angle * Math.PI / 180) * spread - 10;

    const color = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
    const delay = Math.random() * 40;
    const rotation = 180 + Math.random() * 180;

    petal.style.cssText = `
      left: ${x}px;
      top: ${y}px;
      background: ${color};
      --angle: ${rotation}deg;
      --dx: ${dx}px;
      --dy: ${dy}px;
      animation-delay: ${delay}ms, ${600 + delay}ms;
    `;

    petal.addEventListener('animationend', (e) => {
      if (e.animationName === 'petal-drift') petal.remove();
    });

    container.appendChild(petal);
  }
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

  // Favicon error fallback (can't use inline onerror due to MV3 CSP)
  document.getElementById('tab-list').addEventListener('error', (e) => {
    const img = e.target;
    if (img.classList.contains('tab-favicon') && img.dataset.fallback !== undefined) {
      img.style.display = 'none';
      const placeholder = img.nextElementSibling;
      if (placeholder) placeholder.style.display = 'flex';
    }
  }, true);

  // Event delegation for tab actions
  document.getElementById('tab-list').addEventListener('click', (e) => {
    // Check closest action element — buttons inside other action containers
    // (e.g. close-dup-btn inside window-header) must match themselves first
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    if (action === 'close-duplicates') {
      e.stopPropagation();
      closeDuplicatesInWindow(parseInt(target.dataset.windowId));
    } else if (action === 'toggle-window') {
      target.closest('.window-group').classList.toggle('collapsed');
    } else if (action === 'activate-tab') {
      const tabId = parseInt(target.dataset.tabId);
      chrome.tabs.update(tabId, { active: true });
      const tab = allTabs.find(t => t.id === tabId);
      if (tab) chrome.windows.update(tab.windowId, { focused: true });
    } else if (action === 'close-tab') {
      closeTab(parseInt(target.dataset.tabId), target.closest('.tab-card'));
    } else if (action === 'save-todo') {
      saveToTodo(parseInt(target.dataset.tabId));
    }
  });

  // Keyboard navigation on tab rows
  document.getElementById('tab-list').addEventListener('keydown', (e) => {
    const row = e.target.closest('.tab-card');
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

  // Load todo items from storage
  chrome.storage.local.get('todoItems', (data) => {
    todoItems = data.todoItems || [];
    updateTodoBadge();
  });

  // Todo drawer toggle
  const todoToggle = document.getElementById('todo-toggle');
  const todoDrawer = document.getElementById('todo-drawer');

  todoToggle.addEventListener('click', () => {
    drawerOpen = !drawerOpen;
    todoDrawer.hidden = !drawerOpen;
    todoToggle.setAttribute('aria-expanded', drawerOpen);
    document.getElementById('todo-toggle-text').textContent = drawerOpen ? '收起' : '待办';
    if (drawerOpen) {
      updateTodoBadge();
      const badge = document.getElementById('todo-badge');
      if (badge) todoToggle.appendChild(badge);
      renderTodoList();
    }
  });

  // Drawer tab switching
  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      todoActiveTab = tab.dataset.tab;
      document.querySelectorAll('.drawer-tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === todoActiveTab));
      renderTodoList();
    });
  });

  // Clear done button
  document.getElementById('clear-done').addEventListener('click', () => {
    todoItems = todoItems.filter(i => i.status !== 'done');
    chrome.storage.local.set({ todoItems });
    renderTodoList();
  });

  // Todo item actions delegation
  document.getElementById('todo-list').addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const todoId = target.dataset.todoId;
    const item = todoItems.find(i => i.id === todoId);
    if (!item) return;

    if (action === 'reopen-todo') {
      chrome.tabs.create({ url: item.url });
      showToast('已在新标签页打开', 1500);
    } else if (action === 'mark-done') {
      item.status = item.status === 'done' ? 'todo' : 'done';
      chrome.storage.local.set({ todoItems });
      renderTodoList();
      updateTodoBadge();
      if (item.status === 'done') showToast('已标记完成', 1500);
    } else if (action === 'delete-todo') {
      todoItems = todoItems.filter(i => i.id !== todoId);
      chrome.storage.local.set({ todoItems });
      renderTodoList();
      updateTodoBadge();
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
