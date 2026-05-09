# UI Wireframes & Interaction Design

This document describes the UI layout, components, and interaction patterns for the Tree-Based Browser Session Manager.

## Overall layout

### Dashboard page (full-page tab)

```
┌─────────────────────────────────────────────────────────────────┐
│  Toolbar                                                        │
│  [Search...] [Export] [Import] [Settings] [Close-save all]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │  Tree Panel             │  │  Details Panel              │  │
│  │                         │  │                             │  │
│  │  ▼ Workspace            │  │  ┌─────────────────────┐   │  │
│  │    ▼ Window 1 (3 tabs)  │  │  │  Node Info          │   │  │
│  │      ● Tab A            │  │  │                     │   │  │
│  │      ● Tab B            │  │  │  Title: [Tab A]     │   │  │
│  │      ● Tab C            │  │  │  URL: example.com   │   │  │
│  │    ▼ Window 2 (saved)   │  │  │  Status: ● Open     │   │  │
│  │      ○ Tab D (saved)    │  │  │                     │   │  │
│  │      ○ Tab E (saved)    │  │  │  ┌──────────────┐   │   │  │
│  │    ▼ Project Alpha      │  │  │  │  Actions     │   │   │  │
│  │      ● Tab F            │  │  │  │              │   │   │  │
│  │      📝 Meeting notes   │  │  │  │  ● Close-save│   │   │  │
│  │      ☐ Todo item        │  │  │  │  ● Restore   │   │   │  │
│  │                         │  │  │  │  ● Delete    │   │   │  │
│  │                         │  │  │  └──────────────┘   │   │  │
│  │                         │  │  │                     │   │  │
│  │                         │  │  │  ┌──────────────┐   │   │  │
│  │                         │  │  │  │  Notes       │   │   │  │
│  │                         │  │  │  │              │   │   │  │
│  │                         │  │  │  │  [Edit area] │   │   │  │
│  │                         │  │  │  └──────────────┘   │   │  │
│  │                         │  │  │                     │   │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Toolbar

**Elements:**
- Search input (with clear button)
- Export button (dropdown: JSON, HTML, text)
- Import button
- Settings button (gear icon)
- "Close-save all" button (prominent, maybe red/orange)

**Behavior:**
- Search filters tree in real-time
- Export opens download dialog
- Import opens file picker
- Settings opens settings page
- "Close-save all" shows confirmation dialog

### 2. Tree Panel

**Visual hierarchy:**
```
Workspace (root, always expanded)
├─▼ Window 1 (3 tabs) [● open]
│ ├─● Tab A [favicon] Title
│ ├─● Tab B [favicon] Title
│ └─● Tab C [favicon] Title
├─▼ Window 2 (saved) [○ saved]
│ ├─○ Tab D [favicon] Title
│ └─○ Tab E [favicon] Title
├─▼ Project Alpha [folder icon]
│ ├─● Tab F [favicon] Title
│ ├─📝 Meeting notes
│ └─☐ Todo item
└─▼ Archived Research [collapsed]
```

**Icons:**
- ● solid circle = open tab
- ○ hollow circle = saved tab
- ⚠ warning triangle = crashed/recoverable
- ❓ question mark = missing
- ▼/▶ triangle = collapsed/expanded
- 📝 = note
- ☐/☑ = todo unchecked/checked
- 📁 = group/folder

**Colors:**
- Open tab: default text color
- Saved tab: muted/gray
- Crashed: orange
- Missing: light gray
- Selected: blue background

**Interaction:**
- Click node: select, show in details panel
- Double-click tab: focus browser tab (if open)
- Right-click: context menu
- Drag handle (⋮⋮) on left for drag-and-drop
- Click ▼/▶ to collapse/expand

### 3. Details Panel

Shows when a node is selected.

**Sections:**

#### A. Node Info
- Type icon and label
- Title (editable for groups/notes/todos)
- URL (for tabs, read-only or clickable link)
- Status indicator with action button:
  - Open → "Close-save" button
  - Saved → "Restore" button
  - Crashed → "Restore" button
  - Missing → "Remove" button

#### B. Actions
- Primary action (Close-save/Restore)
- Secondary actions:
  - Delete (moves to trash/recycle bin)
  - Duplicate
  - Add child (tab/group/note/todo)
  - Color tag
  - Pin

#### C. Notes (for tab/group/window)
- Text area for notes
- Auto-saves
- Markdown-lite support (bold, italic, lists)

#### D. Metadata
- Created date
- Updated date
- Browser tab/window ID (if open)
- Tags (editable)

### 4. Context Menu

Right-click on tree node shows:

```
┌────────────────────────┐
│ Close-save             │
│ Restore                │
│ ────────────────────── │
│ Add note               │
│ Add todo               │
│ Add group              │
│ ────────────────────── │
│ Duplicate              │
│ Delete                 │
│ ────────────────────── │
│ Color █∙∙∙∙∙∙∙∙∙∙∙∙∙∙∙ │
│ Pin                    │
│ ────────────────────── │
│ Expand all             │
│ Collapse all           │
└────────────────────────┘
```

## Popup UI

Extension toolbar popup:

```
┌────────────────────────┐
│ Tab Session Manager    │
│                        │
│ Open: 12 tabs          │
│ Saved: 47 tabs         │
│                        │
│ [Save current tab]     │
│ [Save current window]  │
│ [Open dashboard]       │
│                        │
│ [Settings]             │
└────────────────────────┘
```

## Settings page

```
┌────────────────────────────────────────┐
│ Settings                               │
│                                        │
│ □ Auto-parent new tabs                 │
│   (new tabs become children of opener) │
│                                        │
│ Restore target: ● Same window          │
│                ○ New window            │
│                                        │
│ Theme: ● Light ○ Dark ○ System        │
│                                        │
│ Backup interval: [5] minutes           │
│ Max backups: [10]                      │
│                                        │
│ [Clear all data]                       │
│ [Export settings]                      │
│                                        │
│ [Save] [Cancel]                        │
└────────────────────────────────────────┘
```

## Search UI

**Empty state:**
```
Search tabs, notes, and URLs...

