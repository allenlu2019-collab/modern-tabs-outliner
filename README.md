# Modern Tabs Outliner

## A. Spec
Modern Tabs Outliner is a tree-based browser session manager extension. It allows users to organize their tabs and windows into a hierarchical tree structure, enabling efficient management, saving, and restoring of browser sessions. Key features include:
- Visualizing tabs and windows as a tree.
- Closing and saving tabs/windows to free up memory while retaining them in the tree.
- Restoring saved tabs/windows seamlessly.
- Drag-and-drop reorganization of the session tree.

### UX Details & Advanced Features

#### Single Click Editing
To streamline organization, the outliner features an intuitive "Single Click Editing" UI. Simply click on the title of any Window or Group to instantly transform it into an editable text field. Hit `Enter` to save, or `Escape` to cancel. This completely removes the friction of right-click context menus.

#### Snapshot Backup & Restore
For peace of mind and strict session management, the outliner includes a Snapshot Backup system.
- **Save**: Click the "💾 Backup & Restore" button to capture an instant, point-in-time snapshot of your entire tree hierarchy (including custom names, groups, and all open/saved tabs).
- **Restore**: Easily view past snapshots, complete with a relative time indicator (e.g., `(2 hours ago)`). Restoring a backup safely overwrites the outliner state and instantly commands the background reconciler to sync your physical browser tabs against the retrieved snapshot.

#### Local JSON Backup & Import (Cross-Browser Portability)
- **Export JSON**: Download a complete, full-fidelity JSON file representing your entire outliner workspace.
- **Import JSON**: Restores a prior JSON backup. The system automatically creates a safety snapshot before overwriting, and **sanitizes** the imported data (converting `"open"` states to `"saved"` and stripping browser-session IDs) to ensure that backup files are fully portable across browser engines (e.g., Chrome to Edge) and device boundaries without reconciler conflicts.

#### GitHub Cloud Sync
- **Cloud Backup**: Paste a GitHub Personal Access Token (PAT), target repository path (`owner/repo`), and custom backup file path in the settings.
- **Push**: Instantly base64-encodes and commits your outliner tree hierarchy to your private/public GitHub repository.
- **Pull**: Instantly pulls and restores your tree from GitHub, applying the same safety checks and portability sanitization. This enables seamless, secure cloud sync of your tabs and workspace across different computers.

## B. Architecture
The technical design of this extension is divided into four main layers:
1. **Background Service Worker**: Manages browser state, persistence, and coordinates events.
2. **Popup UI**: The primary user interface for viewing and editing the session tree.
3. **Storage Layer**: Persists the tree structure and settings using IndexedDB and `chrome.storage.local`.
4. **Runtime Reconciliation**: Maps actual browser tabs and windows to internal tree node representations.

For a comprehensive breakdown of the system diagram, data flow, message passing, and storage schema, please refer to the detailed architecture document:
[Technical Architecture Document](tab-session-manager/architecture.md)

## C. Tool and Environment
- **Development Assistant**: Antigravity AI Assistant running on **Windows**.
- **Package Management & Build Tooling**: Node.js and `npm` running inside a **WSL2** (Windows Subsystem for Linux) environment.
- **Frameworks**: React, TypeScript, and Vite.
