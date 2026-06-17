# Tab Manager Chrome Extension — UI/UX Design Spec

## 0. Discovery

**Target users:** Knowledge workers, researchers, PMs who routinely accumulate 20-100+ browser tabs across multiple windows.

**Product goal:** Reduce tab clutter anxiety by providing a single, scannable view of all open tabs with tools to close, deduplicate, and defer tabs.

**Device/usage context:** Desktop Chrome. Used in short bursts — glance, act, close. The manager page is a tool, not a destination.

**Existing constraints:** Pure vanilla JS + CSS (no framework). Chrome Extension MV3. Must work offline.

**Accessibility expectations:** Keyboard-navigable list; screen-reader announcements for duplicate warnings; focus-visible states on all interactive elements.

---

## 1. User Flows

### Flow 1: View and close duplicate tabs

**Goal:** Quickly identify and close redundant tabs.

**Trigger:** User clicks extension icon → "打开标签管理" or `Alt+T` shortcut.

```
[Open Manager Page]
    │
    ▼
[See all tabs grouped by window]
    │
    ▼
[Duplicate tabs highlighted with colored left-border + badge "×N"]
    │
    ◇ Has duplicates?
    │
    ├── Yes ──▶ Click "关闭重复项" on group header → keeps 1, closes rest
    │
    └── No ────▶ No action needed
    │
    ▼
[Closed tabs fade out (200ms), group count updates]
```

### Flow 2: Save tab to todo and close it

**Goal:** Defer a tab for later without losing it.

```
[See a tab in the list]
    │
    ▼
[Click "存为待办" icon button]
    │
    ▼
[Tab closes, item appears in todo panel with fade-in (150ms)]
    │
    ▼
[Toast: "已添加到待办" auto-dismisses after 2s]
```

### Flow 3: Reopen a todo item

**Goal:** Return to a previously deferred page.

```
[Open todo panel via header button]
    │
    ▼
[See list grouped by status: 待处理 / 已完成]
    │
    ▼
[Click item title → opens in new tab]
    │
    ◇ Mark as done?
    │
    ├── Yes ──▶ Click "完成" → item moves to 已完成 tab
    │
    └── No ────▶ Item stays in 待处理
```

### State coverage

| State | What user sees |
|-------|---------------|
| **Empty (no tabs)** | Centered illustration + "没有打开的标签页" |
| **Empty todo** | Centered "暂无待办事项" + subtle hint text |
| **Loading** | Tabs populate immediately from `chrome.tabs.query` — no loading spinner needed |
| **Duplicate detected** | Colored left-border (amber) + `重复 ×2` badge on each duplicate tab row; badge count on extension icon |
| **Search no results** | "未找到匹配的标签" in list area |

---

## 2. Component Specs

### Component: AppShell

**Purpose:** Top-level layout container — fixed header + scrollable body.

