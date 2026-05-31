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
      url: ['https://site1.com', 'https://site2.com'],
      focused: true
    }));

    // Verify storage updates
    expect(storage.putNodes).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'win-1', status: 'open', browserWindowId: 123 }),
      expect.objectContaining({ id: 'tab-1', status: 'open', browserTabId: 10 }),
      expect.objectContaining({ id: 'tab-2', status: 'open', browserTabId: 11 })
    ]));
  });

  it('automatically mutes restored tabs containing video or audio URLs (like YouTube) during window restoration', async () => {
    const mockNodes = [
      { id: 'win-1', type: 'window', childIds: ['tab-1', 'tab-2'], status: 'saved' },
      { id: 'tab-1', type: 'tab', parentId: 'win-1', url: 'https://www.youtube.com/watch?v=123', status: 'saved' },
      { id: 'tab-2', type: 'tab', parentId: 'win-1', url: 'https://normal-site.com', status: 'saved' }
    ];

    (storage.getAllNodes as any).mockResolvedValue(mockNodes);
    (global.chrome.tabs.update as any).mockClear();

    const mockCreatedWin = {
      id: 123,
      tabs: [
        { id: 10, url: 'https://www.youtube.com/watch?v=123', active: true },
        { id: 11, url: 'https://normal-site.com', active: false }
      ]
    };
    (global.chrome.windows.create as any).mockResolvedValue(mockCreatedWin);

    await handleMessage({ type: 'RESTORE_NODE', nodeId: 'win-1' });

    // Verify chrome.tabs.update was called to mute the YouTube tab
    expect(chrome.tabs.update).toHaveBeenCalledWith(10, { muted: true });
    // Verify it was NOT called for the normal site
    expect(chrome.tabs.update).not.toHaveBeenCalledWith(11, expect.any(Object));

    // Verify storage updates contains muted: true for tab-1 but not for tab-2
    expect(storage.putNodes).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'win-1', status: 'open', browserWindowId: 123 }),
      expect.objectContaining({ id: 'tab-1', status: 'open', browserTabId: 10, muted: true }),
      expect.objectContaining({ id: 'tab-2', status: 'open', browserTabId: 11 })
    ]));
  });
});