Recent searches:
- "project alpha"
- "meeting notes"
```

**With results:**
```
"project" (3 results)

▼ Project Alpha
  ● Tab F: Project Alpha dashboard
  📝 Meeting notes: project kickoff
▼ Window 1
  ● Tab B: Project documentation
```

**No results:**
```
No results for "xyz123"

Try:
- Different keywords
- Searching URLs
- Checking saved items
```

## Empty states

### First run
```
Welcome to Tab Session Manager!

Your current browser session has been imported.
You have 8 open tabs across 2 windows.

Next steps:
1. Try closing a tab with "Close-save" to free memory
2. Create a group for related tabs
3. Add notes to remember why tabs matter

[Get started] [View tutorial]
```

### Empty tree
```
No tabs or windows yet.

Open some tabs in your browser, then:
- They'll appear here automatically
- You can organize them into groups
- Add notes and todos

[Refresh] [Import from backup]
```

### All tabs saved
```
All tabs are saved! 🎉

You have 0 open tabs using browser resources.
Your saved work is preserved in the tree.

[Open dashboard tab] [Restore a branch]
```

## Interaction flows

### Flow: Close-save a tab
1. User clicks ● next to tab in tree
2. Button changes to loading spinner
3. Tab closes in browser
4. Icon changes to ○ (saved)
5. Button changes to "Restore"

### Flow: Drag-and-drop reorder
1. User drags drag handle (⋮⋮)
2. Visual line shows drop target
3. On drop, tree updates optimistically
4. Background persists change
5. If error, revert with notification

### Flow: Add note
1. User right-clicks tab → "Add note"
2. Note node appears below tab
3. Details panel opens to note editor
4. User types and note auto-saves

### Flow: Search
1. User types in search bar
2. Tree filters to matching nodes
3. Non-matching branches collapse
4. Matching nodes highlighted
5. Clear button appears

## Visual design system

### Colors
- Primary: `#2563eb` (blue)
- Success: `#16a34a` (green)
- Warning: `#ea580c` (orange)
- Danger: `#dc2626` (red)
- Muted: `#6b7280` (gray)

### Typography
- Font: system UI font stack
- Tree: 14px
- Details: 14px body, 16px headings
- Monospace for URLs/code

### Spacing
- 8px base unit
- Tree indent: 24px per level
- Panel padding: 16px

### Icons
- Use Material Icons or similar
- Consistent size: 16px for inline, 20px for buttons

## Responsive considerations

### Wide screen (default)
- Tree panel: 40% width
- Details panel: 60% width
- Side-by-side layout

### Narrow screen (< 900px)
- Tree panel full width
- Details panel as modal/overlay
- Or vertical stack

### Mobile (not primary target)
- Simple list view
- Basic actions only
- Dashboard not optimized for mobile

## Accessibility

### Keyboard navigation
- Tab through toolbar, tree, details
- Arrow keys navigate tree
- Enter to select/activate
- Space to collapse/expand
- Escape to cancel/search

