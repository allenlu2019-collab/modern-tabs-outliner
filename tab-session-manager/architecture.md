# Technical Architecture

This document describes the technical design for the Tree-Based Browser Session Manager extension.

## Overview

The extension consists of:

1. **Background service worker** — manages browser state, persistence, and coordination
2. **Popup UI / Side Panel** — main UI for viewing/editing the tree
3. **Storage layer** — persists tree and settings
4. **Runtime reconciliation** — maps browser tabs/windows to tree nodes

## System diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Runtime                          │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │   Tabs API  │  │ Windows API │  │ Sessions API     │   │
│  └─────────────┘  └─────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Background Service Worker                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Runtime Reconciler                                  │   │
│  │  - Listens to tab/window events                      │   │
│  │  - Maps runtime IDs ↔ node IDs                       │   │
│  │  - Detects crashes/missing tabs                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tree Manager                                        │   │
│  │  - Node CRUD                                         │   │
│  │  - Tree operations (move, reorder)                   │   │
│  │  - Validation                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Action Handler                                      │   │
│  │  - Close-save tabs/windows                           │   │
│  │  - Restore tabs/windows                              │   │
│  │  - Bulk operations                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Storage Manager                                     │   │
│  │  - Persists tree to IndexedDB                        │   │
│  │  - Settings to chrome.storage.local                  │   │
│  │  - Backup/snapshot logic                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                    Message passing
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Popup UI                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tree View                                           │   │
│  │  - Renders nodes                                     │   │
│  │  - Drag-and-drop                                     │   │
│  │  - Selection                                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Node Detached Details                               │   │
│  │  - Edit metadata                                     │   │
│  │  - Actions                                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Toolbar                                             │   │
│  │  - Search                                            │   │
│  │  - Export/import                                     │   │
│  │  - Settings                                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Data flow

### 1. Initial load
```
Popup opens → Request tree from background → Storage loads tree → 
Runtime reconciler updates open node status → Tree sent to popup → Render
```

### 2. Close-save tab
```
User clicks "Close-save" → Popup sends action → Background captures tab metadata → 
Close browser tab → Update node status to saved → Persist → Notify popup → UI updates
```

### 3. Restore tab
```
User clicks "Restore" → Popup sends action → Background opens URL → 
Capture new tab ID → Update node status to open → Persist → Notify popup → UI updates
```

### 4. Tree edit (drag-drop)
```
User drags node → Popup sends move action → Background validates → 
Update tree structure → Persist → Notify popup → UI updates
```

## Component details

### Background service worker

#### Runtime Reconciler
- Listens to: `chrome.tabs.onCreated`, `onUpdated`, `onRemoved`, `onMoved`
- Listens to: `chrome.windows.onCreated`, `onRemoved`, `onFocusChanged`
- Maintains mapping: `browserTabId` ↔ `nodeId`
- On startup: compares persisted "open" nodes with actual browser state, marks mismatches as crashed/missing

#### Tree Manager
- Maintains in-memory tree structure
- Provides operations:
  - `addNode(parentId, nodeData)`
  - `removeNode(nodeId)`
  - `moveNode(nodeId, newParentId, index)`
  - `updateNode(nodeId, updates)`
  - `getNode(nodeId)`
  - `getSubtree(nodeId)`
- Validates operations (no cycles, valid parent types)

#### Action Handler
- `closeSaveTab(nodeId)`: captures metadata, closes tab, marks saved
- `closeSaveWindow(nodeId)`: captures all child tabs, closes window
- `restoreTab(nodeId)`: opens URL, captures new tab ID
- `restoreWindow(nodeId)`: creates window, restores child tabs
- `closeSaveAll()`: snapshot current session, close all non-essential tabs

#### Storage Manager
- **Primary storage**: IndexedDB for tree data (can be large)
- **Settings**: `chrome.storage.local` for preferences
- **Backups**: periodic snapshots in IndexedDB
- **Export/import**: JSON serialization

### Popup UI

#### Tree View
- Virtualized list for performance
- Drag-and-drop via `dnd-kit`
- Keyboard navigation
- Selection (single/multiple)
- Collapse/expand

#### Node Details
- Shows metadata for selected node
- Edit title, tags, color
- Action buttons (close-save, restore, delete, etc.)

#### Toolbar
- Search input with real-time filtering
- Export/import buttons
- Settings button
- "Close-save all" button

## Storage schema

### IndexedDB database: `tab-session-manager`

#### Stores:
1. **nodes**
   - key: `id`
   - indexes: `parentId`, `type`, `status`

2. **snapshots**
   - key: `timestamp`
   - stores full tree JSON for backup

3. **settings**
   - key: `name`
   - stores UI preferences

