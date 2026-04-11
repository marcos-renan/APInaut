"use client";

import { useEffect, useRef, useState, type Dispatch, type DragEvent as ReactDragEvent, type SetStateAction } from "react";

import type { RequestTreeNode } from "@/lib/collections";
import { moveNodeToPosition, moveNodeToTarget } from "@/lib/request-tree";

export type DragDropTarget =
  | { type: "root" }
  | { type: "folder"; folderId: string }
  | { type: "position"; parentFolderId: string | null; index: number }
  | null;

type UseRequestDnDParams = {
  updateCollectionTree: (updater: (tree: RequestTreeNode[]) => RequestTreeNode[]) => void;
  setExpandedFolderIds: Dispatch<SetStateAction<string[]>>;
};

export const useRequestDnD = ({ updateCollectionTree, setExpandedFolderIds }: UseRequestDnDParams) => {
  const draggingNodeIdRef = useRef<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragDropTarget, setDragDropTarget] = useState<DragDropTarget>(null);

  useEffect(() => {
    const clearDragState = () => {
      draggingNodeIdRef.current = null;
      setDraggingNodeId(null);
      setDragDropTarget(null);
    };

    window.addEventListener("dragend", clearDragState);
    window.addEventListener("drop", clearDragState);

    return () => {
      window.removeEventListener("dragend", clearDragState);
      window.removeEventListener("drop", clearDragState);
    };
  }, []);

  const beginDragNode = (nodeId: string) => (event: ReactDragEvent<HTMLElement>) => {
    event.stopPropagation();
    draggingNodeIdRef.current = nodeId;
    setDraggingNodeId(nodeId);
    setDragDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-apinaut-node-id", nodeId);
    event.dataTransfer.setData("text/plain", nodeId);
  };

  const endDragNode = () => {
    draggingNodeIdRef.current = null;
    setDraggingNodeId(null);
    setDragDropTarget(null);
  };

  const resolveDraggingNodeId = (event?: ReactDragEvent<HTMLElement>) => {
    if (draggingNodeIdRef.current) {
      return draggingNodeIdRef.current;
    }

    if (draggingNodeId) {
      return draggingNodeId;
    }

    if (!event) {
      return null;
    }

    const transferId =
      event.dataTransfer.getData("application/x-apinaut-node-id") ||
      event.dataTransfer.getData("text/plain");

    return transferId.trim() ? transferId.trim() : null;
  };

  const commitDrop = (targetFolderId: string | null, sourceNodeId?: string | null) => {
    const draggingId = sourceNodeId ?? resolveDraggingNodeId();

    if (!draggingId) {
      return;
    }

    updateCollectionTree((tree) => moveNodeToTarget(tree, draggingId, targetFolderId));

    if (targetFolderId) {
      setExpandedFolderIds((current) =>
        current.includes(targetFolderId) ? current : [...current, targetFolderId],
      );
    }

    draggingNodeIdRef.current = null;
    setDragDropTarget(null);
    setDraggingNodeId(null);
  };

  const commitDropAtPosition = (
    targetParentFolderId: string | null,
    index: number,
    sourceNodeId?: string | null,
  ) => {
    const draggingId = sourceNodeId ?? resolveDraggingNodeId();

    if (!draggingId) {
      return;
    }

    updateCollectionTree((tree) => moveNodeToPosition(tree, draggingId, targetParentFolderId, index));

    if (targetParentFolderId) {
      setExpandedFolderIds((current) =>
        current.includes(targetParentFolderId) ? current : [...current, targetParentFolderId],
      );
    }

    draggingNodeIdRef.current = null;
    setDragDropTarget(null);
    setDraggingNodeId(null);
  };

  const dragOverRoot = (event: ReactDragEvent<HTMLDivElement>) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragDropTarget({ type: "root" });
  };

  const dropOnRoot = (event: ReactDragEvent<HTMLDivElement>) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    commitDrop(null, draggingId);
  };

  const dragOverFolder = (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
    folderId: string,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const ratio = rect.height > 0 ? relativeY / rect.height : 0.5;

    if (ratio <= 0.25) {
      setDragDropTarget({ type: "position", parentFolderId, index });
      return;
    }

    if (ratio >= 0.75) {
      setDragDropTarget({ type: "position", parentFolderId, index: index + 1 });
      return;
    }

    setDragDropTarget({ type: "folder", folderId });
  };

  const dropOnFolder = (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
    folderId: string,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const ratio = rect.height > 0 ? relativeY / rect.height : 0.5;

    if (ratio <= 0.25) {
      commitDropAtPosition(parentFolderId, index, draggingId);
      return;
    }

    if (ratio >= 0.75) {
      commitDropAtPosition(parentFolderId, index + 1, draggingId);
      return;
    }

    commitDrop(folderId, draggingId);
  };

  const dragOverRequest = (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const targetIndex = relativeY < rect.height / 2 ? index : index + 1;
    setDragDropTarget({ type: "position", parentFolderId, index: targetIndex });
  };

  const dropOnRequest = (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const targetIndex = relativeY < rect.height / 2 ? index : index + 1;
    commitDropAtPosition(parentFolderId, targetIndex, draggingId);
  };

  const dragOverPosition = (
    event: ReactDragEvent<HTMLDivElement>,
    parentFolderId: string | null,
    index: number,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragDropTarget({ type: "position", parentFolderId, index });
  };

  const dropOnPosition = (
    event: ReactDragEvent<HTMLDivElement>,
    parentFolderId: string | null,
    index: number,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    commitDropAtPosition(parentFolderId, index, draggingId);
  };

  return {
    draggingNodeId,
    dragDropTarget,
    beginDragNode,
    endDragNode,
    dragOverRoot,
    dropOnRoot,
    dragOverFolder,
    dropOnFolder,
    dragOverRequest,
    dropOnRequest,
    dragOverPosition,
    dropOnPosition,
  };
};
