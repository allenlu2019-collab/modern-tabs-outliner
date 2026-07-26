# Modern Tabs Outliner Technical Architecture

Status: Current implementation baseline
Applies to: Version 1.0.16

## Overview

Modern Tabs Outliner is a raw Manifest V3 extension built with React,
TypeScript, Vite, IndexedDB, and `dnd-kit`. It is not a Plasmo application and
does not use the browser side-panel API.

The system has five runtime/build responsibilities:

1. **Extension launcher** - opens or focuses one detached outliner popup.
2. **Background service worker** - observes browser events and reconciles live
   state with the persisted outline.
3. **React popup UI** - renders and edits the outline.
4. **Storage and transfer services** - persist nodes/snapshots and handle JSON
   or GitHub transfer.
5. **Build pipeline** - produces self-contained UI and service-worker bundles
   and verifies distribution integrity.

## System diagram

```text
Chrome / Edge
  tabs + windows events
          |
          v
src/background.ts
  initializeBackground()
          |
          v
src/background-logic.ts
  launcher | message handler | reconciler
          |
          +-------------------+
          |                   |
          v                   v
src/storage.ts          chrome.tabs/windows
  IndexedDB              physical operations
          |
          v
src/App.tsx <---- TREE_UPDATED runtime message
  React tree UI
          |
          +---- JSON import/export
          +---- src/githubService.ts
```

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/background.ts` | Service-worker entry point |
| `src/background-logic.ts` | Launcher, messages, restore logic, reconciliation |
| `src/App.tsx` | Tree rendering, user actions, drag/drop, backup UI |
| `src/storage.ts` | IndexedDB nodes and snapshots |
| `src/types.ts` | Persisted and hydrated node types |
| `src/utils.ts` | Positional weave, restore index, ID generation |
| `src/importValidation.ts` | Backup structure and relationship validation |
| `src/githubService.ts` | GitHub Contents API push/pull |
| `public/content.js` | Temporary autoplay suppression for restored HTTP(S) tabs |
| `vite.config.ts` | Self-contained UI build |
| `vite.background.config.ts` | Self-contained service-worker build |
| `scripts/verify-dist.mjs` | Distribution reference and bundling checks |

## Authority model

The system deliberately uses split authority.

### Browser runtime authority

Chrome or Edge is authoritative for:

- which tabs and browser windows physically exist;
- runtime tab/window IDs;
- active tab and physical tab order;
- tab URL, title, favicon, and loading state.

### Outline authority

IndexedDB is authoritative for:

- stable node IDs;
- saved tabs and saved windows;
- groups and virtual nesting;
- user-defined order around saved/group nodes;
- snapshots.

Reconciliation combines these sources. It must not replace saved organization
with a flat copy of the browser.

## Extension launcher

`openOutlinerWindow()`:

1. Resolves the extension URL for `index.html`.
2. Searches populated browser windows for that URL.
3. Focuses the existing Outliner Popup and activates its tab when found.
4. Closes duplicate popup windows that contain only the outliner.
5. Otherwise creates a 420 x 800 popup.

The in-memory `outlinerWindowId` is an optimization, not the only identity
source. URL discovery allows recovery after service-worker suspension.

## Background service worker

### Event inputs

Reconciliation is requested for:

- `tabs.onCreated`
- `tabs.onRemoved`
- `tabs.onUpdated`
- `tabs.onActivated`
- `tabs.onMoved`
- `tabs.onAttached`
- `tabs.onDetached`
- `tabs.onReplaced`
- `windows.onCreated`
- `windows.onRemoved`
- `windows.onFocusChanged`
- extension installation/update initialization

Requests are debounced for 250 ms. Only one reconciliation runs at a time; an
event received during a run sets a pending flag for one subsequent run.

### Runtime messages

| Message | Sender | Purpose |
| --- | --- | --- |
| `INTENTIONAL_SAVE` | UI | Preserve a node when its live tab/window disappears |
| `RESTORE_NODE` | UI | Restore a tab, window, or group branch |
| `TAB_MOVED_UI` | UI | Move a physical tab to match drag/drop |
| `FORCE_RECONCILE` | UI | Request reconciliation after import/snapshot restore |
| `TREE_UPDATED` | Background | Tell the UI to reload IndexedDB |

Message handling is fire-and-forget; listeners do not claim an asynchronous
response channel.

## Reconciliation algorithm

`reconcileTabs()` performs these stages:

1. **Read browser state.** Query all populated windows and ignore transient
   zero-tab results.
2. **Exclude outliner pages.** Remove the outliner tab and omit its empty popup
   window.
3. **Read persisted nodes.** Build ID and parent maps.
4. **Deduplicate open mappings.** Keep one open node per browser window/tab ID
   and mark duplicates for removal.
5. **Fallback match after restart.**
   - Score unmatched persisted windows by shared non-placeholder URLs.
   - Match unmatched tabs by URL, preferring descendants of the matched window.
6. **Process missing live objects.**
   - Intentionally saved nodes become `saved`.
   - Other missing tabs are removed.
   - Empty missing windows are removed; windows with surviving children become
     saved.
7. **Create/update live nodes.** Persist current metadata and runtime IDs.
8. **Positional weave.** Merge physical tab order with saved/group positions.
9. **Prune empty windows and repair integrity.**
   - Remove persisted window nodes with no valid surviving children, including
     empty saved nodes restored from snapshots.
   - Ensure every non-root node has an existing parent.
   - Ensure parents list their children.
   - Remove child references that disagree with `parentId`.
10. **Persist and broadcast.** Batch writes, remove marked nodes, then send
    `TREE_UPDATED`.

### Positional weave

`positionalWeave()` treats live direct-window tabs as an ordered sequence while
retaining non-live IDs, including groups and saved tabs, in their outline
positions. This prevents reconciliation from flattening virtual organization.

## Restore behavior

### Restore one tab

- Reuse an open ancestor browser window when possible.
- Calculate the physical insertion index from preceding open outline nodes.
- When the parent window is closed, create the new browser window with the
  target URL directly, avoiding an extra default tab.

### Restore a window or group

- Recursively collect descendant tab nodes.
- Restore into an open ancestor window for groups when available.
- Otherwise create a new browser window with the URL array.
- Empty branches do not create a browser window.

### Autoplay protection

HTTP(S) restore URLs receive an `outliner-paused` hash marker.
`public/content.js` detects the marker, removes it from the address bar, and
temporarily pauses audio/video until user interaction or a ten-second timeout.

## UI architecture

`App.tsx` loads flat nodes from IndexedDB, hydrates `children`, and sorts child
objects using each parent's `childIds`.

### UI state

React component state holds:

- hydrated tree data;
- active drag item;
- search query;
- backup modal state and snapshot metadata;
- GitHub settings and operation status.

Persistent outline state is not held in a global React store. Mutations write to
IndexedDB and trigger either a local `REFRESH_TREE` event or a background
`TREE_UPDATED` message.

### Drag/drop

The UI uses `DndContext`, `SortableContext`, pointer and keyboard sensors.
Hierarchy guards reject cycles and invalid parent types. After persistence,
open descendant tabs are moved with `TAB_MOVED_UI`; a branch moved outside an
open browser window is converted to saved state.

## Storage

Database: `tab-session-manager`
Version: `2`

### `nodes` store

- Key path: `id`
- Indexes: `parentId`, `type`, `status`
- Contains the root workspace and all window, tab, group, or reserved separator
  nodes.

### `snapshots` store

- Key path: `id` (creation timestamp)
- Contains `createdAt`, `nodeCount`, and a full copy of nodes.

### GitHub settings

`gitToken`, `gitRepo`, and `gitPath` are stored in `chrome.storage.local`.
The extension does not encrypt the token.

## Backup and import

The export wrapper is:

```json
{
  "version": 1,
  "exportedAt": 0,
  "nodeCount": 0,
  "nodes": []
}
```

Validation checks:

- wrapper or raw-array format;
- required string IDs;
- unique IDs;
- supported node types;
- root existence;
- valid `parentId` and `childIds`;
- bidirectional parent-child agreement.

Import first creates a safety snapshot, clears the node store, converts open
nodes to saved, removes runtime browser IDs, and writes the sanitized nodes.

## Build architecture

The build is intentionally split into two Vite invocations:

1. `vite.config.ts` builds `index.html` and a self-contained `main.js`.
2. `vite.background.config.ts` builds a self-contained `background.js` without
   clearing the first build.
3. `scripts/verify-dist.mjs` verifies that manifest/HTML references exist and
   that both JavaScript entry files have no external static imports.

This avoids a service-worker registration failure when a hashed shared chunk is
missing from an unpacked extension directory.

## Testing

### Unit/component tests

Vitest with Happy DOM covers:

- positional weave and restore indices;
- close-save, remove, and drag/drop behavior;
- background restore behavior;
- group restoration;
- import validation and sanitization;
- outliner popup uniqueness;
- reconciliation deduplication and cleanup;
- search and snapshot-backed UI behavior.

### Browser tests

Playwright covers:

- fresh shell and accessible controls;
- snapshots and JSON download;
- GitHub settings validation;
- group creation, search, and persistence;
- unpacked extension service-worker registration.

The local web harness does not provide real extension APIs for most UI tests.
The service-worker registration test launches the compiled `dist` extension in
a persistent Chromium context.

## Permissions and security

Manifest permissions:

- `tabs`
- `windows`
- `storage`

Host permission:

- `<all_urls>` for the autoplay-protection content script.

Risks and constraints:

- GitHub PATs are locally stored but not encrypted by this extension.
- Internal browser URLs may not be restorable.
- Broad host permission should be revisited if autoplay protection changes.
- Import replaces the current outline after confirmation; the safety snapshot
  is the recovery mechanism.

## Known technical gaps

- No explicit schema-migration framework beyond IndexedDB version handling.
- `crashed`, `missing`, and `restoring` are defined but not a complete
  user-facing state machine.
- URL fallback matching can be ambiguous when many tabs share one URL.
- No virtualized tree for very large node counts.
- Live drag/drop and close-save are not yet exercised end-to-end against a real
  extension browser context.
- Full lint currently includes pre-existing debt outside the packaging changes.
