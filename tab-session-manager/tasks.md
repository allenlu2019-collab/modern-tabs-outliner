# Implementation Tasks

This document breaks down the work for the Tree-Based Browser Session Manager into actionable tasks.

## Project phases

### Phase 1 — Foundation
- Setup extension scaffold
- Define data model
- Basic persistence

### Phase 2 — Tree UI
- Render tree from data
- Basic node interactions
- Collapse/expand

### Phase 3 — Save/restore
- Close-save tabs/windows
- Restore tabs/windows
- Visual state indicators

### Phase 4 — Organization
- Drag-and-drop reordering
- Group nodes

### Phase 5 — Recovery + export
- Crash detection
- Recoverable state UI
- JSON export/import
- Search

---

## Phase 1 — Foundation

### Task 1.1 — Extension scaffold
- Choose framework (Plasmo recommended)
- Create manifest.json for Chrome MV3 + Edge
- Set up background service worker
- Set up popup page (detached panel)
- Set up build/dev scripts

**Deliverables:**
- `manifest.json`
- `background.ts`
- `popup/index.html`
- `popup/index.tsx`
- `package.json` with scripts

### Task 1.2 — Data model
- Define TypeScript interfaces for all node types
- Create ID generation utilities
- Create tree manipulation helpers (add, remove, move, find)

**Deliverables:**
- `src/types.ts`
- `src/id.ts`
- `src/tree.ts`

### Task 1.3 — Persistence layer
- Choose storage strategy (IndexedDB + chrome.storage.local)
- Create abstraction for reading/writing tree
- Create migration system for future schema changes

**Deliverables:**
- `src/storage/index.ts`
- `src/storage/idb.ts`
- `src/storage/migrations.ts`

### Task 1.4 — Runtime reconciliation
- Listen to browser tab/window events
- Map runtime IDs to node IDs
- Detect missing/crashed tabs

**Deliverables:**
- `src/runtime/reconciler.ts`
- `src/runtime/events.ts`

---

## Phase 2 — Tree UI

### Task 2.1 — Popup layout
- Create popup page layout
- Tree view with detached details

**Deliverables:**
- `popup/components/Layout.tsx`
- CSS/theme setup

### Task 2.2 — Tree component
- Render tree nodes recursively
- Visual distinction for node types
- Collapse/expand icons
- Selection state

**Deliverables:**
- `popup/components/Tree.tsx`
- `popup/components/TreeNode.tsx`

### Task 2.3 — Node rendering
- Tab node: favicon, title, URL, status indicator
- Window node: window icon, tab count
- Group node: folder icon

**Deliverables:**
- `popup/components/nodes/TabNode.tsx`
- `popup/components/nodes/WindowNode.tsx`
- `popup/components/nodes/GroupNode.tsx`

### Task 2.4 — State management
- Connect UI to persisted tree
- Handle selection
- Handle expand/collapse state

**Deliverables:**
- `popup/store/treeStore.ts`
- `popup/store/selectionStore.ts`

---

## Phase 3 — Save/restore

### Task 3.1 — Close-save tab
- Add “Close-save” button/context menu to tab nodes
- Capture tab metadata
- Close browser tab
- Update node status to saved
- Persist change

**Deliverables:**
- Action in background worker
- UI button/context menu
- Visual feedback

### Task 3.2 — Close-save window
- Add “Close-save window” action
- Capture all tabs in window
- Close browser window
- Mark window and child tabs as saved

**Deliverables:**
- Window-level action
- Batch tab handling

### Task 3.3 — Restore tab
- Add “Restore” button to saved tab nodes
- Open URL in browser
- Update node status to open
- Capture new runtime tab ID

**Deliverables:**
- Restore action
- Error handling for invalid URLs

### Task 3.4 — Restore window/branch
- Add “Restore window” action
- Create new browser window
- Restore child tabs in order
- Update node statuses

**Deliverables:**
- Branch-level restore
- Window creation with tabs

### Task 3.5 — Visual status indicators
- Differentiate open/saved/crashed/missing visually
- Color coding or icons
- Tooltips explaining status

**Deliverables:**
- Status indicator component
- CSS classes for each status

---

## Phase 4 — Organization

