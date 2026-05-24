# Tree-Based Browser Session Manager

## Title
Tree-Based Browser Session Manager for Chrome and Edge

## One-line summary
A Chrome/Edge extension that helps users manage tab overload by organizing open tabs, saved sessions, and windows in a persistent tree, allowing them to close tabs without losing context and selectively restore them later.

## Problem statement
Heavy browser users often accumulate too many tabs and windows. Existing browser tools either:
- flatten sessions into lists,
- make restore all-or-nothing,
- lose the relationship between tabs,
- lack easy access across displays,
- or fail badly after crashes.

Users need a system that preserves **context**, not just links.

## Vision
Turn browser sessions into a **structured, persistent workspace** where:
- open and saved tabs coexist,
- tabs can be closed without being forgotten,
- context is preserved in a tree,
- tree is accessible via a popup side panel,
- crash recovery is selective and reliable.

## Goals
1. Provide a unified tree view of open and saved tabs/windows.
2. Let users close-save tabs/windows in place without losing hierarchy.
3. Support a detached popup sidebar layout that fits easily on the screen.
4. Enable selective restore of tabs, windows, or branches.
5. Persist state locally and recover gracefully after crashes.
6. Work on both Chrome and Edge with a shared codebase.

## Non-goals (V1)
1. Multi-user collaboration
2. AI summarization or AI-assisted organization
3. Firefox support
4. Payments / premium gating
5. Google Drive backup integration

## Target users

### Primary user
Power users with 50–500 open tabs who:
- do research,
- work across many projects,
- want to reduce RAM/CPU usage,
- need strong session continuity.

### Secondary user
Knowledge workers who want:
- project-based tab organization,
- a permanent popup UI,
- structured browsing memory.

## Core product principles
1. **Context is everything** — a tab should retain its place in the tree.
2. **Open and saved should feel continuous** — saved tabs are not “gone,” just inactive.
3. **Selective restore beats full restore**.
4. **The tree is the source of truth**.
5. **UI must be non-intrusive yet always accessible**.
6. **Closing tabs should feel safe**.

# Core features

## 1. Unified tree view
Display:
- open windows
- open tabs
- saved windows
- saved tabs
- groups

All in one editable hierarchy.

### Acceptance criteria
- User can see both open and saved items in one tree.
- Item type/status is visually distinguishable.
- Tree supports collapse/expand.

## 2. Close-save tab/window
Allow user to close an open tab or window while preserving it in place in the tree.

### Acceptance criteria
- Closing a tab marks it saved and removes the live browser tab.
- Closing a window saves all contained tabs.
- Node location in tree does not change.
- Node metadata is preserved.

## 3. Restore tab/window/branch
Allow selective reopen of:
- one tab
- one window
- one subtree/branch

### Acceptance criteria
- Restore action recreates missing tabs in browser.
- Restored nodes become active/open state.
- Restore does not require reopening everything.

## 4. Tree editing
Support:
- drag-and-drop reordering
- nesting
- grouping
- manual labels/groups
- collapse/expand

### Acceptance criteria
- Any node can be moved under another valid parent.
- Order persists across reloads.
- Drag/drop works with mouse and keyboard fallback later.

## 6. Crash/session recovery
If browser restarts or crashes:
- identify previously open tabs/windows that are no longer alive
- mark them as recoverable
- allow selective reopen

### Acceptance criteria
- Open nodes missing at restart are marked appropriately.
- User can restore one branch/window/tab without restoring all.
- Crash recovery doesn’t erase tree context.

## 7. Search and filter
Search tree by:
- title
- URL
- tag/keyword (if tags added later)

### Acceptance criteria
- Search returns both open and saved items.
- Results can focus/reveal matching node in tree.

## 8. Export/import
Provide:
- JSON export/import for full fidelity.
- Automatic portability sanitization: when importing a backup JSON, the status of open window/tab nodes is converted to `"saved"` and their browser-session-specific IDs are stripped. This prevents the background reconciler from deleting them upon import in a different browser session or computer.
- Safety rollback: Automatically creates a safety database snapshot before overwriting the outliner tree during import.

### Acceptance criteria
- User can export full workspace to a local JSON file.
- User can import a prior JSON backup to restore their tree.
- Import sanitization handles cross-device/cross-browser tab sessions correctly without losing data.
- Export/import preserves hierarchy and metadata.

## 9. GitHub Cloud Sync
Provide:
- Automatic remote cloud sync of the session tree using the GitHub Contents API.
- Secure credential management: personal access token (PAT), repository path (`owner/repo`), and custom backup file path are securely saved in local storage.
- Push: base64-encodes the outliner database tree and commits/pushes it directly to GitHub.
- Pull: pulls and validates the backup from GitHub, applying safety rollback snapshots and sanitization before importing.

### Acceptance criteria
- User can configure their GitHub PAT and backup repository.
- User can push the local tree to GitHub.
- User can pull the backup from GitHub on another machine to restore the outliner tree.

# User flows

## Flow 1 — First launch
1. User installs extension.
2. User opens the popup side panel.
3. Extension scans current windows/tabs.
4. Current browsing state is imported into root tree.
5. User sees initial outline.

### Success condition
User immediately sees value without manual setup.

## Flow 2 — Save noisy tabs without losing them
1. User opens the popup panel.
2. User selects several tabs or a window.
3. User clicks “Close-save”.
4. Extension persists metadata and closes live tabs.
5. Tree still shows them in the same structure.

### Success condition
Browser becomes lighter, but context remains visible.

## Flow 3 — Organize by project
1. User creates a group node called “Project A”.
2. User drags tabs and windows into it.
3. User collapses the branch.

### Success condition
Research becomes structured and reviewable.

