import type { BaseNode } from "./types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  nodes: BaseNode[] | null;
}

/**
 * Validates the structure and parent-child references of imported outliner tab data.
 */
export function validateBackupData(data: any): ValidationResult {
  const errors: string[] = [];
  let nodes: any = null;

  if (!data) {
    return { isValid: false, errors: ["Imported data is empty or null"], nodes: null };
  }

  // 1. Support both wrapper format and raw array format
  if (Array.isArray(data)) {
    nodes = data;
  } else if (typeof data === "object") {
    if (!data.nodes) {
      errors.push("Missing 'nodes' property in backup object");
    } else if (!Array.isArray(data.nodes)) {
      errors.push("'nodes' property must be an array");
    } else {
      nodes = data.nodes;
    }
  } else {
    return { isValid: false, errors: ["Invalid backup data format. Expected an array or object."], nodes: null };
  }

  if (errors.length > 0 || !nodes) {
    return { isValid: false, errors, nodes: null };
  }

  // 2. Validate basic node properties
  const validNodeTypes = ["workspace", "window", "tab", "group", "separator"];
  const nodeMap = new Map<string, any>();

  nodes.forEach((node: any, index: number) => {
    if (typeof node !== "object" || node === null) {
      errors.push(`Item at index ${index} is not a valid object`);
      return;
    }

    if (typeof node.id !== "string" || !node.id) {
      errors.push(`Item at index ${index} is missing a valid string 'id'`);
      return;
    }

    if (nodeMap.has(node.id)) {
      errors.push(`Duplicate node ID detected: "${node.id}"`);
    }
    nodeMap.set(node.id, node);

    if (!validNodeTypes.includes(node.type)) {
      errors.push(`Node "${node.id}" has an invalid type: "${node.type}"`);
    }

    if (node.parentId !== null && typeof node.parentId !== "string") {
      errors.push(`Node "${node.id}" parentId must be a string or null`);
    }

    if (!Array.isArray(node.childIds)) {
      errors.push(`Node "${node.id}" childIds must be an array`);
    } else {
      node.childIds.forEach((cid: any, cidx: number) => {
        if (typeof cid !== "string") {
          errors.push(`Node "${node.id}" childId at index ${cidx} is not a string`);
        }
      });
    }
  });

  if (errors.length > 0) {
    return { isValid: false, errors, nodes: null };
  }

  // 3. Validate tree structure integrity (root node existence, parent/child references)
  if (!nodeMap.has("root")) {
    errors.push("Missing required root workspace node (id: 'root')");
  }

  nodeMap.forEach((node) => {
    // Check that all childIds exist in the database and reference back to the parent
    node.childIds.forEach((childId: string) => {
      const child = nodeMap.get(childId);
      if (!child) {
        errors.push(`Node "${node.id}" references child "${childId}" which does not exist in the backup`);
      } else if (child.parentId !== node.id) {
        errors.push(`Mismatched parenting: Node "${node.id}" has child "${childId}", but child's parentId is "${child.parentId}"`);
      }
    });

    // Check that parentId exists (except for root which has null parentId)
    if (node.id !== "root") {
      if (!node.parentId) {
        errors.push(`Non-root node "${node.id}" has no parentId`);
      } else {
        const parent = nodeMap.get(node.parentId);
        if (!parent) {
          errors.push(`Node "${node.id}" parentId points to "${node.parentId}" which does not exist`);
        } else if (!parent.childIds.includes(node.id)) {
          errors.push(`Mismatched parenting: Node "${node.id}" points to parent "${node.parentId}", but parent does not list it in childIds`);
        }
      }
    } else {
      if (node.parentId !== null) {
        errors.push("Root node parentId must be null");
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    nodes: errors.length === 0 ? (nodes as BaseNode[]) : null,
  };
}
