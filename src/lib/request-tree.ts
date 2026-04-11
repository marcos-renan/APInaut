import type {
  ApiRequest,
  RequestTreeFolderNode,
  RequestTreeNode,
} from "@/lib/collections";

export const hasRequestInTree = (tree: RequestTreeNode[], requestId: string | null): boolean => {
  if (!requestId) {
    return false;
  }

  for (const node of tree) {
    if (node.type === "request") {
      if (node.id === requestId) {
        return true;
      }
      continue;
    }

    if (hasRequestInTree(node.children, requestId)) {
      return true;
    }
  }

  return false;
};

export const findFolderPathForRequest = (
  tree: RequestTreeNode[],
  requestId: string,
  trail: string[] = [],
): string[] | null => {
  for (const node of tree) {
    if (node.type === "request") {
      if (node.id === requestId) {
        return trail;
      }
      continue;
    }

    const nested = findFolderPathForRequest(node.children, requestId, [...trail, node.id]);

    if (nested) {
      return nested;
    }
  }

  return null;
};

export const findRequestById = (tree: RequestTreeNode[], requestId: string | null): ApiRequest | null => {
  if (!requestId) {
    return null;
  }

  for (const node of tree) {
    if (node.type === "request") {
      if (node.id === requestId) {
        return node.request;
      }
      continue;
    }

    const nested = findRequestById(node.children, requestId);

    if (nested) {
      return nested;
    }
  }

  return null;
};

