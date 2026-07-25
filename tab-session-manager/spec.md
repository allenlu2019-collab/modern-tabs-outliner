# Modern Tabs Outliner Product Specification

Status: Current implementation baseline
Applies to: Version 1.0.15
Browsers: Google Chrome and Microsoft Edge, Manifest V3

## Product summary

Modern Tabs Outliner is a local-first browser extension for viewing live browser
windows and tabs together with saved tabs, saved windows, and user-created groups
in one persistent tree.

The extension runs in a detached popup window. It lets users close tabs without
forgetting them, restore selected items later, reorganize tabs and groups, search
the outline, and back up the workspace locally or through a user-selected GitHub
repository.

## Problem

Heavy browser users accumulate more tabs than a flat tab strip can explain.
Bookmarks preserve URLs but lose the relationship between windows, projects, and
work in progress. Full-session restoration is often too coarse.

The product preserves browsing context while allowing the physical browser
session to remain smaller.

## Product principles

1. **Preserve context.** Saved items retain their place in the outline.
2. **Treat open and saved as one workspace.** A saved tab is inactive, not lost.
3. **Restore selectively.** One tab, one window, or one branch can be restored.
4. **Use explicit authority boundaries.**
   - Chrome or Edge is authoritative for tabs and windows that are physically open.
   - IndexedDB is authoritative for saved items and user-created organization.
5. **Make destructive actions distinct.** Close-save preserves an item; Remove
   deletes it from the outline.
6. **Recover idempotently.** Repeated browser events must not create duplicate
   open nodes.
7. **Remain local-first.** Data leaves the device only through an explicit export
   or GitHub push.

## Domain model

The canonical terminology is maintained in
[`../CONTEXT.md`](../CONTEXT.md).

The workspace is stored as flat nodes with stable IDs and bidirectional
parent-child references:

```ts
type NodeType = "workspace" | "window" | "tab" | "group" | "separator";
type NodeStatus = "open" | "saved" | "restoring" | "crashed" | "missing";
```

The current UI and reconciler primarily produce and consume `open` and `saved`.
The other status values are reserved by the schema and are not yet a complete
user-facing recovery workflow.

## Authority and lifecycle rules

### Live browser state

- A live tab is identified by `browserTabId`.
- A live browser window is identified by `browserWindowId`.
- Browser IDs are session-scoped and are not portable across devices or browser
  restarts.
- Reconciliation reads populated browser windows and tabs, then updates open
  nodes in IndexedDB.
- The Modern Outliner popup and its tab are excluded from the represented
  browser session.

### Saved outline state

- A saved tab or window remains in IndexedDB without requiring a live browser
  object.
- Closing through a close-save action registers intent before closing the live
  tab, allowing reconciliation to preserve the node as `saved`.
- Removing a node deletes that node and its descendants from IndexedDB. Any live
  tabs in the removed subtree are also closed.

### External browser changes

- Browser tab/window events are debounced and reconciled serially.
- A tab closed outside the extension is removed unless it was registered as an
  intentional save.
- An absent empty window node is removed in the same reconciliation pass.
- Open duplicate nodes that point to the same browser tab or window ID are
  consolidated.
- After a browser restart, URL-based fallback matching may reconnect persisted
  open nodes to new runtime IDs.

## Implemented capabilities

### 1. Single detached outliner popup

The extension action opens a 420 x 800 detached popup.

Acceptance criteria:

- Activating the extension focuses an existing outliner popup when one exists.
- The extension does not create multiple outliner-only popup windows.
- Duplicate outliner-only popups are closed.
- A normal browser window containing an outliner tab is not closed.

### 2. Unified tree

The tree displays browser windows, open tabs, saved tabs, saved windows, and
groups.

Acceptance criteria:

- Open and saved nodes can coexist under the same root.
- Windows and groups can be expanded and collapsed.
- Windows and groups can be renamed inline.
- Clicking an open tab focuses its browser tab and window.
- Clicking a saved tab restores it.

### 3. Close-save and remove

Close-save and Remove are separate commands.

Acceptance criteria:

- Close-save closes the physical tab while preserving the outline node.
- Closing a branch preserves its open descendants as saved nodes.
- Remove deletes the selected subtree and closes live tabs in that subtree.
- Removing the final child does not leave an empty live window item.

### 4. Selective restore

Users can restore a saved tab, window, or group branch.

Acceptance criteria:

- A saved tab restores into its open ancestor window when possible.
- If its parent window is closed, the restored tab is used to create the new
  window directly; no extra default tab is created.
- Restoring a window or group restores nested child tabs.
- Empty saved windows do not create a blank browser window.
- Restored HTTP(S) tabs receive temporary autoplay protection until interaction
  or timeout.

### 5. Drag-and-drop organization

The tree uses `dnd-kit` for reordering and reparenting.

Acceptance criteria:

- Windows remain root-level nodes.
- Tabs can be children of windows or groups.
- Cycles are rejected.
- Moving open tabs under an open window moves the physical browser tabs.
- Moving open tabs outside any open browser window converts them to saved tabs
  and closes the physical tabs.
- An old browser window is removed when a cross-window move leaves it empty.

### 6. Search and extraction

Search matches node titles and tab URLs.

