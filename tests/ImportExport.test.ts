import { describe, it, expect } from 'vitest';
import { validateBackupData } from '../src/importValidation';
import type { BaseNode } from '../src/types';

describe('Import & Export Validation', () => {
  it('should validate a valid array backup format', () => {
    const validData: BaseNode[] = [
      { id: 'root', type: 'workspace', parentId: null, childIds: ['win-1'], createdAt: 0, updatedAt: 0, sortOrder: 0 },
      { id: 'win-1', type: 'window', parentId: 'root', childIds: ['tab-1'], createdAt: 0, updatedAt: 0, sortOrder: 0, status: 'open' },
      { id: 'tab-1', type: 'tab', parentId: 'win-1', childIds: [], createdAt: 0, updatedAt: 0, sortOrder: 0, url: 'https://site.com', status: 'open' }
    ];

    const result = validateBackupData(validData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toEqual(validData);
  });

  it('should validate a valid object backup format with nodes wrapper', () => {
    const validNodes: BaseNode[] = [
      { id: 'root', type: 'workspace', parentId: null, childIds: ['win-1'], createdAt: 0, updatedAt: 0, sortOrder: 0 },
      { id: 'win-1', type: 'window', parentId: 'root', childIds: ['tab-1'], createdAt: 0, updatedAt: 0, sortOrder: 0, status: 'open' },
      { id: 'tab-1', type: 'tab', parentId: 'win-1', childIds: [], createdAt: 0, updatedAt: 0, sortOrder: 0, url: 'https://site.com', status: 'open' }
    ];
    const validData = {
      version: 1,
      exportedAt: Date.now(),
      nodes: validNodes
    };

    const result = validateBackupData(validData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toEqual(validNodes);
  });

  it('should reject backup missing a root node', () => {
    const invalidData: BaseNode[] = [
      { id: 'win-1', type: 'window', parentId: null, childIds: ['tab-1'], createdAt: 0, updatedAt: 0, sortOrder: 0, status: 'open' },
      { id: 'tab-1', type: 'tab', parentId: 'win-1', childIds: [], createdAt: 0, updatedAt: 0, sortOrder: 0, url: 'https://site.com', status: 'open' }
    ];

    const result = validateBackupData(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing required root workspace node (id: 'root')");
  });

  it('should reject backup with mismatched parent-child references', () => {
    const invalidData: BaseNode[] = [
      { id: 'root', type: 'workspace', parentId: null, childIds: ['win-1'], createdAt: 0, updatedAt: 0, sortOrder: 0 },
      { id: 'win-1', type: 'window', parentId: 'root', childIds: ['tab-1'], createdAt: 0, updatedAt: 0, sortOrder: 0, status: 'open' },
      { id: 'tab-1', type: 'tab', parentId: 'some-other-win', childIds: [], createdAt: 0, updatedAt: 0, sortOrder: 0, url: 'https://site.com', status: 'open' }
    ];

    const result = validateBackupData(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Mismatched parenting') || e.includes('points to parent') || e.includes('references child'))).toBe(true);
  });

  it('should reject backup with invalid node types', () => {
    const invalidData = [
      { id: 'root', type: 'invalid-type-name', parentId: null, childIds: [], createdAt: 0, updatedAt: 0, sortOrder: 0 }
    ];

    const result = validateBackupData(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('invalid type'))).toBe(true);
  });

  it('should fix mismatched parenting using the database integrity cleanup algorithm', () => {
    // Mimic the database integrity cleanup logic we implemented in background-logic.ts
    const dirtyNodes: BaseNode[] = [
      { id: 'root', type: 'workspace', parentId: null, childIds: [], createdAt: 0, updatedAt: 0, sortOrder: 0 },
      // Case 1: win-1 points to parent 'root', but root doesn't list win-1 in its childIds.
      // Case 2: win-1 childIds lists tab-deleted-2 (missing), and lists tab-1.
      // Case 3: win-1 childIds lists tab-2, but tab-2 parentId points to win-2.
      { id: 'win-1', type: 'window', parentId: 'root', childIds: ['tab-1', 'tab-deleted-2', 'tab-2'], createdAt: 0, updatedAt: 0, sortOrder: 0, status: 'open' },
      { id: 'tab-1', type: 'tab', parentId: 'win-1', childIds: [], createdAt: 0, updatedAt: 0, sortOrder: 0, url: 'https://site.com', status: 'open' },
      { id: 'win-2', type: 'window', parentId: 'root', childIds: ['tab-2'], createdAt: 0, updatedAt: 0, sortOrder: 0, status: 'open' },
      { id: 'tab-2', type: 'tab', parentId: 'win-2', childIds: [], createdAt: 0, updatedAt: 0, sortOrder: 0, url: 'https://other.com', status: 'open' }
    ];

    // Check that it's initially invalid
    const initialValidation = validateBackupData(dirtyNodes);
    expect(initialValidation.isValid).toBe(false);

    // Apply the cleanup logic
    const finalNodeIds = new Set<string>(dirtyNodes.map(n => n.id));
    const allWorkingNodes = new Map<string, BaseNode>(dirtyNodes.map(n => [n.id, { ...n }]));

    // Pass 1: Child-to-Parent Alignment (Validate and fix parent pointers)
    allWorkingNodes.forEach((node) => {
      if (node.id === "root") return;

      const hasParent = node.parentId && finalNodeIds.has(node.parentId);
      if (!hasParent) {
        node.parentId = "root";
      }

      const parentNode = allWorkingNodes.get(node.parentId!);
      if (parentNode) {
        if (!parentNode.childIds.includes(node.id)) {
          parentNode.childIds.push(node.id);
        }
      }
    });

    // Pass 2: Parent-to-Child Clean up (Filter child lists based on correct parentId)
    allWorkingNodes.forEach((node) => {
      if (node.childIds && node.childIds.length > 0) {
        node.childIds = node.childIds.filter((cid) => {
          const child = allWorkingNodes.get(cid);
          return child && child.parentId === node.id;
        });
      }
    });

    const cleanedNodes = Array.from(allWorkingNodes.values());

    // Check that it's now valid!
    const cleanValidation = validateBackupData(cleanedNodes);
    expect(cleanValidation.isValid).toBe(true);
    expect(cleanValidation.errors).toHaveLength(0);

    // Verify Case 1 was resolved (win-1 added to root's childIds)
    const rootNode = cleanedNodes.find(n => n.id === 'root')!;
    expect(rootNode.childIds).toContain('win-1');
    expect(rootNode.childIds).toContain('win-2');

    // Verify Case 2 & 3 were resolved (win-1 childIds cleaned up: tab-deleted-2 and tab-2 are removed)
    const win1Node = cleanedNodes.find(n => n.id === 'win-1')!;
    expect(win1Node.childIds).toEqual(['tab-1']);

    // Verify tab-2 is correctly kept in win-2
    const win2Node = cleanedNodes.find(n => n.id === 'win-2')!;
    expect(win2Node.childIds).toEqual(['tab-2']);
  });

  it('should successfully round-trip database nodes through JSON export and import validation', () => {
    const originalNodes: BaseNode[] = [
      { id: 'root', type: 'workspace', parentId: null, childIds: ['win-1', 'group-1'], createdAt: 100, updatedAt: 100, sortOrder: 0 },
      { id: 'win-1', type: 'window', parentId: 'root', childIds: ['tab-1'], createdAt: 101, updatedAt: 101, sortOrder: 0, status: 'open' },
      { id: 'tab-1', type: 'tab', parentId: 'win-1', childIds: [], createdAt: 102, updatedAt: 102, sortOrder: 0, url: 'https://test.com', status: 'open' },
      { id: 'group-1', type: 'group', parentId: 'root', childIds: ['tab-2'], createdAt: 103, updatedAt: 103, sortOrder: 1, title: 'My Group' },
      { id: 'tab-2', type: 'tab', parentId: 'group-1', childIds: [], createdAt: 104, updatedAt: 104, sortOrder: 0, url: 'https://group.com', status: 'saved' }
    ];

    // 1. Simulate Export (convert to JSON wrapper format)
    const backupWrapper = {
      version: 1,
      exportedAt: Date.now(),
      nodeCount: originalNodes.length,
      nodes: originalNodes
    };
    const jsonString = JSON.stringify(backupWrapper);

    // 2. Simulate Import (parse and validate)
    const parsedData = JSON.parse(jsonString);
    const validation = validateBackupData(parsedData);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.nodes).toEqual(originalNodes);
  });

  it('should sanitize nodes on import by converting status to saved and clearing browser IDs', async () => {
    vi.resetModules();
    const mockPut = vi.fn();
    const mockClear = vi.fn();
    
    const mockStore = {
      put: mockPut,
      clear: mockClear,
      getAll: () => {
        const req = {
          onsuccess: null as any,
          result: []
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }
    };

    const mockDb = {
      transaction: () => {
        const tx = {
          objectStore: () => mockStore,
          oncomplete: null as any,
          onerror: null as any
        };
        setTimeout(() => {
          if (tx.oncomplete) tx.oncomplete();
        }, 0);
        return tx;
      }
    };

    const mockOpenRequest = {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      result: mockDb
    };

    vi.stubGlobal('indexedDB', {
      open: () => {
        setTimeout(() => {
          if (mockOpenRequest.onsuccess) mockOpenRequest.onsuccess();
        }, 0);
        return mockOpenRequest;
      }
    });

    const testNodes: BaseNode[] = [
      { id: 'root', type: 'workspace', parentId: null, childIds: ['win-1'], createdAt: 0, updatedAt: 0, sortOrder: 0 },
      { id: 'win-1', type: 'window', parentId: 'root', childIds: ['tab-1'], createdAt: 0, updatedAt: 0, sortOrder: 0, status: 'open', browserWindowId: 999 },
      { id: 'tab-1', type: 'tab', parentId: 'win-1', childIds: [], createdAt: 0, updatedAt: 0, sortOrder: 0, url: 'https://youtube.com', status: 'open', browserTabId: 888, browserWindowId: 999, active: true }
    ];

    const { importNodes } = await import('../src/storage');
    await importNodes(testNodes);

    expect(mockClear).toHaveBeenCalled();

    // Verify all nodes passed to put have been sanitized
    const savedNodes = mockPut.mock.calls.map(call => call[0]);
    
    // Check window node
    const winNode = savedNodes.find(n => n.id === 'win-1');
    expect(winNode).toBeDefined();
    expect(winNode.status).toBe('saved');
    expect(winNode.browserWindowId).toBeUndefined();

    // Check tab node
    const tabNode = savedNodes.find(n => n.id === 'tab-1');
    expect(tabNode).toBeDefined();
    expect(tabNode.status).toBe('saved');
    expect(tabNode.browserTabId).toBeUndefined();
    expect(tabNode.browserWindowId).toBeUndefined();
    expect(tabNode.active).toBe(false);

    vi.unstubAllGlobals();
  });

  it('should successfully validate and sanitize the real-world backup JSON file', async () => {
    vi.resetModules();
    const fs = await import('fs');
    const path = await import('path');
    
    const filePath = path.resolve(__dirname, 'backup-test-data.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const backupData = JSON.parse(fileContent);

    // 1. Validate the backup data structure
    const validation = validateBackupData(backupData);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.nodes).toBeDefined();

    // 2. Mock and execute importNodes to test the sanitization
    const mockPut = vi.fn();
    const mockClear = vi.fn();
    
    const mockStore = {
      put: mockPut,
      clear: mockClear,
      getAll: () => {
        const req = {
          onsuccess: null as any,
          result: []
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }
    };

    const mockDb = {
      transaction: () => {
        const tx = {
          objectStore: () => mockStore,
          oncomplete: null as any,
          onerror: null as any
        };
        setTimeout(() => {
          if (tx.oncomplete) tx.oncomplete();
        }, 0);
        return tx;
      }
    };

    const mockOpenRequest = {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      result: mockDb
    };

    vi.stubGlobal('indexedDB', {
      open: () => {
        setTimeout(() => {
          if (mockOpenRequest.onsuccess) mockOpenRequest.onsuccess();
        }, 0);
        return mockOpenRequest;
      }
    });

    const { importNodes } = await import('../src/storage');
    await importNodes(validation.nodes!);

    // Verify database was cleared
    expect(mockClear).toHaveBeenCalled();

    // Verify all nodes passed to put have been sanitized
    const savedNodes = mockPut.mock.calls.map(call => call[0]);

    // Check that we have the youtube window (which was open) and now it is saved and has no browser window ID
    const youtubeNode = savedNodes.find(n => n.type === 'window' && n.title === 'youtube');
    expect(youtubeNode).toBeDefined();
    expect(youtubeNode.status).toBe('saved');
    expect(youtubeNode.browserWindowId).toBeUndefined();

    // Check that we have a tab node that was open (e.g. Astro-Han/karpathy-llm-wiki) and now it is saved and has no browser tab/window ID
    const karpathyTab = savedNodes.find(n => n.type === 'tab' && n.url === 'https://github.com/Astro-Han/karpathy-llm-wiki');
    expect(karpathyTab).toBeDefined();
    expect(karpathyTab.status).toBe('saved');
    expect(karpathyTab.browserTabId).toBeUndefined();
    expect(karpathyTab.browserWindowId).toBeUndefined();
    expect(karpathyTab.active).toBe(false);

    vi.unstubAllGlobals();
  });
});