export const findNodeById = (tree: RequestTreeNode[], nodeId: string | null): RequestTreeNode | null => {
  if (!nodeId) {
    return null;
  }

  for (const node of tree) {
    if (node.id === nodeId) {
      return node;
    }

    if (node.type === "folder") {
      const nested = findNodeById(node.children, nodeId);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
};

export const updateRequestInTree = (
  tree: RequestTreeNode[],
  requestId: string,
  updater: (request: ApiRequest) => ApiRequest,
): RequestTreeNode[] =>
  tree.map((node) => {
    if (node.type === "request") {
      if (node.id !== requestId) {
        return node;
      }

      const nextRequest = updater(node.request);

      return {
        ...node,
        id: nextRequest.id,
        request: nextRequest,
      };
    }

    return {
      ...node,
      children: updateRequestInTree(node.children, requestId, updater),
    };
  });

export const updateFolderInTree = (
  tree: RequestTreeNode[],
  folderId: string,
  updater: (folder: RequestTreeFolderNode) => RequestTreeFolderNode,
): RequestTreeNode[] =>
  tree.map((node) => {
    if (node.type !== "folder") {
      return node;
    }

    if (node.id === folderId) {
      return updater(node);
    }

    return {
      ...node,
      children: updateFolderInTree(node.children, folderId, updater),
    };
  });

export const removeNodeById = (
  tree: RequestTreeNode[],
  nodeId: string,
): { tree: RequestTreeNode[]; removed: RequestTreeNode | null } => {
  let removed: RequestTreeNode | null = null;

  const nextTree = tree.reduce<RequestTreeNode[]>((accumulator, node) => {
    if (node.id === nodeId) {
      removed = node;
      return accumulator;
    }

    if (node.type === "folder") {
      const nested = removeNodeById(node.children, nodeId);

      if (nested.removed) {
        removed = nested.removed;

        accumulator.push({
          ...node,
          children: nested.tree,
        });

        return accumulator;
      }
    }

    accumulator.push(node);
    return accumulator;
  }, []);

  return {
    tree: nextTree,
    removed,
  };
};

export const insertIntoFolderById = (
  tree: RequestTreeNode[],
  folderId: string,
  nodeToInsert: RequestTreeNode,
): { tree: RequestTreeNode[]; inserted: boolean } => {
  let inserted = false;

  const nextTree = tree.map((node) => {
    if (node.type !== "folder") {
      return node;
    }

    if (node.id === folderId) {
      inserted = true;
      return {
        ...node,
        children: [...node.children, nodeToInsert],
      };
    }

    const nested = insertIntoFolderById(node.children, folderId, nodeToInsert);

    if (nested.inserted) {
      inserted = true;
      return {
        ...node,
        children: nested.tree,
      };
    }

    return node;
  });

  return {
    tree: nextTree,
    inserted,
  };
};

export const nodeContainsNodeId = (node: RequestTreeNode, targetNodeId: string): boolean => {
  if (node.id === targetNodeId) {
    return true;
  }

  if (node.type !== "folder") {
    return false;
  }

  return node.children.some((child) => nodeContainsNodeId(child, targetNodeId));
};

const findNodeLocation = (
  tree: RequestTreeNode[],
  nodeId: string,
  parentFolderId: string | null = null,
): { parentFolderId: string | null; index: number } | null => {
  for (let index = 0; index < tree.length; index += 1) {
    const node = tree[index];

    if (node.id === nodeId) {
      return {
        parentFolderId,
        index,
      };
    }

    if (node.type === "folder") {
      const nested = findNodeLocation(node.children, nodeId, node.id);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
};

const getChildrenCountAtParent = (tree: RequestTreeNode[], parentFolderId: string | null) => {
  if (parentFolderId === null) {
    return tree.length;
  }

  const parentNode = findNodeById(tree, parentFolderId);

  if (!parentNode || parentNode.type !== "folder") {
    return null;
  }

  return parentNode.children.length;
};

const insertIntoParentAtIndex = (
  tree: RequestTreeNode[],
  parentFolderId: string | null,
  index: number,
  nodeToInsert: RequestTreeNode,
): { tree: RequestTreeNode[]; inserted: boolean } => {
  if (parentFolderId === null) {
    const normalizedIndex = Math.max(0, Math.min(index, tree.length));
    return {
      tree: [
        ...tree.slice(0, normalizedIndex),
        nodeToInsert,
        ...tree.slice(normalizedIndex),
      ],
      inserted: true,
    };
  }

  let inserted = false;

  const nextTree = tree.map((node) => {
    if (node.type !== "folder") {
      return node;
    }

    if (node.id === parentFolderId) {
      const normalizedIndex = Math.max(0, Math.min(index, node.children.length));
      inserted = true;

      return {
        ...node,
        children: [
          ...node.children.slice(0, normalizedIndex),
          nodeToInsert,
          ...node.children.slice(normalizedIndex),
        ],
      };
    }

    const nested = insertIntoParentAtIndex(node.children, parentFolderId, index, nodeToInsert);

    if (nested.inserted) {
      inserted = true;
      return {
        ...node,
        children: nested.tree,
      };
    }

    return node;
  });

  return {
    tree: nextTree,
    inserted,
  };
};

export const moveNodeToPosition = (
  tree: RequestTreeNode[],
  sourceNodeId: string,
  targetParentFolderId: string | null,
  targetIndex: number,
): RequestTreeNode[] => {
  const sourceLocation = findNodeLocation(tree, sourceNodeId);
  const removedSource = removeNodeById(tree, sourceNodeId);

  if (!removedSource.removed || !sourceLocation) {
    return tree;
  }

  const movingNode = removedSource.removed;

  if (targetParentFolderId && nodeContainsNodeId(movingNode, targetParentFolderId)) {
    return tree;
  }

  const targetChildrenCount = getChildrenCountAtParent(removedSource.tree, targetParentFolderId);

  if (targetChildrenCount === null) {
    return tree;
  }

  let normalizedTargetIndex = Math.max(0, Math.min(targetIndex, targetChildrenCount));

  if (
    sourceLocation.parentFolderId === targetParentFolderId &&
    sourceLocation.index < normalizedTargetIndex
  ) {
    normalizedTargetIndex -= 1;
  }

  if (
    sourceLocation.parentFolderId === targetParentFolderId &&
    sourceLocation.index === normalizedTargetIndex
  ) {
    return tree;
  }

  const inserted = insertIntoParentAtIndex(
    removedSource.tree,
    targetParentFolderId,
    normalizedTargetIndex,
    movingNode,
  );

  if (!inserted.inserted) {
    return tree;
  }

  return inserted.tree;
};

export const moveNodeToTarget = (
  tree: RequestTreeNode[],
  sourceNodeId: string,
  targetFolderId: string | null,
): RequestTreeNode[] => {
  if (targetFolderId === null) {
    return moveNodeToPosition(tree, sourceNodeId, null, Number.MAX_SAFE_INTEGER);
  }

  return moveNodeToPosition(tree, sourceNodeId, targetFolderId, Number.MAX_SAFE_INTEGER);
};

export const reorderNodeWithinParent = (
  tree: RequestTreeNode[],
  nodeId: string,
  direction: "up" | "down",
): RequestTreeNode[] => {
  const location = findNodeLocation(tree, nodeId);

  if (!location) {
    return tree;
  }

  const reorderSiblings = (siblings: RequestTreeNode[]) => {
    const index = siblings.findIndex((node) => node.id === nodeId);

    if (index < 0) {
      return siblings;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= siblings.length) {
      return siblings;
    }

    const next = [...siblings];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    return next;
  };

  if (location.parentFolderId === null) {
    return reorderSiblings(tree);
  }

  const reorderInFolder = (nodes: RequestTreeNode[]): RequestTreeNode[] =>
    nodes.map((node) => {
      if (node.type !== "folder") {
        return node;
      }

      if (node.id === location.parentFolderId) {
        return {
          ...node,
          children: reorderSiblings(node.children),
        };
      }

      return {
        ...node,
        children: reorderInFolder(node.children),
      };
    });

  return reorderInFolder(tree);
};