**Variants:** N/A (single layout)

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Header (fixed, h-14)                       │
├────────────────────────┬────────────────────┤
│                        │                    │
│  TabPanel (scrollable) │ TodoDrawer         │
│  flex-1                │ w-80, collapsible  │
│                        │                    │
└────────────────────────┴────────────────────┘
```

**States:**

| State | Visual | Behavior |
|-------|--------|----------|
| Drawer closed | TodoDrawer width = 0, TabPanel fills 100% | Toggle button in header shows "待办 (3)" |
| Drawer open | TodoDrawer width = 320px, TabPanel fills remainder | Toggle button shows "收起" |

**Responsive:** This is a Chrome tab page — always desktop-width (min 800px). No mobile breakpoint needed.

---

### Component: Header

**Purpose:** Page title, tab count, search, and todo toggle.

**Layout:**
```
┌────────────────────────────────────────────────────┐
│  🗂 标签管理 (23)     [🔍 搜索标签...]   [待办 (5)] │
└────────────────────────────────────────────────────┘
```

**Props/Data:**
- `tabCount: number` — total open tabs (excluding manager page itself)
- `todoCount: number` — pending todo items
- `onSearch(query: string)` — filter callback
- `onToggleTodo()` — open/close drawer

**States:**

| State | Visual |
|-------|--------|
| Default | Title left, search center, todo button right |
| Search focused | Search input expands, subtle ring `--color-border-focus` |
| Todo badge | Red dot with count if > 0 pending items |

**Accessibility:**
- Search: `role="search"`, `aria-label="搜索标签页"`
- Todo button: `aria-expanded={drawerOpen}`, `aria-controls="todo-drawer"`

---

### Component: WindowGroup

**Purpose:** Collapsible card showing all tabs belonging to one Chrome window.

**Layout:**
```
┌──────────────────────────────────────────────┐
│ ▼ 窗口 1 (8个标签)            [关闭重复项]   │
│ ┌──────────────────────────────────────────┐ │
│ │ 🌐 Page Title              [📌] [✕]     │ │
│ │    example.com/page                      │ │
│ ├──────────────────────────────────────────┤ │
│ │ 🌐 Another Page  重复×2     [📌] [✕]     │ │
│ │    example.com/another    ████ amber     │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Props/Data:**
- `windowId: number`
- `tabs: TabItem[]`
- `duplicates: Map<string, number>` — URL → count of duplicates in this window
- `collapsed: boolean`
- `onToggleCollapse()`
- `onCloseDuplicates(url: string)`

**States:**

| State | Visual |
|-------|--------|
| Expanded | Full tab list visible |
| Collapsed | Only header row visible |
| Has duplicates | "关闭重复项" button visible in header |
| No tabs (after closing all) | Group auto-removes with 200ms fade-out |

**Animations:**

| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Collapse | Height shrinks to header | 200ms | ease-in-out |
| Expand | Height grows | 200ms | ease-in-out |
| Remove group | Fade out + collapse | 300ms | ease-in |

---

### Component: TabRow