### Screen readers
- ARIA labels for all interactive elements
- Tree role with aria-level, aria-expanded
- Live regions for status updates
- Focus management for modals

### Color contrast
- Meet WCAG AA minimum
- Status colors distinguishable without color alone
- High contrast mode support

## Animation

### Subtle animations
- Node collapse/expand: 150ms ease
- Drag preview: slight opacity
- Status change: fade transition
- Notification: slide in/out

### No animation
- Initial load (performance)
- Large tree operations
- When user prefers reduced motion

## Error states

### Permission error
```
⚠ Cannot close tab

The browser denied permission to close this tab.
This can happen with certain protected pages.

[Learn more] [Dismiss]
```

### Storage full
```
💾 Storage almost full

Your session tree is getting large.
Consider exporting old backups or removing unused items.

[Export now] [Manage backups] [Ignore]
```

### Crash recovery
```
🔄 Recoverable items found

3 tabs and 1 window were open before the browser restarted.
You can restore them individually or all at once.

[Restore all] [Review items] [Dismiss]
```

## Loading states

### Initial load
```
Loading your session...
```

### Tree loading
```
⌛ Syncing with browser...
```

### Action in progress
```
Closing tab... [spinner]
```

## Empty section states

### No node selected
```
Select a tab, window, or group to see details here.

Tip: You can close-save tabs to free browser memory
while keeping them in your tree.
```

### No notes
```
No notes yet.

Add a note to remember why this tab matters,
or capture ideas from the page.
```

### No search results
```
No results.

Try:
- Different keywords
- Checking saved items
- Searching URLs
```

## Export/import UI

### Export dialog
```
Export workspace

Format: ● JSON (full fidelity)
        ○ HTML (readable)
        ○ Text (simple)

Include: □ Notes
         □ Todos
         □ Metadata
         □ Backup snapshots

[Export] [Cancel]
```

### Import dialog
```
Import workspace

Warning: This will replace your current tree.
Make sure you have a backup if needed.

[Choose file] backup-2025-03-15.json

Options: ● Replace current tree
         ○ Merge with current tree

[Import] [Cancel]
```

## Tutorial/onboarding

### Step 1: Welcome
```
👋 Welcome to Tab Session Manager

This extension helps you organize tabs, reduce clutter,
and never lose your browsing context.

[Next] [Skip]
```

### Step 2: Tree view
```
🌳 Everything is a tree

Tabs live in windows, windows in groups,
and you can add notes and todos anywhere.

Try collapsing and expanding branches.
```

### Step 3: Close-save
```
💾 Close tabs without losing them

Click the ● next to any tab to "close-save" it.
The tab closes in your browser but stays in the tree.

[Try it with this tab] [Skip]
```

### Step 4: Restore
```
↩️ Restore when needed

Saved tabs show ○. Click to restore them.
You can restore one tab, a window, or a whole branch.

[Continue]
```

### Step 5: Notes & todos
```
📝 Add context

Right-click any item to add notes or todos.
Keep research organized with your tabs.

[Finish] [Back to dashboard]
```

## Notification system

### Toast notifications
- Appear bottom-right
- Auto-dismiss after 5s
- Manual dismiss with X
- Stack up to 3

### Examples
```
✅ Tab saved successfully
⏳ Restoring 3 tabs...
⚠ Could not restore chrome:// page
💾 Backup created
```

## Future UI enhancements (post-V1)

### Side panel
- Tree in browser side panel
- Always visible
- Quick actions

### Tab hover preview
- Show favicon, title, snippet
- On hover in tree

### Bulk edit mode
- Select multiple nodes
- Apply actions to all

### Timeline view
- Visualize tab/window lifespan
- Filter by date

### Tag cloud
- Visual tag frequency
- Filter by tag

---

## Implementation notes

### React component structure
```
Dashboard/
├── Layout.tsx
├── Toolbar/
│   ├── Search.tsx
│   ├── ExportButton.tsx
│   └── SettingsButton.tsx
├── TreePanel/
│   ├── Tree.tsx
│   ├── TreeNode.tsx
│   ├── NodeIcon.tsx
│   └── DragHandle.tsx
├── DetailsPanel/
│   ├── NodeInfo.tsx
│   ├── Actions.tsx
│   ├── NotesEditor.tsx
│   └── Metadata.tsx
└── ContextMenu/
    └── NodeContextMenu.tsx
```

### CSS approach
- CSS Modules or styled-components
- Design tokens for colors/spacing
- Responsive breakpoints

### State management
- Zustand for UI state
- Background messages for tree data
- Optimistic updates for smooth UX
