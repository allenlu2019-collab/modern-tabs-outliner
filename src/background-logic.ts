import type { BaseNode } from "./types";
import { putNodes, getAllNodes, putNode, removeNode } from "./storage";
import { positionalWeave, calculateRestoreIndex, generateId } from "./utils";

let outlinerWindowId: number | null = null;
let pauseReconcile = false;
const intentionallySavedNodes = new Set<string>();

type OutlinerWindowMatch = {
  window: chrome.windows.Window;
  outlinerTabs: chrome.tabs.Tab[];
  hasOtherTabs: boolean;
};

function addPausedFlag(url?: string): string {
  const originalUrl = url || "about:blank";
  if (!originalUrl.startsWith('http')) return originalUrl;
  if (originalUrl.includes('#')) {
    return `${originalUrl}-outliner-paused`;
  }
  return `${originalUrl}#outliner-paused`;
}

function isOutlinerUrl(url: string | undefined, outlinerUrl: string): boolean {
  return url === outlinerUrl || url === `${outlinerUrl}/` || !!url?.startsWith(`${outlinerUrl}#`) || !!url?.startsWith(`${outlinerUrl}?`);
}

async function findOutlinerWindows(outlinerUrl: string): Promise<OutlinerWindowMatch[]> {
  const windows = await chrome.windows.getAll({ populate: true });
  return windows
    .map((window) => {
      const tabs = window.tabs || [];
      const outlinerTabs = tabs.filter((tab) => isOutlinerUrl(tab.url, outlinerUrl));
      return {
        window,
        outlinerTabs,
        hasOtherTabs: tabs.some((tab) => !isOutlinerUrl(tab.url, outlinerUrl)),
      };
    })
    .filter((match) => match.outlinerTabs.length > 0);
}

export async function openOutlinerWindow() {
  const outlinerUrl = chrome.runtime.getURL('index.html');
  const matches = await findOutlinerWindows(outlinerUrl);
  const primary = matches.find((match) => match.window.id === outlinerWindowId) || matches[0];

  if (primary?.window.id) {
    outlinerWindowId = primary.window.id;
    await chrome.windows.update(primary.window.id, { focused: true });

    const primaryTabId = primary.outlinerTabs[0]?.id;
    if (primaryTabId) {
      await chrome.tabs.update(primaryTabId, { active: true });
    }

    for (const duplicate of matches) {
      const duplicateWindowId = duplicate.window.id;
      if (
        duplicateWindowId &&
        duplicateWindowId !== primary.window.id &&
        duplicate.window.type === 'popup' &&
        !duplicate.hasOtherTabs
      ) {
        await chrome.windows.remove(duplicateWindowId);
      }
    }
    return;
  }

  outlinerWindowId = null;
  const win = await chrome.windows.create({
    url: outlinerUrl,
    type: 'popup',
    width: 420,
    height: 800,
    top: 50,
    left: 50,
    focused: true
  });

  if (win.id) {
    outlinerWindowId = win.id;
  }
}

