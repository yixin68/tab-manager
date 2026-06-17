# Tab Manager Chrome Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that displays all open tabs in a dedicated management page, highlights duplicates, supports closing with flower bloom animation, and lets users defer tabs to a lightweight todo list.

**Architecture:** Single-page manager (opened as a Chrome tab) powered by vanilla JS. A background service worker detects duplicate tabs and updates the extension badge. Todo items persist via `chrome.storage.local`. All UI is DOM + CSS custom properties, no framework.

**Tech Stack:** Vanilla JS, CSS custom properties, Chrome Extension MV3 APIs

## Global Constraints

- Chrome Extension Manifest V3 — no `background.persistent`, use service worker
- Pure vanilla JS + CSS — no React, no build step, no bundler
- All CSS custom properties defined in `:root` as per design spec tokens
- `chrome.storage.local` for persistence — no sync
- Duplicate detection: URL exact match only
- Desktop-only (min-width 800px), no mobile breakpoints
- Chinese UI labels throughout
- All interactive elements must have focus-visible states
- Keyboard: Enter = activate tab, Delete = close, S = save to todo

## File Structure

```
tab-manager/
├── manifest.json              # MV3 manifest
├── background.js              # Service worker: duplicate detection, badge updates
├── manager/
│   ├── manager.html           # Manager page HTML shell
│   ├── manager.css            # All styles (tokens + components + animations)
│   └── manager.js             # Manager page logic (tab list, todo, search, flower)
├── popup/
│   ├── popup.html             # Extension popup HTML
│   ├── popup.css              # Popup styles
│   └── popup.js               # Popup logic (open manager page)
└── icons/
    ├── icon-16.png            # Extension icons (placeholder SVG → PNG later)
    ├── icon-48.png
    └── icon-128.png
```

---

### Task 1: Extension Scaffold & Manifest

**Files:**
- Create: `manifest.json`
- Create: `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`
- Create: `background.js` (stub)