**Purpose:** Single tab entry — shows favicon, title, URL, duplicate badge, and action buttons.

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ [favicon] Page Title Here         重复×2  [📌][✕]│
│           example.com/page-url-path              │
└─────────────────────────────────────────────────┘
```

**Props/Data:**
- `tab: { id, url, title, favIconUrl }`
- `isDuplicate: boolean`
- `duplicateCount: number`
- `duplicateColor: string` — shared color for same-URL group
- `onClose()`
- `onSaveToTodo()`

**States:**

| State | Visual | Behavior |
|-------|--------|----------|
| Default | No border highlight | Click title → activate tab |
| Duplicate | 3px left border in `amber-400`, `重复×N` badge | Same URL tabs share border color |
| Hover | Background `--color-bg-hover` | Action buttons become more visible |
| Closing | Fade out + shrink | 200ms, then remove from DOM |
| Active (current) | Subtle `blue-50` background tint | — |

**Accessibility:**
- Role: `listitem`
- `aria-label="标签页: {title}, {url}"`
- Duplicate: adds `aria-describedby` pointing to duplicate announcement
- Keyboard: `Enter` = activate tab, `Delete` = close, `S` = save to todo

**Edge cases:**
- Missing favicon → show first-letter placeholder (styled circle with letter)
- Very long title → truncate with ellipsis, `title` attribute shows full
- Chrome internal pages (chrome://) → no favicon, grey placeholder

---

### Component: TodoDrawer

**Purpose:** Slide-in panel showing deferred tabs organized by status.

**Layout:**
```
┌──────────────────────┐
│ 待办列表              │
│ [待处理] [已完成]     │
│ ────────────────────  │
│ 🌐 Page Title        │
│    2分钟前  [↗][✓][🗑]│
│ ────────────────────  │
│ 🌐 Another Page      │
│    1小时前 [↗][✓][🗑] │
│ ────────────────────  │
│        [清空已完成]   │
└──────────────────────┘
```

**Props/Data:**
- `items: TodoItem[]`
- `activeTab: 'todo' | 'done'`
- `onReopen(id: string)`
- `onMarkDone(id: string)`
- `onDelete(id: string)`
- `onClearDone()`

**States:**

| State | Visual |
|-------|--------|
| Open | 320px width, slides from right |
| Closed | Width 0, hidden |
| Empty todo | "暂无待办事项" centered |
| Empty done | "暂无已完成项" |

**Animations:**

| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Open | Slide from right | 200ms | ease-out |
| Close | Slide to right | 200ms | ease-in |
| Item added | Fade in from top | 150ms | ease-out |
| Item removed | Fade out + collapse | 200ms | ease-in |

**Accessibility:**
- `role="complementary"`, `aria-label="待办列表"`
- Tab buttons: `role="tablist"`, `role="tab"`, `aria-selected`
- Item actions: `aria-label="重新打开"`, `aria-label="标记完成"`, `aria-label="删除"`

---

### Component: SearchBar

**Purpose:** Real-time filter for tabs by title or URL.

**Behavior:**
- Debounced input (150ms)
- Filters across all window groups
- Groups with zero matching tabs are hidden
- Clear button (×) appears when input has text

**Accessibility:**
- `role="search"`, `aria-label="搜索标签页"`
- No results → `aria-live="polite"` announcement "未找到匹配的标签"

---

## 3. Design Tokens

### Colors

```css
:root {
  /* Backgrounds */
  --color-bg: #ffffff;
  --color-bg-hover: #f9fafb;
  --color-bg-subtle: #f3f4f6;
  --color-bg-active: #eff6ff;

  /* Foregrounds */
  --color-fg: #111827;
  --color-fg-muted: #6b7280;
  --color-fg-subtle: #9ca3af;

  /* Borders */
  --color-border: #e5e7eb;
  --color-border-focus: #3b82f6;

  /* Status */
  --color-duplicate: #f59e0b;      /* amber-500 */
  --color-duplicate-bg: #fffbeb;    /* amber-50 */
  --color-duplicate-border: #fbbf24; /* amber-400 */

  --color-success: #22c55e;
  --color-success-bg: #f0fdf4;

  --color-danger: #ef4444;
  --color-danger-bg: #fef2f2;

  --color-info: #3b82f6;
  --color-info-bg: #eff6ff;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```

### Typography

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "SF Mono", "Menlo", "Monaco", monospace;

  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */

  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
}
```

### Spacing & Layout

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */

  --header-height: 3.5rem;   /* 56px */
  --drawer-width: 20rem;     /* 320px */
  --tab-row-height: 3.5rem;  /* 56px */
}
```

### Border Radius

```css
:root {
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-full: 9999px;
}
```

### Animation

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-out: cubic-bezier(0, 0, 0.2, 1);
  --easing-in: cubic-bezier(0.4, 0, 1, 1);
}
```

### Z-Index

```css
:root {
  --z-base: 0;
  --z-header: 10;
  --z-drawer: 20;
  --z-toast: 30;
}
```

---

## 4. Duplicate Detection Visual System

Duplicates get a **color-coded left border** so users can visually pair same-URL tabs at a glance.

**Color pool for duplicate groups (cycles if > 6 groups):**
1. `#f59e0b` (amber)
2. `#8b5cf6` (violet)
3. `#06b6d4` (cyan)
4. `#f43f5e` (rose)
5. `#84cc16` (lime)
6. `#f97316` (orange)

**Rules:**
- Only URLs appearing 2+ times across all windows get highlighted
- Same URL always gets the same color within a session
- Badge shows total count: `重复 ×3`
- "关闭重复项" button on WindowGroup header closes all but the first occurrence (by tab ID order)

---

## 5. Extension Icon Badge

The `background.js` service worker updates the badge:

- **No duplicates:** No badge
- **Has duplicates:** Red badge with count of duplicate URLs (e.g., "3" means 3 URLs have duplicates)
- Badge updates on `chrome.tabs.onCreated`, `onUpdated`, `onRemoved`

---

## 6. Popup (Quick Entry)

Minimal popup when clicking the extension icon:

```
┌─────────────────────┐
│  🗂 标签管理         │
│                     │
│  打开的标签: 23      │
│  重复页面: 3         │
│                     │
│  [  打开标签管理  ]  │
└─────────────────────┘
```