## Flow 4 — Recover after crash
1. Browser restarts.
2. Extension loads saved tree.
3. Runtime tab/window IDs are missing for previous open items.
4. Extension marks affected items as crashed/recoverable.
5. User restores only needed branches.

### Success condition
User avoids reopening hundreds of tabs at once.

## Flow 5 — One-click clean slate
1. User clicks “Close-save all”.
2. Extension snapshots current session.
3. All normal tabs/windows are closed.
4. Popup panel remains open.
5. User starts fresh while old work remains preserved.

### Success condition
Immediate decluttering with zero context loss.

# Functional requirements

## FR-1 Tree model
The system must store all entities as tree nodes with stable IDs.

## FR-2 Open/saved coexistence
The UI must display open and saved entities in a unified tree.

## FR-3 Close-save
The system must support converting open tabs/windows into saved nodes without changing their position in the tree.

## FR-4 Restore
The system must restore a tab/window/branch on demand.

## FR-5 Persistence
All mutations must persist locally and survive browser restart.

## FR-7 Recovery
The system must detect missing previously-open tabs/windows and mark them recoverable.

## FR-8 Reordering
The system must support drag-and-drop reparenting and reordering.

## FR-9 Search
The system must support searching titles and URLs.

## FR-10 Export/import
The system must support full-tree JSON import/export.

# Non-functional requirements

## Performance
- Must remain usable with 1,000+ nodes in tree.
- Tree interactions should feel responsive under normal use.
- Large trees may require virtualization.

## Reliability
- Must autosave on mutation.
- Should avoid data loss on worker suspension or browser crash.
- Restore actions should be idempotent where possible.

## Compatibility
- Chrome MV3
- Edge MV3
- Shared extension codebase

## Privacy
- Local-first in V1
- No external sync by default
- No user data leaves device unless explicitly exported

# Data model

## Node
```ts
type NodeType =
  | "workspace"
  | "window"
  | "tab"
  | "group"
  | "separator"

type NodeStatus =
  | "open"
  | "saved"
  | "restoring"
  | "crashed"
  | "missing"

interface BaseNode {
  id: string
  type: NodeType
  parentId: string | null
  childIds: string[]
  title?: string
  createdAt: number
  updatedAt: number
  sortOrder: number
  collapsed?: boolean
  color?: string
  tags?: string[]
}
```

## Tab node
```ts
interface TabNode extends BaseNode {
  type: "tab"
  status: NodeStatus
  url: string
  favIconUrl?: string
  browserTabId?: number
  browserWindowId?: number
  openerTabNodeId?: string
  pinned?: boolean
  audible?: boolean
  muted?: boolean
}
```

## Window node
```ts
interface WindowNode extends BaseNode {
  type: "window"
  status: NodeStatus
  browserWindowId?: number
  incognito?: boolean
}
```

# Technical architecture

## 1. Background service worker
Responsibilities:
- listen to `tabs` and `windows` events
- reconcile runtime browser state with persisted tree
- persist mutations
- coordinate restore flows
- schedule backups later

## 2. Popup Side Panel
Responsibilities:
- render tree in compact mode
- handle drag/drop
- interact with tree
- search/filter
- initiate actions

## 3. Storage layer
Responsibilities:
- local persistence abstraction
- snapshotting
- version migration
- integrity checks

## 4. Runtime reconciliation layer
Responsibilities:
- map browser runtime IDs to stable node IDs
- detect missing/crashed nodes
- handle tab/window movement changes

# Suggested tech stack

## Extension framework
- **Plasmo** or raw MV3 extension setup

## UI
- React
- TypeScript

## State
- Zustand / Redux Toolkit / TanStack Store

## Storage
- `chrome.storage.local` for settings/light metadata
- IndexedDB for larger tree/history state

## Drag-and-drop
- `dnd-kit`

## Search
- simple local text index first
- maybe MiniSearch later

# Permissions / browser APIs
- `tabs`
- `windows`
- `storage`
- `sessions`
- `contextMenus`
- `downloads`
- `alarms`
- optional later: `tabGroups`, `sidePanel`

# Edge cases

## Tab already closed externally
If user closes a tab outside the extension UI:
- reconcile event
- mark node saved/missing based on intent/context

## Restore collision
If restoring a saved branch into an existing live session:
- create new window or append to current configurable target

## Browser restart mismatch
Persisted nodes marked open but runtime tabs gone:
- mark as crashed/recoverable

## URL restricted pages
Some internal browser pages may not restore normally.
Need graceful handling for:
- `chrome://`
- `edge://`
- extension pages
- restricted pages

# V1 milestone plan

## Milestone 1 — Core tree + persistence
- create node model
- import current tabs/windows
- render tree
- persist locally

## Milestone 2 — Save/restore
- close-save tab
- close-save window
- restore tab/window
- visual states

## Milestone 3 — Organization
- drag/drop
- group nodes

## Milestone 4 — Recovery + export
- crash detection
- recoverable state UI
- JSON export/import
- search

# Open questions
1. Should tabs automatically become children of opener tabs by default or be optional?
2. Should the popup side panel remain floating, or anchor to the side of the browser?
3. What is the best restore target behavior for branches?
4. Do we need snapshot history in V1 or only current-state persistence?

# Recommended V1 decisions
- Default UI: **Detached Popup Side Panel**
- Restore target: **same window when possible, else new window**
- Parent-child opener behavior: **optional setting, default on**
- Backups: **manual JSON export in V1**

# Acceptance definition for V1
V1 is successful if a user can:
1. install the extension,
2. see all current tabs/windows in a tree,
3. create groups,
4. close-save tabs/windows,
5. reopen only selected items later,
6. restart/crash browser and recover selectively,
7. export/import the workspace.
