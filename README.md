# Modern Tabs Outliner

Modern Tabs Outliner is a Chrome and Edge Manifest V3 extension that combines
live browser windows/tabs with saved tabs, saved windows, and virtual groups in
one persistent tree.

Current version: `1.0.17`

## Current capabilities

- One detached outliner popup, reused across extension-action clicks
- Live browser-window and tab reconciliation
- Open and saved items in one hierarchy
- Close-save, remove, and selective restore
- Drag/drop reordering and cross-window tab movement
- User-created groups and inline window/group rename
- Title/URL search and extraction of matches into a new window
- Local IndexedDB snapshots
- Validated JSON import/export with cross-device sanitization
- Manual GitHub Contents API push/pull
- Temporary autoplay suppression for restored HTTP(S) tabs

## Documentation

- [Product specification](tab-session-manager/spec.md)
- [Technical architecture](tab-session-manager/architecture.md)
- [Current UI reference](tab-session-manager/ui-wireframes.md)
- [Implementation status and backlog](tab-session-manager/tasks.md)
- [Domain language](CONTEXT.md)
- [Playwright test plan](specs/modern-outliner-core-flows.md)

## Technology

- React 19
- TypeScript 5.9
- Vite 8
- Chrome/Edge Manifest V3
- IndexedDB and `chrome.storage.local`
- `dnd-kit`
- Vitest and Playwright

## Development

```powershell
npm install
npm test
npm run build
npm run test:e2e
```

`npm run build` creates `dist/`, builds self-contained `main.js` and
`background.js` entry points, and verifies every referenced extension asset.

## Load the unpacked extension

1. Run `npm run build`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked** and select this repository's `dist` directory.
5. After each rebuild, select **Reload** on the extension card.

Do not load the repository root or `public/`; the unpacked extension root is
`dist/`.

## Test coverage

The unit/component suite covers storage, tree ordering, restore behavior,
import validation, reconciliation, popup uniqueness, search, and UI actions.

The Playwright suite covers the web UI flows and loads the compiled extension in
Chromium to verify that its Manifest V3 service worker registers.

## Current limitations

- No Firefox support
- No browser side-panel integration
- No notes/todos/details pane
- No automatic GitHub synchronization
- No complete user-facing crashed/missing recovery workflow
- No virtualized rendering for very large trees

## Repository notes

`dist/`, Playwright reports, and test results are generated artifacts and are not
committed. Build the extension locally on each machine that loads it.
