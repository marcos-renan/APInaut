import { PointerSensor } from "@dnd-kit/core";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { RequestTreeNode } from "@/lib/collections";
import { findNodeById, nodeContainsNodeId } from "@/lib/request-tree";

import type { DropTarget } from "@/components/request-tree-panel.types";

export const REQUEST_LIST_INDENT = 16;
const ROOT_PARENT_TOKEN = "__root__";
const POSITION_PREFIX = "position:";
const FOLDER_PREFIX = "folder:";
const DOUBLE_CLICK_SELECTION_INTERVAL_MS = 320;
const DOUBLE_CLICK_SELECTION_MAX_DISTANCE = 24;

export {
  DOUBLE_CLICK_SELECTION_INTERVAL_MS,
  DOUBLE_CLICK_SELECTION_MAX_DISTANCE,
  ROOT_PARENT_TOKEN,
};

export class ShiftAwarePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: ReactPointerEvent<Element>) =>
        nativeEvent.isPrimary && nativeEvent.button === 0 && !nativeEvent.shiftKey,
    },
  ];
}

export const flattenNodeIdsInRenderOrder = (nodes: RequestTreeNode[]): string[] => {
  const ids: string[] = [];

  const walk = (items: RequestTreeNode[]) => {
    items.forEach((node) => {
      ids.push(node.id);

      if (node.type === "folder") {
        walk(node.children);
      }
    });
  };

  walk(nodes);
  return ids;
};

export const getTopLevelSelectionForMove = (
  tree: RequestTreeNode[],
  selectedNodeIds: string[],
): string[] => {
  if (selectedNodeIds.length <= 1) {
    return selectedNodeIds;
  }

  const selectedSet = new Set(selectedNodeIds);
  const selectedFolders = selectedNodeIds
    .map((nodeId) => findNodeById(tree, nodeId))
    .filter((node): node is Extract<RequestTreeNode, { type: "folder" }> => node?.type === "folder");

  return selectedNodeIds.filter((nodeId) => {
    for (const folderNode of selectedFolders) {
      if (folderNode.id === nodeId) {
        continue;
      }

      if (selectedSet.has(folderNode.id) && nodeContainsNodeId(folderNode, nodeId)) {
        return false;
      }
    }

    return true;
  });
};

export const createPositionDropId = (parentFolderId: string | null, index: number): string => {
  const parentToken = encodeURIComponent(parentFolderId ?? ROOT_PARENT_TOKEN);
  return `${POSITION_PREFIX}${parentToken}:${index}`;
};

export const createFolderDropId = (folderId: string): string =>
  `${FOLDER_PREFIX}${encodeURIComponent(folderId)}`;

export const haveSameNodeSelection = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((nodeId) => rightSet.has(nodeId));
};

export const parseDropTargetId = (dropId: string): DropTarget | null => {
  if (dropId.startsWith(FOLDER_PREFIX)) {
    const encodedFolderId = dropId.slice(FOLDER_PREFIX.length);
    const folderId = decodeURIComponent(encodedFolderId);

    if (!folderId) {
      return null;
    }

    return {
      type: "folder",
      targetFolderId: folderId,
    };
  }

  if (!dropId.startsWith(POSITION_PREFIX)) {
    return null;
  }

  const payload = dropId.slice(POSITION_PREFIX.length);
  const separatorIndex = payload.lastIndexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  const encodedParentToken = payload.slice(0, separatorIndex);
  const indexText = payload.slice(separatorIndex + 1);
  const targetIndex = Number.parseInt(indexText, 10);

  if (!Number.isFinite(targetIndex)) {
    return null;
  }

  const decodedParentToken = decodeURIComponent(encodedParentToken);

  return {
    type: "position",
    targetParentFolderId: decodedParentToken === ROOT_PARENT_TOKEN ? null : decodedParentToken,
    targetIndex,
  };
};