# Tab Session Manager (Modern Tabs Outliner)

This directory contains planning and architecture documentation for the tree-based browser session manager extension (Modern Tabs Outliner).

## Documentation Files
* [Product Specification](spec.md) — Product specification, acceptance criteria, and roadmap.
* [Technical Architecture](architecture.md) — Technical design, data models, message passing, and database schemas.
* [UI & UX Wireframes](ui-wireframes.md) — Wireframes and UI interactions.
* [Tasks](tasks.md) — Implementation breakdown and checklists.

## Features Implemented
The extension is fully implemented and operational on both Google Chrome and Microsoft Edge. Key completed capabilities include:
1. **Unified Outliner Tree View**: Coexistence of open and saved windows/tabs/groups.
2. **Single-Click Title Editing**: Click on any group or window to rename it instantly.
3. **Automatic Background Reconciliation**: A robust reconciler automatically links your browser window session to the database, ensuring zero data loss on crashes or restarts.
4. **Local Snapshot Backups**: One-click point-in-time snapshot creation with automatic safety snapshots before destructive imports.
5. **Local JSON Import/Export**: Full outliner tree import and export supporting cross-browser portability sanitization.
6. **GitHub Cloud Sync**: Integration with the GitHub Contents API to backup and synchronize your outliner tree across devices and browser engines securely.
