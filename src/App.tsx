import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates 
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getAllNodes, putNode, putNodes, removeNode, removeSubtree, createSnapshot, getSnapshots, restoreSnapshot, deleteSnapshot, importNodes } from './storage';
import type { BaseNode, TreeNode } from './types';
import { generateId } from './utils';
import { pushToGitHub, pullFromGitHub } from './githubService';
import { validateBackupData } from './importValidation';
import './App.css';

// TreeNode is imported from types.ts — children is always populated during loadTree.


// --- Components ---

const timeAgo = (timestamp: number) => {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = Date.now() - timestamp;
  const diffDays = Math.round(diff / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return rtf.format(-diffDays, 'day');
  const diffHours = Math.round(diff / (1000 * 60 * 60));
  if (diffHours > 0) return rtf.format(-diffHours, 'hour');
  const diffMinutes = Math.round(diff / (1000 * 60));
  return rtf.format(-diffMinutes, 'minute');
};

const TabIcon = ({ url, favIconUrl }: { url?: string; favIconUrl?: string }) => {
  const [error, setError] = useState(false);
  const getDomain = (u?: string) => {
    try {
      return u ? new URL(u).hostname : '';
    } catch {
      return '';
    }
  };

  if (!favIconUrl || error) {
    return <div className="tab-icon-fallback">📄</div>;
  }

  return (
    <img 
      src={favIconUrl} 
      className="tab-icon" 
      onError={() => setError(true)} 
      alt={getDomain(url)}
      loading="lazy"
    />
  );
};

// This specialized sorting strategy tells dnd-kit NOT to do any automatic layout shifts
// during the drag. All layout updates are handled by us in handleDragEnd.
const noopSortingStrategy = () => null;

const NodeItem = ({ node, depth, isDragActive, forceExpand }: { node: TreeNode; depth: number; isDragActive: boolean; forceExpand?: boolean }) => {
  const [collapsed, setCollapsed] = useState(node.type === 'window' && node.status !== 'open');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title || '');

  // Auto-expand during search or status changes
  useEffect(() => {
    if (forceExpand) {
      setCollapsed(false);
    } else if (node.type === 'window' || node.type === 'group') {
      setCollapsed(node.status !== 'open');
    }
  }, [forceExpand, node.status, node.type]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: node.id,
    data: { node }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    marginLeft: `${depth * 20}px`,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 10 : 1
  };

  const handleTabClick = async () => {
    if (node.type !== 'tab') return;

    if (node.status === 'open' && node.browserTabId) {
      // Open tab: bring its window and tab into focus.
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.update(node.browserTabId, { active: true });
        if (node.browserWindowId) chrome.windows.update(node.browserWindowId, { focused: true });
      }
    } else if (node.status !== 'open') {
      // Saved/closed tab: restore it.
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: "RESTORE_NODE", nodeId: node.id, url: node.url })
          .catch(() => {});
      }
    }
  };

  const closeTab = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && node.browserTabId) {
        chrome.runtime.sendMessage({ type: "INTENTIONAL_SAVE", nodeId: node.id }).catch(() => {});
        chrome.tabs.remove(node.browserTabId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const removeNodeBtn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const allFlatNodes = await getAllNodes();
      const nodeMap = new Map(allFlatNodes.map(n => [n.id, n]));
      
      const getAllTabs = (id: string): BaseNode[] => {
        const n = nodeMap.get(id);
        if (!n) return [];
        if (n.type === 'tab') return [n];
        return (n.childIds || []).flatMap(cid => getAllTabs(cid));
      };

      const tabsToClose = getAllTabs(node.id).filter(t => t.status === 'open');
      
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        for (const t of tabsToClose) {
          if (t.browserTabId) chrome.tabs.remove(t.browserTabId).catch(() => {});
        }
      }

      // Cascade: remove this node and all descendants from storage.
      await removeSubtree(node.id);
      window.dispatchEvent(new CustomEvent('REFRESH_TREE'));
    } catch (err) {
      console.error(err);
    }
  };

  // Close all open browser tabs in this branch; let the background reconciler
  // broadcast TREE_UPDATED naturally (avoids the race where we refresh before tabs close).
  const closeBranch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const allFlatNodes = await getAllNodes();
      const nodeMap = new Map(allFlatNodes.map(n => [n.id, n]));
      
      const getAllTabs = (id: string): BaseNode[] => {
        const n = nodeMap.get(id);
        if (!n) return [];
        if (n.type === 'tab') return [n];
        return (n.childIds || []).flatMap(cid => getAllTabs(cid));
      };

      const tabsToClose = getAllTabs(node.id).filter(t => t.status === 'open');
      
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        for (const t of tabsToClose) {
           if (t.browserTabId) {
             // Pre-register as intentional saves so reconciler preserves them.
             chrome.runtime.sendMessage({ type: "INTENTIONAL_SAVE", nodeId: t.id }).catch(() => {});
           }
        }
        if (node.type === 'window') {
          chrome.runtime.sendMessage({ type: "INTENTIONAL_SAVE", nodeId: node.id }).catch(() => {});
        }
        // Close actual browser tabs — background onRemoved will trigger reconcile + TREE_UPDATED.
        for (const t of tabsToClose) {
          if (t.browserTabId) chrome.tabs.remove(t.browserTabId).catch(() => {});
        }
      }
      // Do NOT dispatch REFRESH_TREE here — background will broadcast after reconcile.
    } catch(err) {
      console.error(err);
    }
  };

  const restoreBranch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "RESTORE_NODE", nodeId: node.id }).catch(() => {});
    }
  };

  const removeWindowNodeBtn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (node.status === 'open' && node.browserWindowId
          && typeof chrome !== 'undefined' && chrome.windows) {
        chrome.windows.remove(node.browserWindowId).catch(() => {});
      }
      // Cascade: removes window + all child tabs/groups from storage.
      await removeSubtree(node.id);
      window.dispatchEvent(new CustomEvent('REFRESH_TREE'));
    } catch(err) {
      console.error(err);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim() === '' || editTitle === node.title) {
      setIsEditing(false);
      setEditTitle(node.title || '');
      return;
    }
    try {
      const updatedNode = { ...node, title: editTitle, updatedAt: Date.now() };
      delete (updatedNode as any).children;
      await putNode(updatedNode);
      setIsEditing(false);
      window.dispatchEvent(new CustomEvent('REFRESH_TREE'));
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className="tree-node" ref={setNodeRef} style={style}>
      {node.type === 'window' || node.type === 'group' ? (
        <div className="group-header" onClick={() => setCollapsed(!collapsed)}>
          <span className="drag-handle" {...attributes} {...listeners}>⣿</span>
          <span className="collapser">{collapsed ? '▶ ' : '▼ '}</span>
          <span className="node-icon">{node.type === 'window' ? '🪟' : '📁'}</span>
          {isEditing ? (
            <form onSubmit={handleRename} className="inline-edit" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setIsEditing(false);
                    setEditTitle(node.title || '');
                  }
                }}
                style={{ background: 'transparent', color: 'inherit', border: '1px solid #555', borderRadius: '4px', padding: '2px 4px', fontSize: 'inherit', outline: 'none' }}
              />
            </form>
          ) : (
            <span
              className="group-title"
              onClick={(e) => { 
                e.stopPropagation(); 
                setEditTitle(node.title || '');
                setIsEditing(true); 
              }}
              title="Click to rename"
            >
              {node.title} {node.status && node.status !== 'open' && <span className="status-badge">[{node.status}]</span>}
              {collapsed && node.children && <span className="child-count">({node.children.length})</span>}
            </span>
          )}
          <div className="node-actions group-actions">
            {/* Show Close button if branch has ANY open tabs recursively */}
            {(() => {
              const hasOpenTabs = (n: TreeNode & { status?: string }): boolean => {
                if (n.type === 'tab' && n.status === 'open') return true;
                return !!(n.children && n.children.some(child => hasOpenTabs(child)));
              };
              if (hasOpenTabs(node)) {
                return <button className="btn-icon" onClick={closeBranch} title={`Close all in ${node.type}`}>⨯</button>;
              } else {
                return <button className="btn-icon" onClick={restoreBranch} title={`Restore all in ${node.type}`}>↻</button>;
              }
            })()}
            <button className="btn-icon" onClick={node.type === 'window' ? removeWindowNodeBtn : removeNodeBtn} title="Remove">🗑️</button>
          </div>
        </div>
      ) : (
        <div
          className={`node-content ${node.status !== 'open' ? 'closed-tab' : ''}`}
          onClick={handleTabClick}
          title={node.status !== 'open' ? 'Click to restore this tab' : undefined}
        >
          <span className="drag-handle" {...attributes} {...listeners}>⣿</span>
          <TabIcon url={node.url} favIconUrl={node.favIconUrl} />
          <div className={`node-title ${node.active ? 'active-tab' : ''}`} title={node.title}>{node.title}</div>
          <div className="node-actions">
            {node.status === 'open' && (
              <button className="btn-icon" onClick={closeTab} title="Close Tab">⨯</button>
            )}
            <button className="btn-icon" onClick={removeNodeBtn} title="Remove Node">🗑️</button>
          </div>
        </div>
      )}

      {!collapsed && node.children && node.children.length > 0 && (
        <div className="node-children">
          {node.children.map(child => (
            <NodeItem key={child.id} node={child} depth={depth + 1} isDragActive={isDragActive} forceExpand={forceExpand} />
          ))}
        </div>
      )}
    </div>
  );
};

