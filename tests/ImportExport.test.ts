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
});