### Task 4.1 — Drag-and-drop
- Install `dnd-kit`
- Configure tree drag zones
- Handle reorder and reparent
- Persist changes

**Deliverables:**
- `popup/components/DndProvider.tsx`
- Drag handlers
- Visual drag preview

### Task 4.2 — Group nodes
- Add “New group” action
- Render group nodes
- Allow drag into/out of groups
- Collapse/expand groups

**Deliverables:**
- Group creation UI
- Group styling



### Task 4.5 — Context menus
- Right-click context menu for nodes
- Actions: close-save, restore, add group, delete, etc.

**Deliverables:**
- `popup/components/ContextMenu.tsx`
- Menu actions wired up

---

## Phase 5 — Recovery + export

### Task 5.1 — Crash detection
- On startup, compare persisted open nodes with runtime tabs
- Mark missing nodes as crashed/recoverable
- Provide restore UI for crashed nodes

**Deliverables:**
- Startup reconciliation logic
- Crashed node visual treatment

### Task 5.2 — Export/import JSON
- Add “Export” button to toolbar
- Serialize tree to JSON
- Download as file
- Add “Import” button
- Validate and load JSON
- Merge or replace tree

**Deliverables:**
- `src/export/json.ts`
- Import/export UI

### Task 5.3 — Search
- Add search bar
- Index titles, URLs, note content
- Filter tree to matches
- Highlight matches

**Deliverables:**
- `src/search/index.ts`
- Search UI component

### Task 5.4 — One-click clean slate
- Add “Close-save all” button
- Snapshot current session
- Close all non-essential tabs/windows
- Keep popup open

**Deliverables:**
- Bulk close-save action
- Confirmation dialog

---

## Phase 6 — Polish

### Task 6.1 — Keyboard shortcuts
- Add basic shortcuts (expand/collapse, save, restore)
- Configurable later

### Task 6.2 — Settings page
- Options for:
  - Auto-parent new tabs
  - Restore target window behavior
  - Backup frequency
  - Theme

### Task 6.3 — Quick Actions
- Quick actions in extension directly
- Save current tab

### Task 6.4 — Error handling
- Graceful handling of permission issues
- Storage full scenarios
- Invalid URLs

### Task 6.5 — Testing
- Unit tests for tree logic
- Integration tests for storage
- Manual testing on Chrome/Edge

---

## Suggested order for MVP

1. **Week 1:** Phase 1 (scaffold + data model)
2. **Week 2:** Phase 2 (tree UI)
3. **Week 3:** Phase 3 (save/restore)
4. **Week 4:** Phase 4 (organization basics)
5. **Week 5:** Phase 5 (recovery + export)
6. **Week 6:** Phase 6 (polish)

---

## Dependencies

### Required npm packages
- `plasmo` (or raw extension setup)
- `react`, `react-dom`
- `zustand` (state)
- `@dnd-kit/*` (drag-and-drop)
- `idb` (IndexedDB wrapper)
- `nanoid` (ID generation)

### Browser APIs needed
- `tabs`
- `windows`
- `storage`
- `sessions`
- `contextMenus`
- `downloads`

---

## Open decisions to make during implementation

1. **Tree root representation:** single workspace root vs multiple roots?
2. **Default grouping:** import existing windows as groups or flatten?
3. **Search scope:** include saved items only or both?
4. **Export format:** custom JSON vs standard format?

---

## Risk areas

1. **Performance with large trees:** need virtualization if >1000 nodes.
2. **Browser API restrictions:** some URLs cannot be restored.
3. **MV3 service worker lifecycle:** persistence during suspension.
4. **Edge compatibility:** test early on Edge.

---

## Success criteria for each phase

### Phase 1
- Extension loads without errors
- Tree data persists across reloads
- Runtime events are captured

### Phase 2
- Tree renders current tabs/windows
- Node types visually distinct
- Collapse/expand works

### Phase 3
- Close-save tab works
- Restore tab works
- Status indicators show correctly

### Phase 4
- Drag-and-drop reorders tree
- Groups work

### Phase 5
- Crash detection marks missing nodes
- Export/import works
- Search finds nodes

### Phase 6
- Keyboard shortcuts work
- Settings page exists
- Popup provides quick actions