**Interfaces:**
- Produces: `manifest.json` with permissions and entry points registered; `background.js` stub that loads without errors

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "标签管理",
  "version": "1.0.0",
  "description": "管理浏览器标签页，检测重复，一键关闭与待办收藏",
  "permissions": ["tabs", "storage"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

- [ ] **Step 2: Create placeholder icon files**

Generate minimal PNG icons using a canvas script:

```bash
cd /Users/laiyixin5/tab-manager
mkdir -p icons
node -e "
const { createCanvas } = require('canvas');
[16,48,128].forEach(s => {
  const c = createCanvas(s,s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(0,0,s,s);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + Math.round(s*0.6) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', s/2, s/2);
  require('fs').writeFileSync('icons/icon-'+s+'.png', c.toBuffer('image/png'));
});
"
```

If `canvas` is not available, create 1×1 transparent PNGs as placeholders:

```bash
cd /Users/laiyixin5/tab-manager
for s in 16 48 128; do
  printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > "icons/icon-${s}.png"
done
```

- [ ] **Step 3: Create background.js stub**

```js
// background.js — Service Worker for Tab Manager
// Duplicate detection and badge updates will be added in Task 6

chrome.runtime.onInstalled.addListener(() => {
  console.log('标签管理扩展已安装');
});
```

- [ ] **Step 4: Verify extension loads in Chrome**

Run: Manually load unpacked extension from `chrome://extensions` → Developer mode → Load unpacked → select `/Users/laiyixin5/tab-manager/`
Expected: Extension appears with name "标签管理", no errors in service worker console

- [ ] **Step 5: Commit**

```bash
git add manifest.json background.js icons/
git commit -m "feat: scaffold extension with manifest and placeholder icons"
```

---

### Task 2: Popup — Quick Entry Point

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.css`
- Create: `popup/popup.js`

**Interfaces:**
- Consumes: `chrome.tabs.query()` to count tabs and duplicates
- Produces: Button that opens `manager/manager.html` as a new tab

- [ ] **Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup">
    <h1 class="popup-title">标签管理</h1>
    <div class="popup-stats">
      <div class="stat">
        <span class="stat-value" id="tab-count">0</span>
        <span class="stat-label">打开的标签</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="dup-count">0</span>
        <span class="stat-label">重复页面</span>
      </div>
    </div>
    <button id="open-manager" class="btn-primary">打开标签管理</button>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 240px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #ffffff;
  color: #111827;
}

.popup {
  padding: 16px;
}

.popup-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.popup-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #3b82f6;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
}

.btn-primary {
  width: 100%;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 150ms;
}

.btn-primary:hover { background: #2563eb; }
.btn-primary:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
```

- [ ] **Step 3: Create popup.js**

```js
// popup.js

document.addEventListener('DOMContentLoaded', async () => {
  const tabs = await chrome.tabs.query({});
  // Filter out the manager page itself if open
  const normalTabs = tabs.filter(t => !t.url.startsWith('chrome-extension://'));
  const tabCountEl = document.getElementById('tab-count');
  const dupCountEl = document.getElementById('dup-count');

  tabCountEl.textContent = normalTabs.length;

  // Count duplicate URLs
  const urlCounts = {};
  normalTabs.forEach(t => {
    const url = t.url;
    urlCounts[url] = (urlCounts[url] || 0) + 1;
  });
  const dupUrls = Object.keys(urlCounts).filter(u => urlCounts[u] > 1);
  dupCountEl.textContent = dupUrls.length;

  // Open manager page
  document.getElementById('open-manager').addEventListener('click', () => {
    const managerUrl = chrome.runtime.getURL('manager/manager.html');
    chrome.tabs.create({ url: managerUrl });
    window.close();
  });
});
```

- [ ] **Step 4: Verify popup works**

Reload the extension in `chrome://extensions`, click the extension icon.
Expected: Popup shows tab count and duplicate count, clicking "打开标签管理" opens a blank tab at the manager URL (404 since manager.html doesn't exist yet — that's fine for now)

- [ ] **Step 5: Commit**

```bash
git add popup/
git commit -m "feat: add popup with tab stats and open-manager button"
```

---

### Task 3: Manager Page — HTML Shell & Design Tokens

**Files:**
- Create: `manager/manager.html`
- Create: `manager/manager.css` (design tokens + layout only)

**Interfaces:**
- Produces: HTML structure with all container elements that manager.js will populate; CSS custom properties matching the design spec

- [ ] **Step 1: Create manager.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>标签管理</title>
  <link rel="stylesheet" href="manager.css">
</head>
<body>
  <!-- Flower bloom overlay -->
  <div id="flower-container" class="flower-container"></div>

  <!-- Toast container -->
  <div id="toast-container" class="toast-container"></div>

  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <h1 class="header-title">标签管理 <span id="tab-count" class="tab-count"></span></h1>
    </div>
    <div class="header-center">
      <div class="search-bar" role="search" aria-label="搜索标签页">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.5"/>
          <line x1="10.5" y1="10.5" x2="15" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input type="text" id="search-input" class="search-input" placeholder="搜索标签..." aria-label="搜索标签页">
        <button id="search-clear" class="search-clear" aria-label="清除搜索" hidden>&times;</button>
      </div>
    </div>
    <div class="header-right">
      <button id="todo-toggle" class="todo-toggle" aria-expanded="false" aria-controls="todo-drawer">
        待办 <span id="todo-badge" class="todo-badge" hidden></span>
      </button>
    </div>
  </header>

  <!-- Main content -->
  <main class="main">
    <!-- Tab panel -->
    <div id="tab-panel" class="tab-panel">
      <div id="tab-list" class="tab-list"></div>
      <div id="empty-state" class="empty-state" hidden>
        <div class="empty-icon">📋</div>
        <p class="empty-text">没有打开的标签页</p>
      </div>
      <div id="no-results" class="empty-state" hidden>
        <div class="empty-icon">🔍</div>
        <p class="empty-text">未找到匹配的标签</p>
      </div>
    </div>

    <!-- Todo drawer -->
    <aside id="todo-drawer" class="todo-drawer" role="complementary" aria-label="待办列表" hidden>
      <div class="drawer-header">
        <h2 class="drawer-title">待办列表</h2>
      </div>
      <div class="drawer-tabs" role="tablist">
        <button class="drawer-tab" role="tab" aria-selected="true" data-tab="todo">待处理</button>
        <button class="drawer-tab" role="tab" aria-selected="false" data-tab="done">已完成</button>
      </div>
      <div id="todo-list" class="todo-list"></div>
      <div id="todo-empty" class="empty-state" hidden>
        <div class="empty-icon">📌</div>
        <p class="empty-text">暂无待办事项</p>
      </div>
      <div id="done-empty" class="empty-state" hidden>
        <div class="empty-icon">✅</div>
        <p class="empty-text">暂无已完成项</p>
      </div>
      <div class="drawer-footer">
        <button id="clear-done" class="btn-text" hidden>清空已完成</button>
      </div>
    </aside>
  </main>

  <script src="manager.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create manager.css with design tokens and layout**

```css
/* === Design Tokens === */
:root {
  /* Colors */
  --color-bg: #ffffff;
  --color-bg-hover: #f9fafb;
  --color-bg-subtle: #f3f4f6;
  --color-bg-active: #eff6ff;
  --color-fg: #111827;
  --color-fg-muted: #6b7280;
  --color-fg-subtle: #9ca3af;
  --color-border: #e5e7eb;
  --color-border-focus: #3b82f6;
  --color-duplicate: #f59e0b;
  --color-duplicate-bg: #fffbeb;
  --color-duplicate-border: #fbbf24;
  --color-success: #22c55e;
  --color-success-bg: #f0fdf4;
  --color-danger: #ef4444;
  --color-danger-bg: #fef2f2;
  --color-info: #3b82f6;
  --color-info-bg: #eff6ff;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  /* Layout */
  --header-height: 3.5rem;
  --drawer-width: 20rem;
  --tab-row-height: 3.5rem;

  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;

  /* Animation */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-out: cubic-bezier(0, 0, 0.2, 1);
  --easing-in: cubic-bezier(0.4, 0, 1, 1);

  /* Z-index */
  --z-base: 0;
  --z-header: 10;
  --z-drawer: 20;
  --z-confetti: 25;
  --z-toast: 30;
}

/* === Reset === */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--color-fg);
  background: var(--color-bg);
  min-height: 100vh;
}

/* === Header === */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--header-height);
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  padding: 0 var(--space-6);
  z-index: var(--z-header);
  gap: var(--space-4);
}

.header-left { flex-shrink: 0; }

.header-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.tab-count {
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  color: var(--color-fg-muted);
}

.header-center { flex: 1; display: flex; justify-content: center; }

.header-right { flex-shrink: 0; }

/* === Search === */
.search-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  width: 320px;
  transition: border-color var(--duration-fast) var(--easing-default),
              box-shadow var(--duration-fast) var(--easing-default);
}

.search-bar:focus-within {
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
}

.search-icon { color: var(--color-fg-subtle); flex-shrink: 0; }

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  background: transparent;
  color: var(--color-fg);
}

.search-input::placeholder { color: var(--color-fg-subtle); }

.search-clear {
  background: none;
  border: none;
  font-size: var(--text-lg);
  color: var(--color-fg-subtle);
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}

.search-clear:hover { color: var(--color-fg-muted); }

/* === Todo Toggle === */
.todo-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-fg);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing-default);
}

.todo-toggle:hover { background: var(--color-bg-hover); }

.todo-toggle:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

.todo-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: #fff;
  background: var(--color-danger);
  border-radius: var(--radius-full);
}

/* === Main Layout === */
.main {
  display: flex;
  margin-top: var(--header-height);
  min-height: calc(100vh - var(--header-height));
}

.tab-panel {
  flex: 1;
  padding: var(--space-4);
  overflow-y: auto;
}

/* === Empty States === */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  color: var(--color-fg-muted);
}

.empty-icon { font-size: 48px; margin-bottom: var(--space-4); }
.empty-text { font-size: var(--text-base); color: var(--color-fg-subtle); }

/* === Todo Drawer === */
.todo-drawer {
  width: var(--drawer-width);
  border-left: 1px solid var(--color-border);
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  transition: width var(--duration-normal) var(--easing-default);
}

.todo-drawer[hidden] {
  display: none;
}

.drawer-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.drawer-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

.drawer-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.drawer-tab {
  flex: 1;
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-fg-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color var(--duration-fast), border-color var(--duration-fast);
}

.drawer-tab[aria-selected="true"] {
  color: var(--color-info);
  border-bottom-color: var(--color-info);
}

.drawer-tab:hover { color: var(--color-fg); }

.drawer-tab:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: -2px;
}

.todo-list {
  flex: 1;
  padding: var(--space-2);
}

.drawer-footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  text-align: center;
}

.btn-text {
  font-size: var(--text-sm);
  color: var(--color-fg-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.btn-text:hover { color: var(--color-danger); }

.btn-text:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* === Flower Container === */
.flower-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: var(--z-confetti);
  overflow: hidden;
}

/* === Toast Container === */
.toast-container {
  position: fixed;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: var(--z-toast);
}
```

- [ ] **Step 3: Create minimal manager.js stub**

```js
// manager.js — Tab Manager page logic
// Will be implemented in Tasks 4–8

document.addEventListener('DOMContentLoaded', () => {
  console.log('标签管理页面已加载');
});
```

- [ ] **Step 4: Verify manager page opens**

Reload extension, click popup → "打开标签管理". Expected: blank page with header bar showing "标签管理", search input, and "待办" button. No console errors.

- [ ] **Step 5: Commit**

```bash
git add manager/
git commit -m "feat: add manager page HTML shell, design tokens, and layout CSS"
```

---

### Task 4: Tab List — Display Tabs Grouped by Window

**Files:**
- Modify: `manager/manager.js`
- Modify: `manager/manager.css`

**Interfaces:**
- Consumes: `chrome.tabs.query({})`, `chrome.windows.getAll()`
- Produces: DOM rendering of WindowGroup + TabRow elements; functions `renderTabs()` and `getDuplicateMap()` that later tasks rely on

- [ ] **Step 1: Add WindowGroup and TabRow CSS to manager.css**

Append to `manager/manager.css`:

```css
/* === Window Group === */
.window-group {
  margin-bottom: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg);
}

.window-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-subtle);
  cursor: pointer;
  user-select: none;
}

.window-header:hover { background: var(--color-bg-hover); }

.window-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-fg);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.window-arrow {
  display: inline-block;
  transition: transform var(--duration-fast) var(--easing-default);
  font-size: var(--text-xs);
}

.window-group.collapsed .window-arrow {
  transform: rotate(-90deg);
}

.window-group.collapsed .window-body {
  display: none;
}

.close-dup-btn {
  font-size: var(--text-xs);
  color: var(--color-duplicate);
  background: var(--color-duplicate-bg);
  border: 1px solid var(--color-duplicate-border);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  cursor: pointer;
  font-weight: var(--font-medium);
}

.close-dup-btn:hover { background: var(--color-duplicate-border); color: #fff; }

.close-dup-btn:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* === Tab Row === */
.tab-row {
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  min-height: var(--tab-row-height);
  transition: background var(--duration-fast), opacity var(--duration-normal), transform var(--duration-normal);
  border-left: 3px solid transparent;
}

.tab-row:last-child { border-bottom: none; }

.tab-row:hover { background: var(--color-bg-hover); }

.tab-row.active { background: var(--color-bg-active); }

.tab-row.closing {
  opacity: 0;
  transform: scale(0.95);
  pointer-events: none;
}

.tab-row.duplicate {
  border-left-color: var(--dup-color, var(--color-duplicate-border));
  background: var(--color-duplicate-bg);
}

.tab-favicon {
  width: 16px;
  height: 16px;
  margin-right: var(--space-3);
  flex-shrink: 0;
  border-radius: var(--radius-sm);
}

.tab-favicon-placeholder {
  width: 16px;
  height: 16px;
  margin-right: var(--space-3);
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-bg-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: var(--font-semibold);
  color: var(--color-fg-muted);
}

.tab-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.tab-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-url {
  font-size: var(--text-xs);
  color: var(--color-fg-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.dup-badge {
  font-size: var(--text-xs);
  color: var(--color-duplicate);
  background: var(--color-duplicate-bg);
  border: 1px solid var(--color-duplicate-border);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  margin-left: var(--space-2);
  flex-shrink: 0;
  font-weight: var(--font-medium);
}

.tab-actions {
  display: flex;
  gap: var(--space-1);
  margin-left: var(--space-3);
  opacity: 0.4;
  transition: opacity var(--duration-fast);
  flex-shrink: 0;
}

.tab-row:hover .tab-actions { opacity: 1; }

.tab-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--color-fg-muted);
  transition: background var(--duration-fast), color var(--duration-fast);
}

.tab-action-btn:hover { background: var(--color-bg-subtle); color: var(--color-fg); }
.tab-action-btn.close-btn:hover { background: var(--color-danger-bg); color: var(--color-danger); }
.tab-action-btn.todo-btn:hover { background: var(--color-info-bg); color: var(--color-info); }

.tab-action-btn:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 1px;
}
```

- [ ] **Step 2: Implement tab list rendering in manager.js**

Replace the stub `manager.js` with:

```js
// manager.js — Tab Manager page logic

const DUPLICATE_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16', '#f97316'];

let allTabs = [];
let duplicateMap = {};    // url → count
let duplicateColorMap = {}; // url → color
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

  // Filter out this manager page
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

  // Group by window
  const windowGroups = {};
  allTabs.forEach(t => {
    if (!windowGroups[t.windowId]) windowGroups[t.windowId] = [];
    windowGroups[t.windowId].push(t);
  });

  // Apply search filter
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

// === Init ===

document.addEventListener('DOMContentLoaded', async () => {
  const tabs = await chrome.tabs.query({});
  allTabs = tabs;
  renderTabs();

  // Listen for tab changes
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
});
```

- [ ] **Step 3: Add click delegation in manager.js**

Append to manager.js, inside the `DOMContentLoaded` handler, after the `chrome.tabs.onUpdated` listener:

```js
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
      chrome.windows.update(allTabs.find(t => t.id === tabId)?.windowId, { focused: true });
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
```

- [ ] **Step 4: Add closeTab, saveToTodo, closeDuplicatesInWindow stubs**

Append to manager.js (outside DOMContentLoaded):

```js
// === Tab Actions ===

function closeTab(tabId, rowEl) {
  // Animate out
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

  // Animate all duplicate rows
  toClose.forEach(id => {
    const row = document.querySelector(`.tab-row[data-tab-id="${id}"]`);
    if (row) row.classList.add('closing');
  });

  setTimeout(() => {
    chrome.tabs.remove(toClose);
  }, 200);
}
```

- [ ] **Step 5: Add toast function stub**

Append to manager.js:

```js
// === Toast ===

function showToast(message, duration = 2000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-exit');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}
```

- [ ] **Step 6: Add toast CSS**

Append to `manager/manager.css`:

```css
/* === Toast === */
.toast {
  padding: var(--space-2) var(--space-4);
  background: var(--color-fg);
  color: var(--color-bg);
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity var(--duration-normal) var(--easing-out),
              transform var(--duration-normal) var(--easing-out);
}

.toast-visible {
  opacity: 1;
  transform: translateY(0);
}

.toast-exit {
  opacity: 0;
  transform: translateY(-8px);
}
```

- [ ] **Step 7: Verify tab list renders**

Reload extension, open manager page. Expected: All open tabs shown grouped by window. Clicking a tab title activates it. Clicking ✕ closes a tab (with fade animation). Window groups collapse/expand.

- [ ] **Step 8: Commit**

```bash
git add manager/manager.js manager/manager.css
git commit -m "feat: render tab list grouped by window with close and activate"
```

---

### Task 5: Search Filtering

**Files:**
- Modify: `manager/manager.js`
- Modify: `manager/manager.css`

**Interfaces:**
- Consumes: `searchQuery` variable and `renderTabs()` from Task 4
- Produces: Real-time filtered view of tabs as user types

- [ ] **Step 1: Add search event handlers**

Inside the `DOMContentLoaded` handler in manager.js, append:

```js
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
```

- [ ] **Step 2: Verify search works**

Reload extension, open manager page, type in search box. Expected: Tab list filters in real-time (debounced 150ms). Clear button appears and works. "未找到匹配的标签" shows when no matches.

- [ ] **Step 3: Commit**

```bash
git add manager/manager.js
git commit -m "feat: add real-time search filtering for tabs"
```

---

### Task 6: Background Service Worker — Duplicate Badge

**Files:**
- Modify: `background.js`

**Interfaces:**
- Consumes: `chrome.tabs.query()`, `chrome.action.setBadgeText/setBadgeBackgroundColor`
- Produces: Extension icon badge showing count of URLs that have duplicates

- [ ] **Step 1: Implement badge update logic in background.js**

Replace background.js content:

```js
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
```

- [ ] **Step 2: Verify badge updates**

Reload extension. Open the same URL in two tabs. Expected: Red badge with "1" appears on the extension icon (1 URL has duplicates). Close one of the duplicates. Expected: Badge clears.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "feat: update extension badge with duplicate URL count"
```

---

### Task 7: Todo Drawer — Full CRUD

**Files:**
- Modify: `manager/manager.js`
- Modify: `manager/manager.css`

**Interfaces:**
- Consumes: `todoItems` array and `saveToTodo()` from Task 4; `chrome.storage.local` for persistence
- Produces: Drawer UI with todo/done tabs, reopen/mark-done/delete actions; `renderTodoList()` function

- [ ] **Step 1: Add todo item CSS**

Append to `manager/manager.css`:

```css
/* === Todo Item === */
.todo-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  transition: background var(--duration-fast);
}

