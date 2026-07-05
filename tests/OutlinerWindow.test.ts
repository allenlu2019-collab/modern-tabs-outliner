import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openOutlinerWindow } from '../src/background-logic';

describe('Outliner window launcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.runtime.getURL).mockImplementation((path: string) => `chrome-extension://modern-outliner/${path}`);
    vi.mocked(chrome.windows.getAll).mockResolvedValue([]);
    vi.mocked(chrome.windows.create).mockResolvedValue({ id: 123, type: 'popup', tabs: [] });
  });

  it('creates a popup when no outliner window exists', async () => {
    await openOutlinerWindow();

    expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
      url: 'chrome-extension://modern-outliner/index.html',
      type: 'popup',
      focused: true,
    }));
  });

  it('focuses an existing outliner popup instead of creating another one', async () => {
    vi.mocked(chrome.windows.getAll).mockResolvedValue([
      {
        id: 42,
        type: 'popup',
        tabs: [{ id: 7, url: 'chrome-extension://modern-outliner/index.html' }],
      },
    ] as chrome.windows.Window[]);

    await openOutlinerWindow();

    expect(chrome.windows.update).toHaveBeenCalledWith(42, { focused: true });
    expect(chrome.tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it('closes duplicate outliner popup windows after focusing one', async () => {
    vi.mocked(chrome.windows.getAll).mockResolvedValue([
      {
        id: 42,
        type: 'popup',
        tabs: [{ id: 7, url: 'chrome-extension://modern-outliner/index.html' }],
      },
      {
        id: 43,
        type: 'popup',
        tabs: [{ id: 8, url: 'chrome-extension://modern-outliner/index.html' }],
      },
    ] as chrome.windows.Window[]);

    await openOutlinerWindow();

    expect(chrome.windows.update).toHaveBeenCalledWith(42, { focused: true });
    expect(chrome.windows.remove).toHaveBeenCalledWith(43);
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it('does not close a normal browser window that happens to contain an outliner tab', async () => {
    vi.mocked(chrome.windows.getAll).mockResolvedValue([
      {
        id: 42,
        type: 'popup',
        tabs: [{ id: 7, url: 'chrome-extension://modern-outliner/index.html' }],
      },
      {
        id: 43,
        type: 'normal',
        tabs: [
          { id: 8, url: 'chrome-extension://modern-outliner/index.html' },
          { id: 9, url: 'https://example.com' },
        ],
      },
    ] as chrome.windows.Window[]);

    await openOutlinerWindow();

    expect(chrome.windows.update).toHaveBeenCalledWith(42, { focused: true });
    expect(chrome.windows.remove).not.toHaveBeenCalled();
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });
});