export async function handleMessage(msg: any) {
  if (msg.type === "INTENTIONAL_SAVE") {
    intentionallySavedNodes.add(msg.nodeId);
    return;
  }
  if (msg.type === "RESTORE_NODE") {
    pauseReconcile = true;
    try {
      const nodes = await getAllNodes();
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const node = nodeMap.get(msg.nodeId);
      if (!node) throw new Error("Restoring node find failed");

      const openWindows = await chrome.windows.getAll();

      if (node.type === "window" || node.type === "group") {
        const getAllChildTabs = (n: BaseNode): BaseNode[] => {
            if (n.type === 'tab') return [n];
            if (!n.childIds) return [];
            return n.childIds.flatMap(id => {
                const child = nodeMap.get(id);
                return child ? getAllChildTabs(child) : [];
            });
        };
        const childTabs = getAllChildTabs(node);
        const urls = childTabs.map(t => addPausedFlag(t.url));
        
        // Target window detection for branch restoration
        let targetWindowId: number | undefined = undefined;
        if (node.type === "group") {
            // Find parent window in outliner
            let curr = node;
            while (curr && curr.parentId) {
                const p = nodeMap.get(curr.parentId);
                if (p?.type === 'window') {
                    const isWinOpen = openWindows.find(w => w.id === p.browserWindowId);
                    if (isWinOpen) targetWindowId = p.browserWindowId;
                    break;
                }
                curr = p!;
            }
        }

        if (targetWindowId) {
            // Restore into existing window
            for (const tNode of childTabs) {
                 if (tNode.status !== 'open') {
                    const restoreUrl = addPausedFlag(tNode.url);
                    const t = await chrome.tabs.create({ url: restoreUrl, windowId: targetWindowId });
                    tNode.browserTabId = t.id;
                    tNode.browserWindowId = t.windowId;
                    tNode.status = "open";
                    tNode.updatedAt = Date.now();
                    await putNode(tNode);
                 }
            }
        } else {
            // Create new window
            const win = await chrome.windows.create({ focused: true, url: urls.length > 0 ? urls : undefined });
            if (!win) {
              pauseReconcile = false;
              return;
            }
            if (node.type === 'window') {
                node.browserWindowId = win.id;
                node.status = "open";
            }
            
            const nodesToPut: BaseNode[] = [node];
            if (win.tabs) {
              win.tabs.forEach((t, i) => {
                const tabNode = childTabs[i];
                if (tabNode) {
                  tabNode.browserTabId = t.id;
                  tabNode.browserWindowId = win.id;
                  tabNode.status = "open";
                  tabNode.active = t.active;
                  tabNode.updatedAt = Date.now();
                  nodesToPut.push(tabNode);
                }
              });
            }
            await putNodes(nodesToPut);
        }
        
        pauseReconcile = false;
        requestReconcile();
        return;
      }

      // --- Tab Restoration Logic ---
      let targetWindowId = node.browserWindowId;
      let isWinOpen = openWindows.some(w => w.id === targetWindowId);

      // If specific window isn't open, search up for a window ancestor
      if (!isWinOpen && node.parentId) {
        let currId = node.parentId;
        while (currId) {
          const parent = nodeMap.get(currId);
          if (!parent) break;
          if (parent.type === "window") {
            const isParentOpen = openWindows.some(w => w.id === parent.browserWindowId);
            if (!isParentOpen) {
              const newWin = await chrome.windows.create({ focused: true });
              parent.browserWindowId = newWin.id;
              parent.status = "open";
              parent.updatedAt = Date.now();
              await putNode(parent);
              targetWindowId = newWin.id;
            } else {
              targetWindowId = parent.browserWindowId;
            }
            isWinOpen = true;
            break;
          }
          currId = parent.parentId!;
        }
      }

      if (!isWinOpen) {
        targetWindowId = openWindows.find(w => w.type === 'normal')?.id;
      }

      let calculatedIndex: number | undefined = undefined;
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent && parent.childIds) {
          calculatedIndex = calculateRestoreIndex(node.id, parent.childIds, nodeMap);
        }
      }

      const t = await chrome.tabs.create({ url: msg.url, windowId: targetWindowId, index: calculatedIndex, active: true });
      node.browserTabId = t.id;
      node.browserWindowId = t.windowId;
      node.status = "open";
      node.active = true;
      node.updatedAt = Date.now();
      await putNode(node);
      pauseReconcile = false;
      requestReconcile();
    } catch (err) {
      console.error(err);
      pauseReconcile = false;
      requestReconcile();
    }
    return;
  }

  if (msg.type === "TAB_MOVED_UI") {
    pauseReconcile = true;
    chrome.tabs.move(msg.tabId, { windowId: msg.windowId, index: msg.index }, () => {
       if (chrome.runtime.lastError) {
         console.warn(`[Outliner] chrome.tabs.move: ${chrome.runtime.lastError.message}`);
       }
       pauseReconcile = false;
       requestReconcile();
    });
    return;
  }

  if (msg.type === "FORCE_RECONCILE") {
    requestReconcile();
    return;
  }
}

export function initializeBackground() {
  chrome.runtime.onMessage.addListener((msg) => {
    handleMessage(msg);
    // Don't return true — handleMessage is fire-and-forget, no response needed.
  });

  chrome.action.onClicked.addListener(openOutlinerWindow);

  chrome.windows.onRemoved.addListener(async (windowId) => {
    if (windowId === outlinerWindowId) {
      outlinerWindowId = null;
    }
  });

  chrome.runtime.onInstalled.addListener(async (details) => {
    console.log("Extension installed and initialized. Reason:", details.reason);
    await reconcileTabs();
  });

  chrome.tabs.onCreated.addListener(requestReconcile);
  chrome.tabs.onRemoved.addListener(requestReconcile);
  chrome.tabs.onUpdated.addListener(requestReconcile);
  chrome.tabs.onActivated.addListener(requestReconcile);
  chrome.tabs.onMoved.addListener(requestReconcile);
  chrome.tabs.onAttached.addListener(requestReconcile);
  chrome.tabs.onDetached.addListener(requestReconcile);
  chrome.tabs.onReplaced.addListener(requestReconcile);
  chrome.windows.onCreated.addListener(requestReconcile);
  chrome.windows.onRemoved.addListener(requestReconcile);
  chrome.windows.onFocusChanged.addListener(requestReconcile);

  requestReconcile();
}

