# Modern Tabs Outliner Current UI Reference

Status: As built in version 1.0.15

This document describes the current detached popup. It is not a proposal for a
side panel, dashboard, details pane, notes system, or settings page.

## Popup

The extension action creates or focuses one 420 x 800 detached popup.

```text
+--------------------------------------------------+
| Search tabs, windows, groups... (Ctrl+F)      [x]|
+--------------------------------------------------+
| Current Session                         [Backup] |
|                                             [+]  |
+--------------------------------------------------+
| v [Window] Research                    [x] [del] |
|   |-- [favicon] Open tab               [x] [del] |
|   |-- v [Group] Project                [x] [del] |
|   |     `-- [favicon] Saved tab            [del] |
|   `-- [favicon] Another tab            [x] [del] |
+--------------------------------------------------+
```

The actual buttons are compact icon buttons with accessible labels and hover
titles.

## Tree rows

### Window or group

```text
[drag] [expand] [type icon] Editable title [status/count] [close/restore] [remove]
```

- Select the title to edit it inline.
- Press Enter or blur to save; press Escape to cancel.
- Select the row outside the title/actions to expand or collapse.
- Close appears when the branch contains open tabs.
- Restore appears when the branch contains no open tabs.

### Tab

```text
[drag] [favicon] Title                                      [close] [remove]
```

- Selecting an open tab focuses its physical browser tab and window.
- Selecting a saved tab restores it.
- Close performs close-save.
- Remove permanently deletes the node.

## Search

```text
+--------------------------------------------------+
| project query                               [x]  |
| Search Results                                  |
| ...matching branches...               [extract] |
+--------------------------------------------------+
```

- Search matches title and URL.
- Matching ancestors remain visible.
- All matching branches are expanded.
- `Ctrl+F` and `Cmd+F` focus the field.
- Extract creates a browser window for matching tabs.

## Drag/drop

- Drag handles are available on every rendered node.
- Windows remain at root.
- Tabs can be placed under windows or groups.
- Groups cannot be placed under tabs.
- Cyclic moves are rejected.
- A drag overlay shows the moving item's icon and title.

## Backup and Restore modal

```text
+--------------------------------------------------+
| Backup & Restore                            [x]  |
+--------------------------------------------------+
| [Save Current State]                             |
|                                                  |
| Local File Sync                                  |
| [Export JSON] [Import JSON]                      |
|                                                  |
| GitHub Cloud Sync                         [open] |
|   Personal Access Token                          |
|   GitHub Repository                              |
|   File Path in Repo                              |
|   [Push] [Pull]                                  |
|                                                  |
| Local Snapshots                                  |
|  timestamp (relative time) - N items             |
|                             [Restore] [Delete]    |
+--------------------------------------------------+
```

Import, GitHub pull, snapshot restore, and snapshot delete use native
confirmation dialogs.

## Responsive behavior

The popup is designed for a narrow fixed-width window. The tree can grow
vertically and uses indentation for hierarchy. There is no current two-column
layout or detached details panel.

## Accessibility contract

- Primary icon buttons have accessible names.
- Search uses a stable placeholder and keyboard focus shortcut.
- Pointer and keyboard sensors are configured for drag/drop.
- Full keyboard-only tree manipulation remains an area for additional
  verification.

## Not implemented

- Browser side panel
- Context menu
- Multi-select/bulk edit mode
- Notes and todos
- Details panel
- Onboarding tutorial
- Toast notification system
- Settings page
- Timeline or tag views
