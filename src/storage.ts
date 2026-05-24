import type { BaseNode, Snapshot } from "./types";

const DB_NAME = "tab-session-manager";
const DB_VERSION = 2;
const STORE_NAME = "nodes";
const SNAPSHOT_STORE = "snapshots";

// Cache the connection promise so we don't open a new IDB handle per call.
let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => { dbPromise = null; reject(request.error); };
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("parentId", "parentId", { unique: false });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("status", "status", { unique: false });
        }
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE, { keyPath: "id" });
        }
      };
    });
  }
  return dbPromise;
}

export async function putNode(node: BaseNode): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(node);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putNodes(nodes: BaseNode[]): Promise<void> {
  if (nodes.length === 0) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    nodes.forEach(node => store.put(node));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllNodes(): Promise<BaseNode[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeNode(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Recursively removes a node and all of its descendants from storage.
 * Use this instead of removeNode whenever deleting containers (windows, groups).
 */
export async function removeSubtree(rootId: string): Promise<void> {
  const allNodes = await getAllNodes();
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  const idsToDelete: string[] = [];
  const collect = (id: string) => {
    const node = nodeMap.get(id);
    if (!node) return;
    idsToDelete.push(id);
    for (const childId of node.childIds || []) {
      collect(childId);
    }
  };
  collect(rootId);

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    idsToDelete.forEach(id => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllNodes(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => { dbPromise = null; resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

// --- Snapshot Features ---

export async function createSnapshot(): Promise<Snapshot> {
  const nodes = await getAllNodes();
  const db = await getDB();
  const now = Date.now();
  const snapshot: Snapshot = {
    id: now,
    createdAt: now,
    nodeCount: nodes.length,
    nodes
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
    tx.objectStore(SNAPSHOT_STORE).put(snapshot);
    tx.oncomplete = () => resolve(snapshot);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSnapshots(): Promise<Omit<Snapshot, 'nodes'>[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, "readonly");
    const request = tx.objectStore(SNAPSHOT_STORE).getAll();
    request.onsuccess = () => {
      // Map out the massive nodes array to keep UI memory footprint low
      const metadata = request.result.map(snap => ({
        id: snap.id,
        createdAt: snap.createdAt,
        nodeCount: snap.nodeCount
      }));
      resolve(metadata.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function restoreSnapshot(id: number): Promise<void> {
  const db = await getDB();
  const snapshot: Snapshot = await new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, "readonly");
    const request = tx.objectStore(SNAPSHOT_STORE).get(id);
    request.onsuccess = () => {
      if (request.result) resolve(request.result);
      else reject(new Error("Snapshot not found"));
    };
    request.onerror = () => reject(tx.error);
  });

  // Clear existing nodes and put the snapshot nodes
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  await putNodes(snapshot.nodes);
}

export async function deleteSnapshot(id: number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
    tx.objectStore(SNAPSHOT_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function importNodes(nodes: BaseNode[]): Promise<void> {
  // 1. Create a safety backup snapshot of the current state before overwriting
  try {
    await createSnapshot();
  } catch (err) {
    console.warn("Failed to create pre-import backup snapshot:", err);
  }

  // 2. Sanitize nodes for cross-session/cross-browser portability
  const sanitizedNodes = nodes.map(node => {
    const sanitized = { ...node };
    if (sanitized.status === "open") {
      sanitized.status = "saved";
    }
    delete sanitized.browserTabId;
    delete sanitized.browserWindowId;
    if (sanitized.active) {
      sanitized.active = false;
    }
    return sanitized;
  });

  // 3. Clear existing store and put the sanitized nodes
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  await putNodes(sanitizedNodes);
}