.todo-item:hover { background: var(--color-bg-hover); }

.todo-item-favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
}

.todo-item-info {
  flex: 1;
  min-width: 0;
}

.todo-item-title {
  font-size: var(--text-sm);
  color: var(--color-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.todo-item-title:hover { color: var(--color-info); }

.todo-item-time {
  font-size: var(--text-xs);
  color: var(--color-fg-subtle);
  margin-top: 1px;
}

.todo-item-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.todo-item:hover .todo-item-actions { opacity: 1; }

.todo-item-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  color: var(--color-fg-muted);
  transition: background var(--duration-fast), color var(--duration-fast);
}

.todo-item-btn:hover { background: var(--color-bg-subtle); }
.todo-item-btn.reopen:hover { color: var(--color-info); background: var(--color-info-bg); }
.todo-item-btn.done:hover { color: var(--color-success); background: var(--color-success-bg); }
.todo-item-btn.delete:hover { color: var(--color-danger); background: var(--color-danger-bg); }

.todo-item-btn:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 1px;
}

.todo-item.status-done .todo-item-title {
  text-decoration: line-through;
  color: var(--color-fg-subtle);
}
```

- [ ] **Step 2: Add load todo from storage and drawer toggle in DOMContentLoaded**

Inside the `DOMContentLoaded` handler in manager.js, append:

```js
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
    todoToggle.textContent = drawerOpen ? '收起' : '待办';
    if (drawerOpen) {
      updateTodoBadge();
      const badge = document.getElementById('todo-badge');
      todoToggle.appendChild(badge);
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
```

- [ ] **Step 3: Add renderTodoList function**

Append to manager.js (outside DOMContentLoaded):

```js
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
```

- [ ] **Step 4: Add todo item click delegation**

Inside the `DOMContentLoaded` handler, append:

```js
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
```

- [ ] **Step 5: Verify todo drawer works**

Reload extension, open manager page. Click "待办" button to open drawer. Save a tab to todo. Expected: Tab closes, item appears in drawer. Click title to reopen. Click ✓ to mark done. Switch to "已完成" tab. Click 🗑 to delete. Click "清空已完成" to clear all done items.

- [ ] **Step 6: Commit**

```bash
git add manager/manager.js manager/manager.css
git commit -m "feat: add todo drawer with save, reopen, mark-done, delete, and storage persistence"
```

---

### Task 8: Flower Bloom Animation

**Files:**
- Modify: `manager/manager.js`
- Modify: `manager/manager.css`

**Interfaces:**
- Consumes: `closeTab()` function from Task 4
- Produces: Flower bloom animation triggered on tab close; `bloomFlower(x, y)` function

- [ ] **Step 1: Add flower animation CSS**

Append to `manager/manager.css`:

```css
/* === Flower Bloom === */
.petal {
  width: 8px;
  height: 12px;
  border-radius: 50% 0 50% 50%;
  position: absolute;
  pointer-events: none;
  animation: petal-bloom 600ms ease-out forwards,
             petal-drift 400ms ease-in 600ms forwards;
}

@keyframes petal-bloom {
  0%   { transform: scale(0) rotate(0deg); opacity: 1; }
  100% { transform: scale(1) rotate(var(--angle)); opacity: 1; }
}

@keyframes petal-drift {
  0%   { transform: translate(0, 0) rotate(var(--angle)); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) rotate(calc(var(--angle) + 90deg)); opacity: 0; }
}
```

- [ ] **Step 2: Add bloomFlower function to manager.js**

Append to manager.js (outside DOMContentLoaded):

```js
// === Flower Bloom ===