function broadcastUpdate() {
  chrome.runtime.sendMessage({ type: "TREE_UPDATED" }).catch(() => {});
}

async function reconcileTabs() {
  let windows = await chrome.windows.getAll({ populate: true });
  if (windows.some(w => !w.tabs)) {
      console.warn("[Outliner] Warning: chrome.windows.getAll returned windows without tabs. Skipping incomplete windows to prevent data loss.");
      windows = windows.filter(w => w.tabs);
  }
  const nodesToSave: BaseNode[] = [];
  const now = Date.now();

  const activeWindowIds = new Set(windows.map(w => w.id));
  const activeTabIds = new Set(windows.flatMap(w => w.tabs!.map(t => t.id)));

  const existingNodes = await getAllNodes();
  const nodeMap = new Map(existingNodes.map(n => [n.id, n]));

  // Clean up intentionallySavedNodes set to prevent memory leaks
  intentionallySavedNodes.forEach(id => {
    if (!nodeMap.has(id)) {
      intentionallySavedNodes.delete(id);
    }
  });

  const winByBrowserId = new Map(existingNodes.filter(n => n.type === 'window' && n.browserWindowId).map(n => [n.browserWindowId, n]));
  const tabByBrowserId = new Map(existingNodes.filter(n => n.type === 'tab' && n.browserTabId).map(n => [n.browserTabId, n]));

  // --- PASS 2: Heuristic Fallback Matching (for Chrome Restarts / Snapshot Restores) ---
  const fallbackDbWindows = existingNodes.filter(n => n.type === 'window' && n.status === 'open' && (!n.browserWindowId || !activeWindowIds.has(n.browserWindowId)));
  const fallbackDbTabs = existingNodes.filter(n => n.type === 'tab' && n.status === 'open' && (!n.browserTabId || !activeTabIds.has(n.browserTabId)));

  const isDescendant = (node: BaseNode, ancestorId: string): boolean => {
      let curr: BaseNode | undefined = node;
      while (curr) {
          if (curr.id === ancestorId) return true;
          curr = curr.parentId ? nodeMap.get(curr.parentId) : undefined;
      }
      return false;
  };

  for (const w of windows) {
      if (w.id === outlinerWindowId) continue;
      
      let winNode = winByBrowserId.get(w.id);
      if (!winNode) {
          // Heuristic Window Match
          let bestMatchWin: BaseNode | undefined;
          let maxScore = 0;
          for (const fWin of fallbackDbWindows) {
              const getWinTabs = (nodeId: string): BaseNode[] => {
                  const n = nodeMap.get(nodeId);
                  if (!n) return [];
                  if (n.type === 'tab') return [n];
                  return (n.childIds || []).flatMap(getWinTabs);
              };
              const fWinTabs = getWinTabs(fWin.id);
              const fWinUrls = new Set(fWinTabs.map(t => t.url).filter(u => u && u !== 'about:blank' && !u.startsWith('chrome://newtab')));
              
              let score = 0;
              for (const t of (w.tabs || [])) {
                  if (t.url && fWinUrls.has(t.url)) score++;
              }
              if (score > maxScore) {
                  maxScore = score;
                  bestMatchWin = fWin;
              }
          }
          
          const validUrlsCount = (w.tabs || []).filter(t => t.url && t.url !== 'about:blank' && !t.url.startsWith('chrome://newtab')).length;
          if (bestMatchWin && maxScore > 0 && (maxScore >= 2 || maxScore === validUrlsCount)) {
              winNode = bestMatchWin;
              winNode.browserWindowId = w.id; // Link it
              winByBrowserId.set(w.id, winNode);
              fallbackDbWindows.splice(fallbackDbWindows.indexOf(bestMatchWin), 1);
          }
      }

      for (const t of (w.tabs || [])) {
          let tabNode = tabByBrowserId.get(t.id);
          if (!tabNode) {
              const validUrl = t.url && t.url !== 'about:blank' && !t.url.startsWith('chrome://newtab');
              if (validUrl) {
                  let matchIdx = -1;
                  if (winNode) {
                     matchIdx = fallbackDbTabs.findIndex(n => n.url === t.url && n.status === 'open' && isDescendant(n, winNode.id));
                     if (matchIdx === -1) matchIdx = fallbackDbTabs.findIndex(n => n.url === t.url && isDescendant(n, winNode.id));
                  }
                  if (matchIdx === -1) matchIdx = fallbackDbTabs.findIndex(n => n.url === t.url && n.status === 'open');
                  if (matchIdx === -1) matchIdx = fallbackDbTabs.findIndex(n => n.url === t.url);
                  
                  if (matchIdx !== -1) {
                      tabNode = fallbackDbTabs[matchIdx];
                      tabNode.browserTabId = t.id; // Link it
                      tabByBrowserId.set(t.id, tabNode);
                      fallbackDbTabs.splice(matchIdx, 1);
                  }
              }
          }
      }
  }
  // --- END PASS 2 ---

  const nodesToRemove = new Set<string>();
  
  for (const node of existingNodes) {
    if (node.status === "open") {
      if (node.type === "window" && node.browserWindowId && !activeWindowIds.has(node.browserWindowId)) {
        if (intentionallySavedNodes.has(node.id)) {
          node.status = "saved";
          nodesToSave.push(node);
          intentionallySavedNodes.delete(node.id);
        } else {
          const childrenIds = node.childIds || [];
          const hasAnyChildren = childrenIds.some(id => nodeMap.has(id) && !nodesToRemove.has(id));
          if (!hasAnyChildren) {
            nodesToRemove.add(node.id);
          } else {
            node.status = "saved";
            nodesToSave.push(node);
          }
        }
      } else if (node.type === "tab" && node.browserTabId && !activeTabIds.has(node.browserTabId)) {
        if (intentionallySavedNodes.has(node.id)) {
           node.status = "saved";
           node.active = false;
           nodesToSave.push(node);
           intentionallySavedNodes.delete(node.id);
        } else {
           nodesToRemove.add(node.id);
        }
      }
    }
  }

  // Track which window IDs the reconciler knows about, to update root.childIds.
  const reconciledWindowIds: string[] = [];

  for (const w of windows) {
    if (w.id === outlinerWindowId) continue;

    let winNode = winByBrowserId.get(w.id);
    if (!winNode) {
      winNode = {
        id: `win-${w.id}`,
        type: "window",
        parentId: "root",
        childIds: [],
        createdAt: now,
        updatedAt: now,
        sortOrder: 0,
        status: "open",
        browserWindowId: w.id,
        title: "Window"
      };
    } else {
      winNode.status = "open";
      winNode.updatedAt = now;
      if (!winNode.childIds) winNode.childIds = [];
    }
    reconciledWindowIds.push(winNode.id);
    
    const tabsInThisWindow: string[] = [];
    
    for (const t of (w.tabs || [])) {
      let tabNode = tabByBrowserId.get(t.id);
      
      if (!tabNode) {
        tabNode = {
          id: `tab-${t.id}-${generateId()}`,
          type: "tab",
          parentId: winNode.id,
          childIds: [],
          title: t.title || "New Tab",
          url: t.url,
          favIconUrl: t.favIconUrl,
          createdAt: now,
          updatedAt: now,
          sortOrder: t.index,
          status: "open",
          browserTabId: t.id,
          browserWindowId: w.id,
          active: t.active
        };
      } else {
        tabNode.status = "open";
        
        const isLoadingPlaceholder = t.status === 'loading' && (!t.title || t.title === 'New Tab' || t.title === t.url);
        if (!isLoadingPlaceholder) {
            tabNode.title = t.title || tabNode.title;
            tabNode.favIconUrl = t.favIconUrl || tabNode.favIconUrl;
        }
        const isValidUrl = t.url && t.url !== 'about:blank' && !t.url.startsWith('chrome://newtab');
        if (isValidUrl) {
          tabNode.url = t.url;
        }
        tabNode.updatedAt = now;
        tabNode.active = t.active;
        tabNode.browserWindowId = w.id;

        // VIRTUAL PARENTING: Preserve a group parent if the tab was placed in one.
        const parentNode = nodeMap.get(tabNode.parentId ?? '');
        if (parentNode?.type !== 'group') {
          tabNode.parentId = winNode.id;
        }
      }
      
      // Only direct window children participate in the window's childIds order.
      if (tabNode.parentId === winNode.id) {
        tabsInThisWindow.push(tabNode.id);
      }
      nodesToSave.push(tabNode);
    }
    
    // Positional Weave: merge live tab order into the saved outliner order.
    // Groups inside the window are preserved because they are not in tabsInThisWindow,
    // so positionalWeave treats them as "saved" IDs and keeps them in place.
    winNode.childIds = positionalWeave(winNode.childIds || [], tabsInThisWindow, nodesToRemove);
    nodesToSave.push(winNode);

  }

  const rootNode = nodeMap.get("root");
  if (rootNode) {
    const newChildIds = rootNode.childIds.filter(id => !nodesToRemove.has(id));
    for (const wid of reconciledWindowIds) {
      if (!newChildIds.includes(wid)) newChildIds.push(wid);
    }
    if (newChildIds.join(',') !== rootNode.childIds.join(',')) {
      rootNode.childIds = newChildIds;
      nodesToSave.push(rootNode);
    }
  } else {
    nodesToSave.push({
      id: "root",
      type: "workspace",
      parentId: null,
      childIds: windows.filter(w => w.id !== outlinerWindowId).map(w => `win-${w.id}`),
      createdAt: now,
      updatedAt: now,
      sortOrder: 0
    });
  }

  const uniqueNodesToSave = new Map(nodesToSave.map(n => [n.id, n]));

  // --- DATABASE INTEGRITY CLEANUP ---
  const finalNodeIds = new Set<string>();
  nodeMap.forEach((_node, id) => {
    if (!nodesToRemove.has(id)) finalNodeIds.add(id);
  });
  uniqueNodesToSave.forEach((node) => {
    if (!nodesToRemove.has(node.id)) finalNodeIds.add(node.id);
  });

  const allWorkingNodes = new Map<string, BaseNode>();
  nodeMap.forEach((node, id) => {
    if (!nodesToRemove.has(id)) allWorkingNodes.set(id, { ...node });
  });
  uniqueNodesToSave.forEach((node) => {
    if (!nodesToRemove.has(node.id)) allWorkingNodes.set(node.id, node);
  });

  // Ensure root exists in working nodes
  if (!allWorkingNodes.has("root")) {
    allWorkingNodes.set("root", {
      id: "root",
      type: "workspace",
      parentId: null,
      childIds: [],
      createdAt: now,
      updatedAt: now,
      sortOrder: 0
    });
    finalNodeIds.add("root");
    uniqueNodesToSave.set("root", allWorkingNodes.get("root")!);
  }

  // Pass 1: Child-to-Parent Alignment (Validate parentId and ensure parent lists the child)
  allWorkingNodes.forEach((node) => {
    if (node.id === "root") return;

    // Check if parent exists
    const hasParent = node.parentId && finalNodeIds.has(node.parentId);
    if (!hasParent) {
      node.parentId = "root";
      node.updatedAt = now;
      uniqueNodesToSave.set(node.id, node);
    }

    // Ensure parent's childIds contains this node
    const parentNode = allWorkingNodes.get(node.parentId!);
    if (parentNode) {
      if (!parentNode.childIds.includes(node.id)) {
        parentNode.childIds.push(node.id);
        parentNode.updatedAt = now;
        uniqueNodesToSave.set(parentNode.id, parentNode);
      }
    }
  });

  // Pass 2: Parent-to-Child Clean up (Filter child lists based on existence and correct parentId)
  allWorkingNodes.forEach((node) => {
    if (node.childIds && node.childIds.length > 0) {
      const originalCount = node.childIds.length;
      
      const cleanChildIds = node.childIds.filter((cid) => {
        const child = allWorkingNodes.get(cid);
        // Only keep if the child exists and points back to this parent node
        return child && child.parentId === node.id;
      });

      if (cleanChildIds.length !== originalCount) {
        node.childIds = cleanChildIds;
        node.updatedAt = now;
        uniqueNodesToSave.set(node.id, node);
      }
    }
  });

  if (uniqueNodesToSave.size > 0) {
     await putNodes(Array.from(uniqueNodesToSave.values()));
  }
  
  if (nodesToRemove.size > 0) {
     for (const dyingId of nodesToRemove) {
        await removeNode(dyingId);
     }
  }

  broadcastUpdate();
}

let isReconciling = false;
let pendingReconcile = false;

async function safeReconcile() {
  if (pauseReconcile) return;
  if (isReconciling) {
    pendingReconcile = true;
    return;
  }
  
  isReconciling = true;
  try {
    await reconcileTabs();
  } finally {
    isReconciling = false;
    if (pendingReconcile) {
      pendingReconcile = false;
      safeReconcile();
    }
  }
}

let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
function requestReconcile() {
  if (reconcileTimer) clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(() => {
    safeReconcile();
  }, 250);
}