function App() {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [gitToken, setGitToken] = useState('');
  const [gitRepo, setGitRepo] = useState('');
  const [gitPath, setGitPath] = useState('tabs.json');
  const [showGitSettings, setShowGitSettings] = useState(false);
  const [gitStatusMsg, setGitStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isGitLoading, setIsGitLoading] = useState(false);

  // Load GitHub Sync settings on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['gitToken', 'gitRepo', 'gitPath'], (res) => {
        if (res.gitToken) setGitToken(res.gitToken);
        if (res.gitRepo) setGitRepo(res.gitRepo);
        if (res.gitPath) setGitPath(res.gitPath || 'tabs.json');
      });
    } else {
      const token = localStorage.getItem('gitToken') || '';
      const repo = localStorage.getItem('gitRepo') || '';
      const path = localStorage.getItem('gitPath') || 'tabs.json';
      setGitToken(token);
      setGitRepo(repo);
      setGitPath(path);
    }
  }, []);

  const saveGitSettings = (token: string, repo: string, path: string) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ gitToken: token, gitRepo: repo, gitPath: path });
    } else {
      localStorage.setItem('gitToken', token);
      localStorage.setItem('gitRepo', repo);
      localStorage.setItem('gitPath', path);
    }
  };

  const handleExportLocal = async () => {
    try {
      const nodes = await getAllNodes();
      const backupData = {
        version: 1,
        exportedAt: Date.now(),
        nodeCount: nodes.length,
        nodes
      };
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `modern-outliner-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message || err}`);
    }
  };

  const handleImportLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        const validation = validateBackupData(parsed);
        if (!validation.isValid) {
          alert(`Invalid backup file structure:\n${validation.errors.join('\n')}`);
          return;
        }

        if (window.confirm(`Are you sure you want to restore these ${validation.nodes?.length} items? Your current tabs will be overwritten (a safety snapshot will be auto-created first).`)) {
          await importNodes(validation.nodes!);
          loadSnapshots();
          loadTree();
          
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: "FORCE_RECONCILE" }).catch(() => {});
          }
          alert("Backup restored successfully!");
        }
      } catch (err: any) {
        alert(`Failed to parse file: ${err.message || err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePushGitHub = async () => {
    if (!gitToken || !gitRepo || !gitPath) {
      setGitStatusMsg({ text: "Please fill in all GitHub settings first.", isError: true });
      return;
    }
    
    setIsGitLoading(true);
    setGitStatusMsg(null);
    try {
      const nodes = await getAllNodes();
      const backupData = {
        version: 1,
        exportedAt: Date.now(),
        nodeCount: nodes.length,
        nodes
      };
      
      await pushToGitHub(
        { token: gitToken, repo: gitRepo, path: gitPath },
        backupData
      );
      setGitStatusMsg({ text: "Successfully backed up to GitHub!", isError: false });
    } catch (err: any) {
      setGitStatusMsg({ text: err.message || "Failed to push to GitHub.", isError: true });
    } finally {
      setIsGitLoading(false);
    }
  };

  const handlePullGitHub = async () => {
    if (!gitToken || !gitRepo || !gitPath) {
      setGitStatusMsg({ text: "Please fill in all GitHub settings first.", isError: true });
      return;
    }

    setIsGitLoading(true);
    setGitStatusMsg(null);
    try {
      const backupData = await pullFromGitHub({ token: gitToken, repo: gitRepo, path: gitPath });
      
      const validation = validateBackupData(backupData);
      if (!validation.isValid) {
        setGitStatusMsg({ 
          text: `Invalid file format on GitHub:\n${validation.errors.join(', ')}`, 
          isError: true 
        });
        setIsGitLoading(false);
        return;
      }

      setIsGitLoading(false);
      if (window.confirm(`Found ${validation.nodes?.length} items in GitHub. Restore now? Current tabs will be overwritten (a safety snapshot will be auto-created first).`)) {
        setIsGitLoading(true);
        await importNodes(validation.nodes!);
        loadSnapshots();
        loadTree();
        
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ type: "FORCE_RECONCILE" }).catch(() => {});
        }
        setGitStatusMsg({ text: "Successfully pulled and restored from GitHub!", isError: false });
      }
    } catch (err: any) {
      setGitStatusMsg({ text: err.message || "Failed to pull from GitHub.", isError: true });
    } finally {
      setIsGitLoading(false);
    }
  };

  const loadSnapshots = async () => {
    try {
      const snaps = await getSnapshots();
      setSnapshots(snaps);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showSnapshots) loadSnapshots();
  }, [showSnapshots]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const flatList = useMemo(() => {
    const list: TreeNode[] = [];
    const flatten = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        list.push(n);
        if (n.children && n.children.length > 0) flatten(n.children);
      });
    };
    flatten(treeData);
    return list;
  }, [treeData]);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData;
    const q = searchQuery.toLowerCase();
    
    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const n of nodes) {
        const filteredChildren = filterNodes(n.children);
        const matches = n.title?.toLowerCase().includes(q) || n.url?.toLowerCase().includes(q);
        if (matches || filteredChildren.length > 0) {
          result.push({ ...n, children: filteredChildren });
        }
      }
      return result;
    };
    return filterNodes(treeData);
  }, [treeData, searchQuery]);

  const allNodeIds = useMemo(() => flatList.map(n => n.id), [flatList]);
  const isSearching = searchQuery.trim().length > 0;

  // All leaf tab nodes from the current filtered (search) results.
  const matchingTabs = useMemo(() => {
    const collect = (nodes: TreeNode[]): TreeNode[] =>
      nodes.flatMap(n => n.type === 'tab' ? [n] : collect(n.children));
    return collect(filteredTree);
  }, [filteredTree]);

  const addGroup = async () => {
    try {
      const now = Date.now();
      const newGroup: BaseNode = {
        id: `group-${generateId()}`,
        type: 'group',
        parentId: 'root',
        childIds: [],
        title: 'New Group',
        createdAt: now,
        updatedAt: now,
        sortOrder: 0
      };

      const nodes = await getAllNodes();
      const rootNode = nodes.find(n => n.id === 'root');
      if (rootNode) {
        rootNode.childIds.unshift(newGroup.id);
        await putNodes([newGroup, rootNode]);
      } else {
        await putNode(newGroup);
      }

      window.dispatchEvent(new CustomEvent('REFRESH_TREE'));
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Extract all matching search tabs into a new Chrome window.
   *   - Open tabs:  physically moved to the new window (old tab closed).
   *   - Saved tabs: re-parented in the outliner only, status stays 'saved'.
   * Originals are removed from their old parents in both cases.
   */
  const extractToNewWindow = async () => {
    if (matchingTabs.length === 0) return;
    try {
      const now = Date.now();
      const allFlatNodes = await getAllNodes();
      const nodeMap = new Map(allFlatNodes.map(n => [n.id, { ...n, childIds: [...n.childIds] }]));
      const label = searchQuery.trim();

      const openTabs  = matchingTabs.filter(t => t.status === 'open');
      const savedTabs = matchingTabs.filter(t => t.status !== 'open');

      // Create the new Chrome window with only the currently open tabs.
      // Saved tabs are logical outliner entries — they don't need a Chrome tab yet.
      const openUrls = openTabs.map(t => t.url || 'about:blank');
      const newWin = await chrome.windows.create({
        url: openUrls.length > 0 ? openUrls : undefined,
        focused: true
      });
      if (!newWin?.id) return;

      // New Window node in the outliner.
      const newWinNode: BaseNode = {
        id: `win-${newWin.id}-${generateId()}`,
        type: 'window',
        parentId: 'root',
        childIds: [],
        title: `Extracted: ${label}`,
        createdAt: now,
        updatedAt: now,
        sortOrder: 0,
        status: 'open',
        browserWindowId: newWin.id,
      };

      const toPersist: BaseNode[] = [newWinNode];
      const seen = new Set<string>(); // deduplicate old-parent updates

      const reParent = (tab: TreeNode, updatedProps: Partial<BaseNode>) => {
        const oldParentId = tab.parentId || 'root';
        const oldParent = nodeMap.get(oldParentId);
        if (oldParent && !seen.has(oldParentId)) {
          oldParent.childIds = oldParent.childIds.filter(id => id !== tab.id);
          toPersist.push(oldParent);
          seen.add(oldParentId);
        } else if (oldParent) {
          oldParent.childIds = oldParent.childIds.filter(id => id !== tab.id);
        }

        const updated: BaseNode = { ...tab, ...updatedProps, parentId: newWinNode.id, updatedAt: now };
        delete (updated as any).children;
        newWinNode.childIds.push(updated.id);
        toPersist.push(updated);
      };

      // Move open tabs physically → new window, close old tab.
      openTabs.forEach((tab, idx) => {
        const newChromeTabId = newWin.tabs?.[idx]?.id ?? tab.browserTabId;
        reParent(tab, { browserWindowId: newWin.id, browserTabId: newChromeTabId, status: 'open' });
        // Close the old physical tab; its new counterpart is already in newWin.
        if (tab.browserTabId) chrome.tabs.remove(tab.browserTabId).catch(() => {});
      });

      // Re-parent saved tabs (outliner only) — status stays 'saved'.
      savedTabs.forEach(tab => {
        reParent(tab, { browserWindowId: newWin.id, status: 'saved' });
      });

      // Register new window under root.
      const rootNode = nodeMap.get('root');
      if (rootNode) {
        rootNode.childIds.unshift(newWinNode.id);
        toPersist.push(rootNode);
      }

      await putNodes(toPersist);
      setSearchQuery('');
      window.dispatchEvent(new CustomEvent('REFRESH_TREE'));
    } catch (err) {
      console.error('Extract error:', err);
    }
  };


  const loadTree = useCallback(async () => {
    try {
      const flatNodes = await getAllNodes();
      const nodeMap = new Map<string, TreeNode>();

      flatNodes.forEach(node => {
        nodeMap.set(node.id, { ...node, children: [] });
      });

      let rootNodes: TreeNode[] = [];

      flatNodes.forEach(node => {
        const hydratedNode = nodeMap.get(node.id)!;
        if (node.id === "root" || node.parentId === null) {
          rootNodes.push(hydratedNode);
        } else {
          const parent = nodeMap.get(node.parentId);
          if (parent) {
            parent.children.push(hydratedNode);
          } else {
            rootNodes.push(hydratedNode);
          }
        }
      });

      nodeMap.forEach(node => {
        if (node.childIds) {
          node.children.sort((a, b) => {
            const idxA = node.childIds.indexOf(a.id);
            const idxB = node.childIds.indexOf(b.id);
            return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
          });
        }
      });

      const root = nodeMap.get("root");
      setTreeData(root?.children || rootNodes.filter(n => n.id !== "root"));
    } catch (e) {
      console.error("Failed to load tree", e);
    }
  }, []);

  useEffect(() => {
    loadTree();
    const refreshListener = () => loadTree();
    window.addEventListener('REFRESH_TREE', refreshListener);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const listener = (msg: any) => {
        if (msg.type === "TREE_UPDATED") loadTree();
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => {
        chrome.runtime.onMessage.removeListener(listener);
        window.removeEventListener('REFRESH_TREE', refreshListener);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return () => {
      window.removeEventListener('REFRESH_TREE', refreshListener);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeIndex = (active.data.current as any)?.sortable?.index ?? -1;
    const overIndex = (over.data.current as any)?.sortable?.index ?? -1;
    const draggingDown = activeIndex !== -1 && overIndex !== -1 && activeIndex < overIndex;

    try {
      const nodes = await getAllNodes();
      const nodeMap = new Map<string, BaseNode>(nodes.map(n => [n.id, { ...n, childIds: [...n.childIds] }]));
      const activeNode = nodeMap.get(active.id as string);
      const overNode = nodeMap.get(over.id as string);
      if (!activeNode || !overNode) return;

      const oldParentId = activeNode.parentId || 'root';
      const oldParent = nodeMap.get(oldParentId);
      const dropIntoContainer = overNode.type === 'group';
      const newParentId = dropIntoContainer ? overNode.id : (overNode.parentId || 'root');
      const newParent = nodeMap.get(newParentId);
      if (!newParent) return;

      const isSameParent = oldParentId === newParentId;
      let insertIndex = 0;

      if (dropIntoContainer) {
        if (oldParent) oldParent.childIds = oldParent.childIds.filter(id => id !== activeNode.id);
        insertIndex = 0;
      } else if (isSameParent) {
        oldParent!.childIds = oldParent!.childIds.filter(id => id !== activeNode.id);
        const overIdxAfter = newParent.childIds.indexOf(overNode.id);
        insertIndex = draggingDown ? (overIdxAfter + 1) : overIdxAfter;
      } else {
        if (oldParent) oldParent.childIds = oldParent.childIds.filter(id => id !== activeNode.id);
        const idx = newParent.childIds.indexOf(overNode.id);
        insertIndex = idx < 0 ? newParent.childIds.length : idx;
      }

      newParent.childIds.splice(insertIndex, 0, activeNode.id);
      activeNode.parentId = newParentId;

      const toPersist: BaseNode[] = [activeNode, newParent];
      if (oldParent && oldParent.id !== newParent.id) toPersist.push(oldParent);
      await putNodes(toPersist);

      // Auto-remove old window if it's now empty after cross-parent move
      if (!isSameParent && oldParent?.type === 'window' && oldParent.childIds.length === 0) {
        await removeNode(oldParent.id);
        if (oldParent.status === 'open' && oldParent.browserWindowId && typeof chrome !== 'undefined') {
          chrome.windows.remove(oldParent.browserWindowId).catch(() => {});
        }
      }

      // --- Physical Chrome Tab Synchronization ---
      // --- Physical Chrome Tab Synchronization (Recursive) ---
      const findEffectiveWindow = (startNode: BaseNode, map: Map<string, BaseNode>) => {
        let curr: BaseNode | undefined = startNode;
        while (curr) {
          if (curr.type === 'window' && curr.browserWindowId) return { winId: curr.browserWindowId, rootId: curr.id };
          curr = curr.parentId ? map.get(curr.parentId) : undefined;
        }
        return null;
      };

      const syncResult = findEffectiveWindow(newParent, nodeMap);

      if (syncResult) {
        const { winId: effectiveWindowId, rootId: rootAncestorId } = syncResult;
        
        // Find all open tabs in the branch we just moved
        const getOpenTabsInBranch = (id: string): BaseNode[] => {
          const n = nodeMap.get(id);
          if (!n) return [];
          if (n.type === 'tab') return n.status === 'open' ? [n] : [];
          return (n.childIds || []).flatMap(cid => getOpenTabsInBranch(cid));
        };

        const branchTabs = getOpenTabsInBranch(activeNode.id);
        
        if (branchTabs.length > 0) {
          // Calculate physical indices for each tab in the branch
          // Strategy: re-run the tree traversal for each tab based on its NEW position in the root window
          const windowNode = nodeMap.get(rootAncestorId);
          if (windowNode) {
            for (const movingTab of branchTabs) {
              if (!movingTab.browserTabId) continue;
              
              let physicalIndex = 0;
              let found = false;

              const traverse = (id: string) => {
                if (found) return;
                if (id === movingTab.id) {
                  found = true;
                  return;
                }
                const n = nodeMap.get(id);
                if (n?.type === 'tab' && n.status === 'open') physicalIndex++;
                if (n?.childIds) {
                  for (const cid of n.childIds) traverse(cid);
                }
              };

              for (const cid of windowNode.childIds || []) traverse(cid);

              if (found) {
                console.log(`[Sync] Moving tab ${movingTab.browserTabId} to window ${effectiveWindowId} at index ${physicalIndex}`);
                chrome.runtime.sendMessage({ 
                  type: "TAB_MOVED_UI", 
                  tabId: movingTab.browserTabId, 
                  windowId: effectiveWindowId, 
                  index: physicalIndex 
                }).catch(() => {});
              }
            }
          }
        }
      } else {
        console.warn(`[Sync] Drop target is not under any physical window. Not moving browser tabs.`);
      }

      window.dispatchEvent(new CustomEvent('REFRESH_TREE'));
    } catch (e) {
      console.error('DND error:', e);
    }
  };

  const activeTreeNode = useMemo(() => {
    const findNode = (nodes: TreeNode[], id: string): TreeNode | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const found = findNode(n.children, id);
        if (found) return found;
      }
      return undefined;
    };
    return activeId ? findNode(treeData, activeId) : undefined;
  }, [activeId, treeData]);

  return (
    <div className="outliner-container">
      <div className="search-container">
        <input
          id="search-input"
          type="text"
          className="search-input"
          placeholder="Search tabs, windows, groups... (Ctrl+F)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {isSearching && <button className="clear-search" title="Clear search" onClick={() => setSearchQuery('')}>×</button>}
        {isSearching && matchingTabs.length > 0 && (
          <button
            className="extract-btn"
            onClick={extractToNewWindow}
            title={`Extract ${matchingTabs.length} tab${matchingTabs.length !== 1 ? 's' : ''} to new window`}
          >
            🪟↗ {matchingTabs.length}
          </button>
        )}
      </div>

      <div className="session-root">
        <span className="root-icon">📁</span> {isSearching ? `Search Results (${allNodeIds.length})` : 'Current Session'}
        <button className="btn-icon add-group-btn" style={{marginRight: '8px', marginLeft: 'auto'}} onClick={() => setShowSnapshots(true)} title="Backup & Restore">💾</button>
        <button className="btn-icon add-group-btn" style={{marginLeft: 0}} onClick={addGroup} title="Add Group">📁+</button>
      </div>

      {showSnapshots && (
        <div className="modal-overlay" onClick={() => setShowSnapshots(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💾 Backup & Restore</h2>
              <button className="close-btn" onClick={() => setShowSnapshots(false)}>×</button>
            </div>
            <div className="modal-body">
              <button className="btn-primary full-width" onClick={async () => {
                await createSnapshot();
                loadSnapshots();
              }}>Save Current State</button>

              <div className="backup-section-title">Local File Sync</div>
              <div className="file-sync-buttons">
                <button className="btn-secondary" onClick={handleExportLocal}>
                  📤 Export JSON
                </button>
                <label className="btn-secondary" style={{ margin: 0, textAlign: 'center' }}>
                  📥 Import JSON
                  <input 
                    type="file" 
                    accept=".json" 
                    style={{ display: 'none' }} 
                    onChange={handleImportLocal} 
                  />
                </label>
              </div>

              <div className="github-sync-container">
                <div 
                  className="github-settings-toggle" 
                  onClick={() => {
                    setShowGitSettings(!showGitSettings);
                    setGitStatusMsg(null);
                  }}
                >
                  <span>☁️ GitHub Cloud Sync</span>
                  <span>{showGitSettings ? '▲' : '▼'}</span>
                </div>

                {showGitSettings && (
                  <div className="github-settings-fields">
                    <div className="github-input-group">
                      <label>Personal Access Token (PAT)</label>
                      <input 
                        type="password" 
                        className="github-input" 
                        placeholder="ghp_..." 
                        value={gitToken} 
                        onChange={(e) => {
                          setGitToken(e.target.value);
                          saveGitSettings(e.target.value, gitRepo, gitPath);
                        }}
                      />
                    </div>
                    <div className="github-input-group">
                      <label>GitHub Repository</label>
                      <input 
                        type="text" 
                        className="github-input" 
                        placeholder="owner/repo" 
                        value={gitRepo} 
                        onChange={(e) => {
                          setGitRepo(e.target.value);
                          saveGitSettings(gitToken, e.target.value, gitPath);
                        }}
                      />
                    </div>
                    <div className="github-input-group">
                      <label>File Path in Repo</label>
                      <input 
                        type="text" 
                        className="github-input" 
                        placeholder="tabs.json" 
                        value={gitPath} 
                        onChange={(e) => {
                          setGitPath(e.target.value);
                          saveGitSettings(gitToken, gitRepo, e.target.value);
                        }}
                      />
                    </div>

                    <div className="github-action-buttons">
                      <button 
                        className="btn-github" 
                        disabled={isGitLoading} 
                        onClick={handlePushGitHub}
                      >
                        {isGitLoading ? <div className="spinner" /> : '📤 Push'}
                      </button>
                      <button 
                        className="btn-github pull" 
                        disabled={isGitLoading} 
                        onClick={handlePullGitHub}
                      >
                        {isGitLoading ? <div className="spinner" /> : '📥 Pull'}
                      </button>
                    </div>
                  </div>
                )}

                {gitStatusMsg && (
                  <div className={`github-status ${gitStatusMsg.isError ? 'error' : 'success'}`}>
                    {gitStatusMsg.text}
                  </div>
                )}
              </div>

              <div className="backup-section-title">Local Snapshots</div>
              
              <div className="snapshot-list">
                {snapshots.length === 0 ? (
                  <div className="empty-state">No backups found.</div>
                ) : (
                  snapshots.map(snap => (
                    <div key={snap.id} className="snapshot-item">
                      <div className="snapshot-info">
                        <div className="snapshot-time">
                          {new Date(snap.createdAt).toLocaleString()} 
                          <span className="relative-time"> {timeAgo(snap.createdAt)}</span>
                        </div>
                        <div className="snapshot-count">{snap.nodeCount} items</div>
                      </div>
                      <div className="snapshot-actions">
                        <button className="btn-restore" onClick={async () => {
                          if (window.confirm("Restore this backup? Your current outliner structure will be entirely overwritten.")) {
                            await restoreSnapshot(snap.id);
                            setShowSnapshots(false);
                            window.dispatchEvent(new CustomEvent('REFRESH_TREE'));
                            if (typeof chrome !== 'undefined' && chrome.runtime) {
                              chrome.runtime.sendMessage({ type: "FORCE_RECONCILE" }).catch(() => {});
                            }
                          }
                        }}>Restore</button>
                        <button className="btn-delete" onClick={async () => {
                          if (window.confirm("Delete this backup?")) {
                            await deleteSnapshot(snap.id);
                            loadSnapshots();
                          }
                        }}>🗑️</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={allNodeIds} strategy={noopSortingStrategy}>
          {filteredTree.map(node => (
            <NodeItem key={node.id} node={node} depth={0} isDragActive={activeId !== null} forceExpand={isSearching} />
          ))}
        </SortableContext>

        <DragOverlay adjustScale={false} dropAnimation={null}>
          {activeTreeNode ? (
            <div className="drag-overlay-item">
              <TabIcon url={activeTreeNode.url} favIconUrl={activeTreeNode.favIconUrl} />
              <span>{activeTreeNode.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default App;
