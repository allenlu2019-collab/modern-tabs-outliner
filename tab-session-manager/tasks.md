# Modern Tabs Outliner Implementation Status

Status: Version 1.0.16

This is a status and backlog document, not a speculative file layout. Completed
items refer to behavior present in the current source and automated tests.

## Completed

### Extension foundation

- [x] Raw Manifest V3 extension for Chrome and Edge
- [x] React and TypeScript popup UI
- [x] Vite development and production builds
- [x] Self-contained UI and background bundles
- [x] Distribution asset verification
- [x] Playwright service-worker registration test

### Persistence and model

- [x] Stable flat node model with parent/child references
- [x] IndexedDB `nodes` and `snapshots` stores
- [x] Batched writes and subtree removal
- [x] Hydration of flat nodes into a renderable tree
- [x] Parent-child integrity repair during reconciliation
- [x] Portable import sanitization

### Popup lifecycle

- [x] Detached outliner popup
- [x] Focus/reuse an existing popup
- [x] Close duplicate outliner-only popups
- [x] Exclude the outliner popup from represented browser state

### Reconciliation

- [x] Tab/window event listeners
- [x] Debounced and serialized reconciliation
- [x] Runtime-ID matching
- [x] URL fallback matching after restart
- [x] Duplicate open-ID cleanup
- [x] Same-pass missing-tab and empty-window cleanup
- [x] Restored empty saved-window and transient zero-tab cleanup
- [x] Positional weave preserving groups and saved items
- [x] Background-to-UI update broadcast

### Tree interactions

- [x] Render windows, tabs, and groups
- [x] Collapse/expand containers
- [x] Rename windows and groups
- [x] Focus open tabs
- [x] Close-save tabs and branches
- [x] Remove subtrees
- [x] Restore tabs, windows, and nested branches
- [x] Drag/drop reorder and reparent
- [x] Physical cross-window tab movement
- [x] Convert open tabs to saved when moved outside an open window

### Search and organization

- [x] Search titles and URLs
- [x] Preserve ancestor context in results
- [x] Add root groups
- [x] Extract matching tabs to a new browser window

### Backup and transfer

- [x] Create/list/restore/delete local snapshots
- [x] JSON export
- [x] Structural import validation
- [x] Safety snapshot before import
- [x] Manual GitHub push/pull
- [x] GitHub settings validation

### Restore safety

- [x] Restore a closed parent window without an extra default tab
- [x] Skip creating a browser window for an empty saved branch
- [x] Temporary autoplay suppression for restored HTTP(S) pages

## Automated contract

- [x] Unit tests for weave and restore indexing
- [x] Component tests for close-save, remove, drag/drop, restore, and search
- [x] Import/export validation and sanitization tests
- [x] Reconciliation regression tests
- [x] Outliner popup uniqueness tests
- [x] Playwright UI tests
- [x] Playwright compiled-extension service-worker registration test

## Prioritized backlog

### P1: Reliability semantics

- [ ] Define explicit crash, browser restart, external close, and extension reload
  transitions
- [ ] Decide whether unmatched previously-open nodes are removed, saved, or marked
  recoverable
- [ ] Make `crashed`, `missing`, and `restoring` statuses a coherent state machine
- [ ] Add extension-level E2E tests for close-save and live reconciliation

### P1: Data safety

- [ ] Add explicit IndexedDB schema migration modules
- [ ] Add recovery UI when database loading or reconciliation fails
- [ ] Add backup compatibility/version migration tests
- [ ] Document and test GitHub token removal/rotation

### P2: Interaction quality

- [ ] Verify complete keyboard-only tree operation
- [ ] Add clear empty/loading/error states
- [ ] Add undo or confirmation for destructive Remove operations
- [ ] Improve feedback for restricted or invalid restore URLs

### P2: Scale

- [ ] Benchmark 1,000+ nodes
- [ ] Add virtualization if measurements require it
- [ ] Reduce full-database reads in frequent UI actions

### P3: Optional product expansion

- [ ] Browser side-panel mode
- [ ] Settings/options page
- [ ] Notes, tags, or todos
- [ ] Context menus and multi-select
- [ ] Scheduled backups or automatic cloud sync
- [ ] Firefox support

## Known risks

1. URL fallback matching is ambiguous for repeated identical URLs.
2. Browser runtime IDs are temporary and may be reused.
3. MV3 service workers can suspend between events.
4. Internal browser URLs may be restricted.
5. GitHub PATs are stored locally without extension-level encryption.
6. Broad host permission is currently tied to restored-tab autoplay protection.