const PETAL_COLORS = ['#f9a8d4', '#fda4af', '#fdba74', '#fde68a', '#c4b5fd'];

function bloomFlower(x, y) {
  const container = document.getElementById('flower-container');
  const petalCount = 6 + Math.floor(Math.random() * 3); // 6–8 petals

  for (let i = 0; i < petalCount; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';

    const angle = (i / petalCount) * 360 + (Math.random() * 30 - 15);
    const spread = 20 + Math.random() * 30;
    const dx = Math.cos(angle * Math.PI / 180) * spread;
    const dy = Math.sin(angle * Math.PI / 180) * spread - 10; // slight upward bias

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
```

- [ ] **Step 3: Integrate flower bloom into closeTab**

Replace the existing `closeTab` function in manager.js:

```js
function closeTab(tabId, rowEl) {
  // Trigger flower bloom from tab row center
  if (rowEl) {
    const rect = rowEl.getBoundingClientRect();
    bloomFlower(rect.left + rect.width / 2, rect.top + rect.height / 2);
    rowEl.classList.add('closing');
  }

  setTimeout(() => {
    chrome.tabs.remove(tabId);
  }, 200);
}
```

- [ ] **Step 4: Also trigger bloom when closing duplicates**

In `closeDuplicatesInWindow`, update the loop that adds `closing` class to also bloom:

```js
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

  // Animate and bloom for each duplicate
  toClose.forEach(id => {
    const row = document.querySelector(`.tab-row[data-tab-id="${id}"]`);
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
```

- [ ] **Step 5: Verify flower bloom animation**

Reload extension, open manager page. Close a tab by clicking ✕. Expected: Small flower blooms from the center of the tab row — petals unfurl then drift and fade. The tab row shrinks and disappears. Try closing a duplicate — each duplicate row gets its own flower.

- [ ] **Step 6: Commit**

```bash
git add manager/manager.js manager/manager.css
git commit -m "feat: add flower bloom animation on tab close"
```

---

### Task 9: Focus-Visible & Keyboard Polish

**Files:**
- Modify: `manager/manager.css`

**Interfaces:**
- Consumes: existing component classes
- Produces: Consistent focus-visible outlines across all interactive elements

- [ ] **Step 1: Add global focus-visible styles**

Append to `manager/manager.css`:

```css
/* === Focus Visible === */
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}

/* Tab row focus */
.tab-row:focus-visible {
  background: var(--color-bg-active);
  outline-offset: -2px;
}

/* Remove default focus outline on mouse clicks */
button:focus:not(:focus-visible),
input:focus:not(:focus-visible) {
  outline: none;
}
```

- [ ] **Step 2: Verify keyboard navigation**

Open manager page. Press Tab to move through the interface. Expected: Each interactive element shows a clear blue outline. Press Enter on a tab row to activate it. Press Delete to close. Press S to save to todo.

- [ ] **Step 3: Commit**

```bash
git add manager/manager.css
git commit -m "feat: add focus-visible styles for keyboard accessibility"
```

---

### Task 10: End-to-End Verification

**Files:**
- No new files

- [ ] **Step 1: Full manual test pass**

Reload extension in `chrome://extensions`. Test every acceptance criterion:

1. Open manager page via popup button — all tabs visible, grouped by window
2. Open same URL in two tabs — both highlighted with same-color left border, `重复×2` badge
3. Click ✕ on a tab — flower bloom animation plays, tab closes
4. Click 📌 on a tab — tab closes, item appears in todo drawer, toast shows
5. Open todo drawer — items listed, click title reopens, ✓ marks done, 🗑 deletes
6. Switch between 待处理/已完成 tabs
7. Type in search — tabs filter in real-time
8. Click "关闭重复项" — all but one duplicate close, each with flower bloom
9. Extension badge shows duplicate count
10. Tab/Enter/Delete/S keyboard navigation works
11. All buttons have focus-visible outlines

- [ ] **Step 2: Fix any issues found**

Address any bugs discovered in Step 1.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: tab manager Chrome extension v1.0 complete"
```
