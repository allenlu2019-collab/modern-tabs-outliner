import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMessage } from '../src/background-logic';
import * as storage from '../src/storage';

// Mock storage
vi.mock('../src/storage', () => ({
  getAllNodes: vi.fn(),
  putNode: vi.fn(),
  putNodes: vi.fn(),
  removeNode: vi.fn(),
  removeSubtree: vi.fn(),
}));

describe('Background Restoration Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores all child tabs when a window restore message is received', async () => {
    const mockNodes = [
      { id: 'win-1', type: 'window', childIds: ['tab-1', 'tab-2'], status: 'saved' },
      { id: 'tab-1', type: 'tab', parentId: 'win-1', url: 'https://site1.com', status: 'saved' },
      { id: 'tab-2', type: 'tab', parentId: 'win-1', url: 'https://site2.com', status: 'saved' }
    ];

    (storage.getAllNodes as any).mockResolvedValue(mockNodes);

    // Mock chrome.windows.create to simulate batch creation
    const mockCreatedWin = {
      id: 123,
      tabs: [
        { id: 10, url: 'https://site1.com', active: true },
        { id: 11, url: 'https://site2.com', active: false }
      ]
    };
    (global.chrome.windows.create as any).mockResolvedValue(mockCreatedWin);

    await handleMessage({ type: 'RESTORE_NODE', nodeId: 'win-1' });

    // Verify chrome.windows.create was called with the array of URLs
    expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
      url: ['https://site1.com#outliner-paused', 'https://site2.com#outliner-paused'],
      focused: true
    }));

    // Verify storage updates
    expect(storage.putNodes).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'win-1', status: 'open', browserWindowId: 123 }),
      expect.objectContaining({ id: 'tab-1', status: 'open', browserTabId: 10 }),
      expect.objectContaining({ id: 'tab-2', status: 'open', browserTabId: 11 })
    ]));
  });

  it('automatically adds #outliner-paused hash to all restored http/https URLs during window restoration', async () => {
    const mockNodes = [
      { id: 'win-1', type: 'window', childIds: ['tab-1', 'tab-2'], status: 'saved' },
      { id: 'tab-1', type: 'tab', parentId: 'win-1', url: 'https://www.youtube.com/watch?v=123', status: 'saved' },
      { id: 'tab-2', type: 'tab', parentId: 'win-1', url: 'https://normal-site.com', status: 'saved' }
    ];

    (storage.getAllNodes as any).mockResolvedValue(mockNodes);
    (global.chrome.tabs.update as any).mockClear();
    (global.chrome.windows.create as any).mockClear();

    const mockCreatedWin = {
      id: 123,
      tabs: [
        { id: 10, url: 'https://www.youtube.com/watch?v=123#outliner-paused', active: true },
        { id: 11, url: 'https://normal-site.com#outliner-paused', active: false }
      ]
    };
    (global.chrome.windows.create as any).mockResolvedValue(mockCreatedWin);

    await handleMessage({ type: 'RESTORE_NODE', nodeId: 'win-1' });

    // Verify chrome.windows.create was called with the #outliner-paused hash for all http/https tabs
    expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
      url: ['https://www.youtube.com/watch?v=123#outliner-paused', 'https://normal-site.com#outliner-paused'],
      focused: true
    }));

    // Verify chrome.tabs.update was NOT called to mute
    expect(chrome.tabs.update).not.toHaveBeenCalled();

    // Verify storage updates contains open status and links
    expect(storage.putNodes).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'win-1', status: 'open', browserWindowId: 123 }),
      expect.objectContaining({ id: 'tab-1', status: 'open', browserTabId: 10 }),
      expect.objectContaining({ id: 'tab-2', status: 'open', browserTabId: 11 })
    ]));
  });

  it('restores a tab into a closed parent window without creating a default extra tab', async () => {
    const mockNodes = [
      { id: 'win-1', type: 'window', childIds: ['tab-1'], status: 'saved' },
      { id: 'tab-1', type: 'tab', parentId: 'win-1', childIds: [], url: 'https://site1.com', status: 'saved' }
    ];
    (storage.getAllNodes as any).mockResolvedValue(mockNodes);
    (global.chrome.windows.getAll as any).mockResolvedValue([]);
    (global.chrome.windows.create as any).mockResolvedValue({
      id: 500,
      tabs: [{ id: 50, windowId: 500, url: 'https://site1.com' }]
    });

    await handleMessage({ type: 'RESTORE_NODE', nodeId: 'tab-1', url: 'https://site1.com' });

    expect(chrome.windows.create).toHaveBeenCalledWith({
      focused: true,
      url: 'https://site1.com'
    });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(storage.putNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tab-1', browserTabId: 50, browserWindowId: 500 })
    );
  });

  it('does not open a Chrome window when an empty saved window is restored', async () => {
    (storage.getAllNodes as any).mockResolvedValue([
      { id: 'win-empty', type: 'window', childIds: [], status: 'saved' }
    ]);

    await handleMessage({ type: 'RESTORE_NODE', nodeId: 'win-empty' });

    expect(chrome.windows.create).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });
});
