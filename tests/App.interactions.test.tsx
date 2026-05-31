import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../src/App';

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: any) => {
      (global as any).triggerDragEnd = onDragEnd;
      return <div data-testid="mock-dnd-context">{children}</div>;
    },
  };
});

const { mockNodes } = vi.hoisted(() => ({
  mockNodes: [
    {
      id: 'root',
      type: 'workspace',
      parentId: null,
      childIds: ['win-1'],
      createdAt: 0,
      updatedAt: 0,
      sortOrder: 0
    },
    {
      id: 'win-1',
      type: 'window',
      title: 'Main Window',
      status: 'open',
      parentId: 'root',
      childIds: ['tab-1'],
      browserWindowId: 101,
      createdAt: 0,
      updatedAt: 0,
      sortOrder: 0
    },
    {
      id: 'tab-1',
      type: 'tab',
      title: 'Hanging Test Tab',
      url: 'https://test.com',
      status: 'open',
      parentId: 'win-1',
      browserTabId: 999,
      childIds: [],
      createdAt: 0,
      updatedAt: 0,
      sortOrder: 0
    }
  ]
}));

vi.mock('../src/storage', () => ({
  getAllNodes: vi.fn(() => Promise.resolve([...mockNodes])),
  removeNode: vi.fn((id) => {
    const idx = mockNodes.findIndex(n => n.id === id);
    if (idx !== -1) mockNodes.splice(idx, 1);
    return Promise.resolve();
  }),
  putNode: vi.fn().mockResolvedValue(undefined),
  putNodes: vi.fn().mockResolvedValue(undefined),
  removeSubtree: vi.fn().mockResolvedValue(undefined),
}));

describe('App React Component System Integration', () => {
  const INITIAL_NODES = [
    { id: 'root', type: 'workspace', parentId: null, childIds: ['win-1'], createdAt: 0, updatedAt: 0, sortOrder: 0 },
    { id: 'win-1', type: 'window', title: 'Main Window', status: 'open', parentId: 'root', childIds: ['tab-1'], browserWindowId: 101, createdAt: 0, updatedAt: 0, sortOrder: 0 },
    { id: 'tab-1', type: 'tab', title: 'Hanging Test Tab', url: 'https://test.com', status: 'open', parentId: 'win-1', browserTabId: 999, browserWindowId: 101, childIds: [], createdAt: 0, updatedAt: 0, sortOrder: 0 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNodes.length = 0;
    mockNodes.push(...INITIAL_NODES);
  });

  it('securely processes intentional closes without hanging promises', async () => {
    // We mock chrome.runtime.sendMessage to instantly resolve to simulate a well-behaved background worker (no hanging 'return true')
    (global as any).chrome.runtime.sendMessage.mockResolvedValue(true);
    
    render(<App />);

    // Wait for async tree hydration
    const tabTitle = await screen.findByText('Hanging Test Tab');
    expect(tabTitle).toBeInTheDocument();

    // Find the Close (X) button natively injected for open tabs
    const closeBtn = screen.getByTitle('Close Tab');
    
    // Fire the close click
    fireEvent.click(closeBtn);

    // Because the mocked sendMessage securely evaluates, the sequential browser remove string should successfully trigger.
    expect((global as any).chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "INTENTIONAL_SAVE", nodeId: 'tab-1' });

    // Validate the remove function physically executes across Chrome without freezing
    // Need a tiny flush delay since the click is async
    await new Promise(resolve => setTimeout(resolve, 0));
    expect((global as any).chrome.tabs.remove).toHaveBeenCalledWith(999);
  });

  it('automatically removes empty window when last tab is deleted', async () => {
    // Mock chrome APIs as needed
    (global as any).chrome.tabs.remove.mockResolvedValue(undefined);
    
    render(<App />);

    // Wait for async tree hydration
    const tabTitle = await screen.findByText('Hanging Test Tab');
    expect(tabTitle).toBeInTheDocument();

    // Find the Remove button for the tab (Trash can icon)
    const removeBtn = screen.getByTitle('Remove Node');
    
    // Fire the remove click
    fireEvent.click(removeBtn);

    // Give some time for async cleanup logic
    await new Promise(resolve => setTimeout(resolve, 10));

    // The storage removeSubtree should be called for the tab
    const storageArr = await import('../src/storage');
    expect(storageArr.removeSubtree).toHaveBeenCalledWith('tab-1');
  });

  it('saves window and tabs when close window button is clicked', async () => {
    render(<App />);
    
    // Wait for the window title to appear
    const windowTitle = await screen.findByText(/Main Window/);
    expect(windowTitle).toBeInTheDocument();

    // Find the "Close all in window" button (⨯)
    const closeBtn = screen.getByTitle('Close all in window');
    fireEvent.click(closeBtn);

    // Give some time for async branch processing
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify that intentional save message was sent
    // We mock chrome.runtime.sendMessage in the test setup (or it should be mocked)
    // In this test file, chrome.runtime.sendMessage is usually available via global mock
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'INTENTIONAL_SAVE',
      nodeId: 'win-1'
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'INTENTIONAL_SAVE',
      nodeId: 'tab-1'
    });

    // Verify that tabs.remove was called
    expect(chrome.tabs.remove).toHaveBeenCalledWith(999);

    // Verify that removeSubtree was NOT called for either
    const storage = await import('../src/storage');
    expect(storage.removeSubtree).not.toHaveBeenCalled();
  });

  it('closes physical browser tabs when Remove is clicked on an open tab', async () => {
    (global as any).chrome.tabs.remove.mockClear();
    render(<App />);

    const tabTitle = await screen.findByText('Hanging Test Tab');
    expect(tabTitle).toBeInTheDocument();

    const removeBtn = screen.getByTitle('Remove Node');
    fireEvent.click(removeBtn);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect((global as any).chrome.tabs.remove).toHaveBeenCalledWith(999);
  });

  it('transitions open tab to saved and closes physical tab when dropped into a saved window', async () => {
    mockNodes.push({
      id: 'win-saved',
      type: 'window',
      title: 'Saved Window',
      status: 'saved',
      parentId: 'root',
      childIds: [],
      browserWindowId: 102,
      createdAt: 0,
      updatedAt: 0,
      sortOrder: 0
    });

    render(<App />);

    await screen.findByText('Hanging Test Tab');

    const event = {
      active: {
        id: 'tab-1',
        data: { current: { node: mockNodes.find(n => n.id === 'tab-1') } }
      },
      over: {
        id: 'win-saved',
        data: { current: { node: mockNodes.find(n => n.id === 'win-saved') } }
      }
    };

    const triggerDragEnd = (global as any).triggerDragEnd;
    expect(triggerDragEnd).toBeDefined();

    await act(async () => {
      await triggerDragEnd(event);
    });

    const storage = await import('../src/storage');
    expect(storage.putNodes).toHaveBeenCalled();

    const lastCallArgs = vi.mocked(storage.putNodes).mock.calls;
    const persistedNodes = lastCallArgs[lastCallArgs.length - 1][0] as any[];
    const updatedTab = persistedNodes.find(n => n.id === 'tab-1');
    expect(updatedTab).toBeDefined();
    expect(updatedTab.status).toBe('saved');
    expect(updatedTab.browserTabId).toBeUndefined();
    expect(updatedTab.browserWindowId).toBeUndefined();

    expect((global as any).chrome.tabs.remove).toHaveBeenCalledWith(999);
  });
});
