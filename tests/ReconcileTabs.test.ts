import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileTabs } from '../src/background-logic';
import type { BaseNode } from '../src/types';
import * as storage from '../src/storage';

vi.mock('../src/storage', () => ({
  getAllNodes: vi.fn(),
  putNode: vi.fn(),
  putNodes: vi.fn(),
  removeNode: vi.fn(),
}));

const root = (childIds: string[]): BaseNode => ({
  id: 'root',
  type: 'workspace',
  parentId: null,
  childIds,
  createdAt: 0,
  updatedAt: 0,
  sortOrder: 0,
});

describe('Browser state reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getAllNodes).mockResolvedValue([root([])]);
  });

  it('excludes the outliner popup after a service worker restart', async () => {
    vi.mocked(chrome.windows.getAll).mockResolvedValue([
      {
        id: 42,
        type: 'popup',
        tabs: [{ id: 7, url: 'chrome-extension://modern-outliner/index.html', index: 0 }],
      },
      {
        id: 100,
        type: 'normal',
        tabs: [{ id: 10, url: 'https://example.com', title: 'Example', index: 0 }],
      },
    ] as chrome.windows.Window[]);

    await reconcileTabs();

    const savedNodes = vi.mocked(storage.putNodes).mock.calls.flatMap(([nodes]) => nodes);
    expect(savedNodes).toContainEqual(expect.objectContaining({ type: 'window', browserWindowId: 100 }));
    expect(savedNodes).toContainEqual(expect.objectContaining({ type: 'tab', browserTabId: 10 }));
    expect(savedNodes).not.toContainEqual(expect.objectContaining({ browserWindowId: 42 }));
    expect(savedNodes).not.toContainEqual(expect.objectContaining({ browserTabId: 7 }));
  });

  it('removes a missing last tab and its empty window in the same pass', async () => {
    vi.mocked(chrome.windows.getAll).mockResolvedValue([]);
    vi.mocked(storage.getAllNodes).mockResolvedValue([
      root(['win-100']),
      {
        id: 'win-100',
        type: 'window',
        parentId: 'root',
        childIds: ['tab-10'],
        browserWindowId: 100,
        status: 'open',
        createdAt: 0,
        updatedAt: 0,
        sortOrder: 0,
      },
      {
        id: 'tab-10',
        type: 'tab',
        parentId: 'win-100',
        childIds: [],
        browserTabId: 10,
        browserWindowId: 100,
        status: 'open',
        createdAt: 0,
        updatedAt: 0,
        sortOrder: 0,
      },
    ]);

    await reconcileTabs();

    expect(storage.removeNode).toHaveBeenCalledWith('tab-10');
    expect(storage.removeNode).toHaveBeenCalledWith('win-100');
    expect(storage.putNodes).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'root', childIds: [] })]),
    );
  });

  it('removes duplicate nodes linked to the same browser window and tab', async () => {
    vi.mocked(chrome.windows.getAll).mockResolvedValue([
      {
        id: 100,
        type: 'normal',
        tabs: [{ id: 10, windowId: 100, url: 'https://example.com', title: 'Example', index: 0 }],
      },
    ] as chrome.windows.Window[]);
    vi.mocked(storage.getAllNodes).mockResolvedValue([
      root(['win-a', 'win-b']),
      {
        id: 'win-a',
        type: 'window',
        parentId: 'root',
        childIds: ['tab-a'],
        browserWindowId: 100,
        status: 'open',
        createdAt: 0,
        updatedAt: 0,
        sortOrder: 0,
      },
      {
        id: 'win-b',
        type: 'window',
        parentId: 'root',
        childIds: ['tab-b'],
        browserWindowId: 100,
        status: 'open',
        createdAt: 0,
        updatedAt: 0,
        sortOrder: 0,
      },
      {
        id: 'tab-a',
        type: 'tab',
        parentId: 'win-a',
        childIds: [],
        browserTabId: 10,
        browserWindowId: 100,
        status: 'open',
        createdAt: 0,
        updatedAt: 0,
        sortOrder: 0,
      },
      {
        id: 'tab-b',
        type: 'tab',
        parentId: 'win-b',
        childIds: [],
        browserTabId: 10,
        browserWindowId: 100,
        status: 'open',
        createdAt: 0,
        updatedAt: 0,
        sortOrder: 0,
      },
    ]);

    await reconcileTabs();

    expect(storage.removeNode).toHaveBeenCalledWith('win-b');
    expect(storage.removeNode).toHaveBeenCalledWith('tab-b');
    expect(storage.putNodes).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'root', childIds: ['win-a'] })]),
    );
  });
});
