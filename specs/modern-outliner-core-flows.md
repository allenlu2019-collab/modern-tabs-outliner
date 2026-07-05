# Modern Outliner Core Flows Test Plan

## Application Overview

Modern Outliner is a React and TypeScript browser-extension UI for organizing tabs and windows in a tree. In a fresh browser context without extension background data, the web app exposes a search field, a Backup & Restore modal, GitHub sync settings, and an Add Group action.

## Assumptions

- **Seed:** `seed.spec.ts`
- Tests start from a fresh Playwright browser context.
- Tests run against the Vite app at `/` using the configured Playwright `baseURL`.
- External side effects are not performed: GitHub push/pull is validated only for missing settings, and import is not tested with private user files.
- Browser extension APIs may be absent in this web-app harness, so scenarios avoid flows that require real Chrome tabs or windows.

## Test Scenarios

### 1. Fresh Session Shell

#### 1.1 Render Primary Controls

**Steps:**
1. Navigate to `/`.
2. Locate the search input.
3. Locate the session root heading.
4. Locate the Backup & Restore button.
5. Locate the Add Group button.

**Expected Results:**
- Search input is visible with the placeholder `Search tabs, windows, groups... (Ctrl+F)`.
- `Current Session` is visible.
- Backup and Add Group controls are visible and accessible by role/name.

### 2. Backup And Restore Modal

#### 2.1 Open And Close Backup Modal

**Steps:**
1. Navigate to `/`.
2. Click Backup & Restore.
3. Verify the modal content.
4. Click the close button.

**Expected Results:**
- Modal title `Backup & Restore` appears.
- `Save Current State`, `Export JSON`, `Import JSON`, `GitHub Cloud Sync`, `Local Snapshots`, and `No backups found.` are visible.
- Closing the modal returns to the main shell without modal content.

#### 2.2 Create Empty Snapshot

**Steps:**
1. Navigate to `/`.
2. Open Backup & Restore.
3. Click `Save Current State`.

**Expected Results:**
- A local snapshot appears in the snapshot list.
- Snapshot metadata includes `0 items` for a fresh state.
- The empty-state message `No backups found.` is no longer visible.

#### 2.3 Export Empty JSON Backup

**Steps:**
1. Navigate to `/`.
2. Open Backup & Restore.
3. Click `Export JSON`.

**Expected Results:**
- Browser starts a file download.
- Download filename starts with `modern-outliner-backup-` and ends with `.json`.

### 3. GitHub Sync Settings Validation

#### 3.1 Show GitHub Settings

**Steps:**
1. Navigate to `/`.
2. Open Backup & Restore.
3. Click `GitHub Cloud Sync`.

**Expected Results:**
- Personal Access Token, GitHub Repository, and File Path in Repo fields are visible.
- File Path defaults to `tabs.json`.
- Push and Pull buttons are visible.

#### 3.2 Reject Push Without Required Settings

**Steps:**
1. Navigate to `/`.
2. Open Backup & Restore.
3. Expand GitHub Cloud Sync.
4. Click Push without entering token, repo, or path.

**Expected Results:**
- Error message `Please fill in all GitHub settings first.` is visible.
- No network-backed GitHub operation is attempted from the test.

### 4. Group Creation And Search

#### 4.1 Add Group In Fresh Session

**Steps:**
1. Navigate to `/`.
2. Click Add Group.

**Expected Results:**
- A group named `NEW GROUP` appears under Current Session.
- The group shows a child count of `0`.
- Group actions for restore/remove are visible.

#### 4.2 Search Existing Group

**Steps:**
1. Navigate to `/`.
2. Click Add Group.
3. Type `new` into the search input.

**Expected Results:**
- `Search Results` appears.
- `NEW GROUP` remains visible.
- The search can be cleared by clearing the input.

### 5. State Persistence

#### 5.1 Persist Added Group Across Reload

**Steps:**
1. Navigate to `/`.
2. Click Add Group.
3. Verify `NEW GROUP` appears.
4. Reload the page.

**Expected Results:**
- `NEW GROUP` is still visible after reload.
- The group still appears under `Current Session`.
- The search input and primary session controls remain available after reload.