Acceptance criteria:

- Matching ancestors remain visible so results retain context.
- Search expands matching branches.
- The search field supports `Ctrl+F` and `Cmd+F`.
- Matching tabs can be extracted into a new browser window.
- Open matches are recreated in the new window; saved matches remain saved.

### 7. Local snapshots

Snapshots capture the complete node collection in a separate IndexedDB store.

Acceptance criteria:

- Users can create, list, restore, and delete snapshots.
- Snapshot metadata includes creation time and node count.
- Restoring a snapshot replaces the current node store and requests
  reconciliation.

### 8. JSON import and export

Acceptance criteria:

- Export downloads a versioned JSON object containing all nodes.
- Import accepts the wrapper format or a raw node array.
- Import validates node types, unique IDs, root existence, and bidirectional
  parent-child references.
- Import creates a safety snapshot before replacing the node store.
- Imported open nodes become saved and browser runtime IDs are removed.

### 9. Manual GitHub synchronization

Users can manually push or pull the same JSON backup format through the GitHub
Contents API.

Acceptance criteria:

- The user supplies a personal access token, `owner/repository`, and file path.
- Push creates or updates the selected file.
- Pull validates and sanitizes data before import.
- Pull creates the same pre-import safety snapshot as local import.
- Credentials are stored in `chrome.storage.local`; they are not encrypted by
  the extension.
- No automatic background synchronization occurs.

### 10. Build and extension integrity

Acceptance criteria:

- The MV3 background service worker is emitted as self-contained
  `dist/background.js`.
- The UI JavaScript is emitted as self-contained `dist/main.js`.
- The build fails when the manifest or HTML references a missing distribution
  asset.
- Playwright loads the unpacked build and verifies service-worker registration.

## User flows

### First use

1. Build or install the extension.
2. Activate the extension action.
3. The background worker reconciles current browser windows and tabs.
4. The detached popup shows the current outline.

Success: current browser state appears without manual import.

### Save a tab

1. Select Close on an open tab.
2. The UI registers an intentional save.
3. The browser tab closes.
4. Reconciliation marks the existing node saved in the same location.

Success: browser memory is released without losing the tab's context.

### Restore a branch

1. Select Restore on a saved window or group.
2. The background worker gathers nested saved tabs.
3. Tabs are opened in an existing suitable window or a new browser window.
4. New runtime IDs are persisted.

Success: only the selected branch returns to the live browser session.

### Move work between windows

1. Drag a tab or group into another open window node.
2. The outline hierarchy is persisted.
3. Open descendant tabs are moved to the target physical browser window in
   outline order.

Success: the browser and outline converge on the same organization.

### Portable restore

1. Export locally or push to GitHub.
2. Import or pull on another browser/device.
3. Validation and sanitization convert runtime-specific open nodes to saved.
4. Restore selected items when needed.

Success: hierarchy transfers without reusing stale browser IDs.

## Non-functional requirements

### Reliability

- Reconciliation must be serialized and safe under repeated browser events.
- Reconciliation must not represent the outliner popup as user browsing state.
- Parent-child references must remain bidirectionally consistent.
- Duplicate open browser IDs must not produce duplicate outline entries.
- Build output must not depend on missing hashed JavaScript chunks.

### Compatibility

- Google Chrome with Manifest V3.
- Microsoft Edge with Manifest V3.
- Windows and macOS are supported development/use environments.
- Firefox is not currently supported.

### Performance

- Browser events are debounced by 250 ms.
- IndexedDB connections are reused.
- Reconciliation batches node writes where practical.
- The current recursive UI is expected to remain responsive for ordinary
  sessions; virtualization for very large trees is not implemented.

### Privacy and security

- Outline data and snapshots are stored locally in IndexedDB.
- GitHub settings are stored locally in extension storage.
- GitHub transfer occurs only after an explicit Push or Pull action.
- The extension requests `tabs`, `windows`, and `storage`, plus host access used
  by the restored-tab autoplay content script.

## Explicitly not implemented

- Browser side-panel integration.
- Firefox support.
- Notes, todos, separators, tags, or a details pane in the UI.
- Context menus and bulk multi-selection.
- An options/settings page.
- Automatic scheduled backups or automatic GitHub sync.
- A complete user-facing crashed/missing recovery state.
- Tree virtualization.
- Chrome Web Store or Edge Add-ons release automation.

## Current test contract

The automated suite covers:

- tree ordering and restore-index utilities;
- close-save, remove, restore, and drag/drop interactions;
- import validation and portability sanitization;
- outliner popup uniqueness;
- reconciliation deduplication, empty-window cleanup, and popup exclusion;
- search, snapshots, GitHub-settings validation, and page persistence;
- distribution integrity and real MV3 service-worker registration.

See [`../specs/modern-outliner-core-flows.md`](../specs/modern-outliner-core-flows.md)
and [`architecture.md`](architecture.md).

## Prioritized future work

1. Define and implement explicit crash/restart recovery semantics.
2. Add extension-level E2E coverage for live tab movement and close-save flows.
3. Add schema migrations beyond IndexedDB version 2.
4. Add large-tree performance measurements and virtualization if required.
5. Reduce broad host permissions if autoplay protection can be redesigned.
