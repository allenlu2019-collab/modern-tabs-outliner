# Modern Tabs Outliner

Modern Tabs Outliner preserves a structured browsing workspace across the live
browser session and locally saved outline state.

## Language

**Workspace**:
The complete persistent outline, rooted at one workspace node.
_Avoid_: Session, database

**Browser Window**:
A physical Chrome or Edge window reported by the browser Windows API.
_Avoid_: Outliner window, window node

**Browser Tab**:
A physical Chrome or Edge tab reported by the browser Tabs API.
_Avoid_: Tab node

**Outliner Popup**:
The detached extension window that displays the workspace. It is application UI
and is never part of the represented browsing workspace.
_Avoid_: Browser window, side panel

**Window Node**:
An outline node representing a live or saved browser window and containing tab
or group nodes.
_Avoid_: Browser window, outliner window

**Tab Node**:
An outline node representing the context of a live or saved browser tab.
_Avoid_: Browser tab, bookmark

**Group Node**:
A user-created virtual container for organizing tab nodes or nested groups. It
does not represent a browser tab group.
_Avoid_: Tab group, folder

**Open Node**:
A tab or window node currently linked to a physical browser object through a
runtime browser ID.
_Avoid_: Active node

**Saved Node**:
A tab or window node retained in the workspace without requiring a physical
browser object.
_Avoid_: Closed node, bookmark

**Close-save**:
An intentional transition that closes a physical browser object while preserving
its outline node and position.
_Avoid_: Close, delete

**Remove**:
A destructive operation that deletes a node and its descendants from the
workspace, closing any linked browser tabs.
_Avoid_: Close-save

**Restore**:
The transition that recreates physical browser tabs for saved outline nodes and
links the nodes to new runtime browser IDs.
_Avoid_: Reload, reopen session

**Reconciliation**:
The process that converges live browser state and the persistent workspace while
preserving saved organization.
_Avoid_: Refresh, sync

**Snapshot**:
A point-in-time local copy of every workspace node, stored separately from the
active workspace.
_Avoid_: Export, backup file

**Portable Backup**:
A validated JSON representation of the workspace whose runtime browser IDs are
removed during import.
_Avoid_: Snapshot