### Node document structure
```ts
{
  id: string,
  type: "workspace" | "window" | "tab" | "group" | "separator",
  parentId: string | null,
  childIds: string[],
  title?: string,
  createdAt: number,
  updatedAt: number,
  sortOrder: number,
  collapsed?: boolean,
  color?: string,
  tags?: string[],
  
  // type-specific fields
  status?: "open" | "saved" | "restoring" | "crashed" | "missing",
  url?: string,
  favIconUrl?: string,
  browserTabId?: number,
  browserWindowId?: number,
  openerTabNodeId?: string,
  pinned?: boolean,
  audible?: boolean,
  muted?: boolean,
  incognito?: boolean
}
```

### chrome.storage.local
```ts
{
  "settings": {
    "autoParentNewTabs": true,
    "restoreTarget": "same-window", // "same-window" | "new-window"
    "theme": "light",
    "backupInterval": 300000, // 5 minutes
    "maxBackups": 10
  },
  "uiState": {
    "expandedNodes": string[],
    "selectedNode": string | null,
    "searchQuery": ""
  }
}
```

## Message passing

### Popup → Background
```ts
// Request tree
{ type: "GET_TREE" }

// Tree mutation
{ 
  type: "MOVE_NODE", 
  payload: { nodeId: string, newParentId: string, index: number } 
}

// Action
{ 
  type: "CLOSE_SAVE_TAB", 
  payload: { nodeId: string } 
}

// Export/import
{ 
  type: "EXPORT_TREE" 
}
{ 
  type: "IMPORT_TREE", 
  payload: { treeJson: string } 
}
```

### Background → Popup
```ts
// Tree update
{ 
  type: "TREE_UPDATED", 
  payload: { tree: Tree } 
}

// Action result
{ 
  type: "ACTION_COMPLETE", 
  payload: { action: string, success: boolean, error?: string } 
}

// Runtime event
{ 
  type: "TAB_CLOSED_EXTERNALLY", 
  payload: { nodeId: string } 
}
```

## State management

### Background
- In-memory tree (loaded from storage)
- Runtime ID mapping
- Event listeners

### Popup
- Local copy of tree (synced via messages)
- UI state (selection, expanded nodes, search)
- Optimistic updates for better UX

## Performance considerations

### Large trees
- Virtualize tree rendering
- Lazy load subtrees if needed
- Debounce storage writes
- Batch updates

### Storage
- IndexedDB for large data
- Compress JSON for backups
- Limit backup count

### Memory
- Background worker: keep only necessary data in memory
- Popup: virtualize, don't keep full DOM for all nodes

## Security considerations

### Permissions
- `tabs`: needed to read/close/restore tabs
- `windows`: needed to manage windows
- `sessions`: needed for crash recovery
- `storage`: needed for persistence
- `downloads`: needed for export

### Data privacy
- All data stays local unless explicitly exported
- No telemetry or analytics in V1
- No cloud sync unless user opts in later

### URL restrictions
- Cannot restore `chrome://`, `edge://`, extension pages
- Gracefully handle these cases

## Error handling

### Common errors
1. **Tab close failed** — permission issue, show user
2. **URL cannot be restored** — mark as unsupported
3. **Storage full** — warn user, offer export
4. **Browser API unavailable** — fallback where possible

### Recovery
- Regular backups
- Validate tree on load
- Repair corrupted nodes if possible

## Testing strategy

### Unit tests
- Tree operations (add, remove, move)
- Storage layer
- Runtime reconciliation

### Integration tests
- Background + popup communication
- Export/import
- Close-save/restore flows

### Manual testing
- Chrome MV3
- Edge MV3
- Large tree performance
- Crash/recovery scenarios

## Deployment

### Chrome Web Store
- Package extension
- Submit for review
- Update process

### Edge Add-ons
- Same package, different store
- May need minor adjustments

### Development
- Load unpacked extension
- Hot reload for popup
- Background worker reloads on change

## Future extensibility

### Plugin points
1. **Export formats** — add HTML, Markdown, etc.
2. **Cloud sync** — add providers (Drive, Dropbox, etc.)
3. **AI features** — summarization, auto-tagging
4. **Collaboration** — shared workspaces

### Configuration
- Settings page for all options
- Theme system
- Keyboard shortcut customization

## Decision log

### Framework choice: Plasmo
- Pros: modern, React-based, good tooling
- Cons: abstraction layer
- Alternative: raw MV3 + React setup

### Storage: IndexedDB + chrome.storage.local
- IndexedDB for large tree data
- chrome.storage.local for settings (simpler API)

### UI: React + TypeScript
- Standard for extensions
- Good component ecosystem
- Type safety

### Drag-and-drop: dnd-kit
- Modern, performant
- Good accessibility
- Tree support

## Open technical questions

1. **Virtualization library**: `react-virtuoso` vs `react-window`?
2. **State synchronization**: optimistic updates vs wait-for-background?
3. **Backup strategy**: incremental vs full snapshots?
4. **Migration system**: how to handle schema changes?

## References

- Chrome Extensions MV3: https://developer.chrome.com/docs/extensions/mv3/
- Edge Add-ons: https://docs.microsoft.com/en-us/microsoft-edge/extensions-chromium/
- Plasmo: https://docs.plasmo.com/
- dnd-kit: https://docs.dndkit.com/