Single button opens the full manager page. Stats update in real-time.

---

## 7. Flower Bloom Celebration

### Core Concept

Every tab close triggers a **small flower bloom** at the closed tab row — petals unfurl from center then gently fall and fade. A tiny "完结撒花" moment — gentle, satisfying, never full-screen.

### Flower Particle Specs

- **Petal count:** 6–8 petals per bloom
- **Origin:** center of the closed TabRow
- **Bloom animation:** petals scale from 0 to 1 while rotating outward from center (like a flower opening)
- **Spread:** ±50px horizontal, slight upward then gentle drift down
- **Petal shape:** rounded teardrop (CSS `border-radius: 50% 0 50% 50%`, ~8×12px)
- **Colors:** soft pastel palette — `#f9a8d4` (pink), `#fda4af` (rose), `#fdba74` (peach), `#fde68a` (soft gold), `#c4b5fd` (lavender)
- **Duration:** 600ms bloom + 400ms drift-fade = 1000ms total
- **Rotation:** each petal rotates outward by 30–45° from center
- **Stagger:** each petal blooms 0–40ms sequentially for natural unfurling feel
- **Opacity:** 1 during bloom → 0 in last 30% (drift-fade phase)

### Implementation

- One `<div class="flower-container">` overlay (`pointer-events: none`, `position: fixed`, `z-index: var(--z-confetti)`)
- On close: calculate the TabRow's center coordinates, spawn 6–8 `<div class="petal">` elements
- Each petal gets inline CSS custom properties `--angle`, `--dx`, `--dy`, `--rot` for unique trajectory
- Two-phase CSS animation: bloom (scale + rotate outward) → drift (translate + fade)
- Remove petals on `animationend`

```css
.petal {
  width: 8px;
  height: 12px;
  border-radius: 50% 0 50% 50%;
  position: absolute;
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

### Z-Index Update

```css
--z-confetti: 25;  /* above drawer, below toast */
```

---

## 8. Toast Notifications

Standard bottom-center toasts for routine confirmations:

| Action | Toast message | Duration |
|--------|--------------|----------|
| Save to todo | "已添加到待办" | 2s |
| Todo item completed | "已标记完成" | 1.5s |
| Reopen todo | "已在新标签页打开" | 1.5s |

**Styling:** `--color-bg` background, `--shadow-md`, `--radius-md`, `--text-sm`. Auto-dismiss with progress bar.

---

## 8. Implementation Target

**Agent:** Vanilla JS engineer (no framework agent needed — this is pure DOM + CSS)

**Framework notes:** No React, no build step. Direct DOM manipulation via `document.createElement` and template literals. CSS custom properties for theming.

**Key Chrome APIs:**
- `chrome.tabs.query()` — get all tabs
- `chrome.tabs.remove()` — close tabs
- `chrome.tabs.update()` — activate tab
- `chrome.tabs.onCreated/Updated/Removed` — real-time sync
- `chrome.storage.local` — persist todo items
- `chrome.action.setBadgeText/setBadgeBackgroundColor` — icon badge
- `chrome.windows.getAll()` — group by window

**File locations:**
- `tab-manager/manager/manager.html` + `.css` + `.js`
- `tab-manager/popup/popup.html` + `.css` + `.js`
- `tab-manager/background.js`
- `tab-manager/manifest.json`

**Acceptance Criteria:**
- [ ] All tabs visible, grouped by window
- [ ] Duplicate tabs highlighted with color-coded left border and badge
- [ ] Close tab triggers flower bloom animation at the tab row position
- [ ] "Save to todo" closes tab and adds to todo drawer
- [ ] Todo drawer opens/closes with slide animation
- [ ] Todo items: reopen, mark done, delete all functional
- [ ] Search filters tabs in real-time
- [ ] Extension badge shows duplicate count
- [ ] Keyboard navigation works (Tab, Enter, Delete, S)
- [ ] All interactive elements have focus-visible states
