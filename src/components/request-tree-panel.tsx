"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import DragSelect from "dragselect";
import { ChevronRight, Folder, FolderOpen, FolderPlus, Plus } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ApiRequest, RequestTreeNode } from "@/lib/collections";
import { findNodeById, nodeContainsNodeId } from "@/lib/request-tree";

type RequestMethodStyle = {
  select: string;
  badge: string;
  listActive: string;
  listInactive: string;
  optionColor: string;
};

type RequestTreePanelProps = {
  requestTree: RequestTreeNode[];
  activeRequestId: string | null;
  editingRequestId: string | null;
  editingRequestName: string;
  editingFolderId: string | null;
  editingFolderName: string;
  expandedFolderIds: string[];
  methodStyleMap: Record<ApiRequest["method"], RequestMethodStyle>;
  setEditingRequestName: (value: string) => void;
  setEditingFolderName: (value: string) => void;
  createFolder: () => void;
  createRequest: () => void;
  moveNodeIntoFolder: (sourceNodeId: string, targetFolderId: string) => void;
  moveNodeAtPosition: (
    sourceNodeId: string,
    targetParentFolderId: string | null,
    targetIndex: number,
  ) => void;
  selectRequest: (requestId: string) => void;
  toggleFolderExpanded: (folderId: string) => void;
  startEditingFolderName: (folderId: string, currentName: string) => void;
  startEditingRequestName: (requestId: string, currentName: string) => void;
  commitEditingFolderName: () => void;
  cancelEditingFolderName: () => void;
  commitEditingRequestName: () => void;
  cancelEditingRequestName: () => void;
  openRequestContextMenu: (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => void;
};

type DropTarget =
  | {
      type: "folder";
      targetFolderId: string;
    }
  | {
      type: "position";
      targetParentFolderId: string | null;
      targetIndex: number;
    };

type FolderRowProps = {
  node: Extract<RequestTreeNode, { type: "folder" }>;
  depth: number;
  isSelected: boolean;
  isGroupDragLeader: boolean;
  isGroupDragMember: boolean;
  groupedDragCount: number;
  isExpanded: boolean;
  isEditing: boolean;
  editingFolderName: string;
  setEditingFolderName: (value: string) => void;
  handleNodePointerDown: (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => void;
  handleNodeContextMenu: (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => void;
  toggleFolderExpanded: (folderId: string) => void;
  startEditingFolderName: (folderId: string, currentName: string) => void;
  commitEditingFolderName: () => void;
  cancelEditingFolderName: () => void;
  activeDragId: string | null;
};

type RequestRowProps = {
  node: Extract<RequestTreeNode, { type: "request" }>;
  depth: number;
  isSelected: boolean;
  isGroupDragLeader: boolean;
  isGroupDragMember: boolean;
  groupedDragCount: number;
  isEditing: boolean;
  activeRequestId: string | null;
  editingRequestName: string;
  setEditingRequestName: (value: string) => void;
  handleNodePointerDown: (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => void;
  handleNodeContextMenu: (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => void;
  selectRequest: (requestId: string) => void;
  startEditingRequestName: (requestId: string, currentName: string) => void;
  commitEditingRequestName: () => void;
  cancelEditingRequestName: () => void;
  methodStyleMap: Record<ApiRequest["method"], RequestMethodStyle>;
};

type PositionDropZoneProps = {
  id: string;
  depth: number;
  activeDragId: string | null;
};

const REQUEST_LIST_INDENT = 16;
const ROOT_PARENT_TOKEN = "__root__";
const POSITION_PREFIX = "position:";
const FOLDER_PREFIX = "folder:";

class ShiftAwarePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: ReactPointerEvent<Element>) =>
        nativeEvent.isPrimary && nativeEvent.button === 0 && !nativeEvent.shiftKey,
    },
  ];
}

const flattenNodeIdsInRenderOrder = (nodes: RequestTreeNode[]): string[] => {
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

const getTopLevelSelectionForMove = (
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

const createPositionDropId = (parentFolderId: string | null, index: number): string => {
  const parentToken = encodeURIComponent(parentFolderId ?? ROOT_PARENT_TOKEN);
  return `${POSITION_PREFIX}${parentToken}:${index}`;
};

const createFolderDropId = (folderId: string): string => `${FOLDER_PREFIX}${encodeURIComponent(folderId)}`;

const haveSameNodeSelection = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((nodeId) => rightSet.has(nodeId));
};

const parseDropTargetId = (dropId: string): DropTarget | null => {
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
    targetParentFolderId:
      decodedParentToken === ROOT_PARENT_TOKEN ? null : decodedParentToken,
    targetIndex,
  };
};

const PositionDropZone = ({ id, depth, activeDragId }: PositionDropZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  if (!activeDragId) {
    return null;
  }

  return (
    <div style={{ paddingLeft: `${depth * REQUEST_LIST_INDENT}px` }}>
      <div
        ref={setNodeRef}
        className="relative my-0.5 h-2"
      >
        <div
          className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded transition ${
            isOver ? "h-[2px] bg-violet-400/85" : "h-px bg-transparent hover:bg-violet-500/45"
          }`}
        />
      </div>
    </div>
  );
};

const FolderRow = ({
  node,
  depth,
  isSelected,
  isGroupDragLeader,
  isGroupDragMember,
  groupedDragCount,
  isExpanded,
  isEditing,
  editingFolderName,
  setEditingFolderName,
  handleNodePointerDown,
  handleNodeContextMenu,
  toggleFolderExpanded,
  startEditingFolderName,
  commitEditingFolderName,
  cancelEditingFolderName,
  activeDragId,
}: FolderRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: node.id,
  });
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: createFolderDropId(node.id),
  });

  const setCombinedRef = (element: HTMLDivElement | null) => {
    setDraggableNodeRef(element);
    setDroppableNodeRef(element);
  };

  const rowStyle: CSSProperties = {
    paddingLeft: `${depth * REQUEST_LIST_INDENT}px`,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.82 : 1,
  };

  const isDropTarget = Boolean(activeDragId) && isOver && activeDragId !== node.id;
  const dragInteractionProps = isEditing ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setCombinedRef}
      style={rowStyle}
      data-tree-row="true"
      data-node-id={node.id}
      className="apinaut-tree-selectable w-full"
    >
      <div
        className={`flex h-10 w-full items-center gap-2 rounded-lg border px-2 text-left text-sm transition ${
          isDropTarget
            ? "border-violet-300/70 bg-violet-500/25"
            : isSelected
              ? "border-violet-300/70 bg-violet-500/18"
            : "border-white/10 bg-[#121025] hover:bg-[#1f1b33]"
        } ${isGroupDragLeader ? "apinaut-group-drag-leader relative" : ""} ${
          isGroupDragMember ? "apinaut-group-drag-merge" : ""
        } ${isEditing ? "" : "cursor-pointer select-none"}`}
        onPointerDown={(event) => handleNodePointerDown(event, node.id)}
        onContextMenu={(event) => handleNodeContextMenu(event, node.id)}
        role="button"
        tabIndex={0}
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey) {
            return;
          }

          if (!isEditing) {
            toggleFolderExpanded(node.id);
          }
        }}
        onDoubleClick={() => {
          if (!isEditing) {
            startEditingFolderName(node.id, node.name);
          }
        }}
        onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
          if (isEditing) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleFolderExpanded(node.id);
          }
        }}
        {...dragInteractionProps}
      >
        {isGroupDragLeader && groupedDragCount > 1 && (
          <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-violet-300/70 bg-violet-500/90 px-1 text-[10px] font-bold text-white shadow">
            +{groupedDragCount - 1}
          </span>
        )}
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-zinc-300 transition ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-violet-200" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-violet-200" />
        )}
        {!isEditing && <span className="truncate font-medium text-zinc-100">{node.name}</span>}
      </div>

      {isEditing && (
        <input
          autoFocus
          value={editingFolderName}
          onChange={(event) => setEditingFolderName(event.target.value)}
          onBlur={commitEditingFolderName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitEditingFolderName();
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              cancelEditingFolderName();
            }
          }}
          className="mt-1 h-8 w-full rounded-md border border-violet-300/40 bg-[#0f0c1d] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
          placeholder="Nome da pasta"
        />
      )}
    </div>
  );
};

const RequestRow = ({
  node,
  depth,
  isSelected,
  isGroupDragLeader,
  isGroupDragMember,
  groupedDragCount,
  isEditing,
  activeRequestId,
  editingRequestName,
  setEditingRequestName,
  handleNodePointerDown,
  handleNodeContextMenu,
  selectRequest,
  startEditingRequestName,
  commitEditingRequestName,
  cancelEditingRequestName,
  methodStyleMap,
}: RequestRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: node.id,
  });

  const request = node.request;
  const rowStyle: CSSProperties = {
    paddingLeft: `${depth * REQUEST_LIST_INDENT}px`,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.82 : 1,
  };
  const dragInteractionProps = isEditing ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      style={rowStyle}
      data-tree-row="true"
      data-node-id={node.id}
      className="apinaut-tree-selectable"
    >
      <div
        onPointerDown={(event) => handleNodePointerDown(event, node.id)}
        onContextMenu={(event) => handleNodeContextMenu(event, request.id)}
        role="button"
        tabIndex={0}
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey) {
            return;
          }

          if (!isEditing) {
            selectRequest(request.id);
          }
        }}
        onDoubleClick={() => {
          if (!isEditing) {
            startEditingRequestName(request.id, request.name);
          }
        }}
        onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
          if (isEditing) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectRequest(request.id);
          }
        }}
        className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
          activeRequestId === request.id
            ? methodStyleMap[request.method].listActive
            : methodStyleMap[request.method].listInactive
        } ${isSelected ? "ring-1 ring-violet-300/80" : ""} ${
          isEditing ? "" : "cursor-pointer select-none"
        } ${isGroupDragLeader ? "apinaut-group-drag-leader relative" : ""} ${
          isGroupDragMember ? "apinaut-group-drag-merge" : ""
        }`}
        {...dragInteractionProps}
      >
        {isGroupDragLeader && groupedDragCount > 1 && (
          <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-violet-300/70 bg-violet-500/90 px-1 text-[10px] font-bold text-white shadow">
            +{groupedDragCount - 1}
          </span>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
              methodStyleMap[request.method].badge
            }`}
          >
            {request.method}
          </span>
          {!isEditing && (
            <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">{request.name}</span>
          )}
        </div>

        {isEditing && (
          <input
            autoFocus
            value={editingRequestName}
            onChange={(event) => setEditingRequestName(event.target.value)}
            onBlur={commitEditingRequestName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitEditingRequestName();
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                cancelEditingRequestName();
              }
            }}
            className="mt-1 h-8 w-full rounded-md border border-violet-300/40 bg-[#0f0c1d] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
            placeholder="Nome da requisicao"
          />
        )}
      </div>
    </div>
  );
};

export const RequestTreePanel = ({
  requestTree,
  activeRequestId,
  editingRequestId,
  editingRequestName,
  editingFolderId,
  editingFolderName,
  expandedFolderIds,
  methodStyleMap,
  setEditingRequestName,
  setEditingFolderName,
  createFolder,
  createRequest,
  moveNodeIntoFolder,
  moveNodeAtPosition,
  selectRequest,
  toggleFolderExpanded,
  startEditingFolderName,
  startEditingRequestName,
  commitEditingFolderName,
  cancelEditingFolderName,
  commitEditingRequestName,
  cancelEditingRequestName,
  openRequestContextMenu,
}: RequestTreePanelProps) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [draggedNodeIds, setDraggedNodeIds] = useState<string[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const treeSurfaceRef = useRef<HTMLDivElement | null>(null);
  const dragSelectRef = useRef<DragSelect<HTMLElement> | null>(null);
  const isSyncingDragSelectRef = useRef(false);

  const sensors = useSensors(
    useSensor(ShiftAwarePointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );

  const orderedNodeIds = useMemo(
    () => flattenNodeIdsInRenderOrder(requestTree),
    [requestTree],
  );

  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const draggedNodeIdSet = useMemo(() => new Set(draggedNodeIds), [draggedNodeIds]);

  const collisionDetection = useMemo<CollisionDetection>(
    () => (args) => {
      const pointerHits = pointerWithin(args);
      if (pointerHits.length > 0) {
        return pointerHits;
      }

      const intersectionHits = rectIntersection(args);
      if (intersectionHits.length > 0) {
        return intersectionHits;
      }

      return closestCenter(args);
    },
    [],
  );

  useEffect(() => {
    const existingNodeIds = new Set(orderedNodeIds);
    setSelectedNodeIds((current) => current.filter((nodeId) => existingNodeIds.has(nodeId)));
    setDraggedNodeIds((current) => current.filter((nodeId) => existingNodeIds.has(nodeId)));
  }, [orderedNodeIds]);

  const handleNodePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    nodeId: string,
  ) => {
    if (event.button !== 0) {
      return;
    }

    if (event.shiftKey) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      setSelectedNodeIds((current) =>
        current.includes(nodeId)
          ? current.filter((currentId) => currentId !== nodeId)
          : [...current, nodeId],
      );
      return;
    }

    setSelectedNodeIds((current) =>
      current.length === 1 && current[0] === nodeId ? current : [nodeId],
    );
  };

  const handleNodeContextMenu = (
    event: ReactMouseEvent<HTMLDivElement>,
    nodeId: string,
  ) => {
    if (!selectedNodeIdSet.has(nodeId)) {
      setSelectedNodeIds([nodeId]);
    }

    openRequestContextMenu(event, nodeId);
  };

  const canStartShiftSelection = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return !target.closest("button,input,textarea,select,[contenteditable='true']");
  };

  const mapElementsToNodeIds = (elements: HTMLElement[]) =>
    elements
      .map((element) =>
        element instanceof HTMLElement ? element.dataset.nodeId ?? null : null,
      )
      .filter((nodeId): nodeId is string => Boolean(nodeId));

  useEffect(() => {
    const area = treeSurfaceRef.current;

    if (!area) {
      return;
    }

    const selectables = Array.from(
      area.querySelectorAll<HTMLElement>(".apinaut-tree-selectable"),
    );

    const selector = document.createElement("div");
    selector.style.position = "absolute";
    selector.style.pointerEvents = "none";
    selector.style.border = "1px solid rgba(196, 181, 253, 0.85)";
    selector.style.background = "rgba(139, 92, 246, 0.14)";
    selector.style.borderRadius = "6px";
    selector.style.zIndex = "80";
    selector.style.visibility = "hidden";

    const dragSelect = new DragSelect<HTMLElement>({
      area,
      selectables,
      selector,
      draggability: false,
      immediateDrag: false,
      multiSelectMode: false,
      multiSelectToggling: false,
      multiSelectKeys: ["Shift"],
      usePointerEvents: true,
      selectionThreshold: 0,
      customStyles: true,
    });

    const handleStartPre = (payload: { event?: Event }) => {
      const event = payload.event;

      if (!event) {
        selector.style.visibility = "hidden";
        dragSelect.break();
        return;
      }

      if (!("shiftKey" in event) || !event.shiftKey) {
        selector.style.visibility = "hidden";
        dragSelect.break();
        return;
      }

      if (!canStartShiftSelection(event.target)) {
        selector.style.visibility = "hidden";
        dragSelect.break();
        return;
      }

      selector.style.visibility = "visible";
    };

    const syncSelectedNodeIds = () => {
      if (isSyncingDragSelectRef.current) {
        return;
      }

      const nextSelection = mapElementsToNodeIds(dragSelect.getSelection());
      setSelectedNodeIds((currentSelection) =>
        haveSameNodeSelection(currentSelection, nextSelection) ? currentSelection : nextSelection,
      );
    };

    const startSubscriptionId = dragSelect.subscribe("DS:start:pre", handleStartPre);
    const endSubscriptionId = dragSelect.subscribe("DS:end", () => {
      selector.style.visibility = "hidden";
      syncSelectedNodeIds();
    });

    dragSelectRef.current = dragSelect;

    return () => {
      dragSelect.unsubscribe("DS:start:pre", undefined, startSubscriptionId);
      dragSelect.unsubscribe("DS:end", undefined, endSubscriptionId);
      selector.style.visibility = "hidden";
      dragSelect.stop();
      selector.remove();
      dragSelectRef.current = null;
    };
  }, []);

  useEffect(() => {
    const area = treeSurfaceRef.current;
    const dragSelect = dragSelectRef.current;

    if (!area || !dragSelect) {
      return;
    }

    const selectables = Array.from(
      area.querySelectorAll<HTMLElement>(".apinaut-tree-selectable"),
    );
    dragSelect.setSettings({ selectables });

    const selectedNodeSet = new Set(selectedNodeIds);
    const selectedElements = selectables.filter((element) => {
      const nodeId = element.dataset.nodeId;
      return Boolean(nodeId && selectedNodeSet.has(nodeId));
    });

    const currentSelection = mapElementsToNodeIds(dragSelect.getSelection());
    const nextSelection = selectedElements
      .map((element) => element.dataset.nodeId ?? null)
      .filter((nodeId): nodeId is string => Boolean(nodeId));

    if (haveSameNodeSelection(currentSelection, nextSelection)) {
      return;
    }

    isSyncingDragSelectRef.current = true;
    dragSelect.setSelection(selectedElements, false, true);
    isSyncingDragSelectRef.current = false;
  }, [orderedNodeIds, selectedNodeIds]);

  const handleDragStart = (event: DragStartEvent) => {
    const activeNodeId = String(event.active.id);
    setActiveDragId(activeNodeId);

    const baseSelection =
      selectedNodeIdSet.has(activeNodeId) && selectedNodeIds.length > 0
        ? selectedNodeIds
        : [activeNodeId];

    if (!selectedNodeIdSet.has(activeNodeId)) {
      setSelectedNodeIds([activeNodeId]);
    }

    const orderedSelection = orderedNodeIds.filter((nodeId) => baseSelection.includes(nodeId));
    const topLevelSelection = getTopLevelSelectionForMove(requestTree, orderedSelection);

    setDraggedNodeIds(topLevelSelection.length > 0 ? topLevelSelection : [activeNodeId]);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setDraggedNodeIds([]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const sourceNodeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;

    setActiveDragId(null);
    const movingNodeIds =
      draggedNodeIds.length > 0
        ? draggedNodeIds
        : getTopLevelSelectionForMove(requestTree, [sourceNodeId]);
    setDraggedNodeIds([]);
    setSelectedNodeIds([]);

    if (!overId) {
      return;
    }

    const dropTarget = parseDropTargetId(overId);

    if (!dropTarget) {
      return;
    }

    if (dropTarget.type === "folder") {
      movingNodeIds.forEach((movingNodeId) => {
        if (movingNodeId !== dropTarget.targetFolderId) {
          moveNodeIntoFolder(movingNodeId, dropTarget.targetFolderId);
        }
      });
      return;
    }

    movingNodeIds.forEach((movingNodeId, index) => {
      moveNodeAtPosition(
        movingNodeId,
        dropTarget.targetParentFolderId,
        dropTarget.targetIndex + index,
      );
    });
  };

  const renderRequestTreeNodes = (
    nodes: RequestTreeNode[],
    parentFolderId: string | null = null,
    depth = 0,
  ): ReactNode[] => {
    const elements: ReactNode[] = [];

    nodes.forEach((node, index) => {
      elements.push(
        <PositionDropZone
          key={`drop-before-${parentFolderId ?? ROOT_PARENT_TOKEN}-${index}-${node.id}`}
          id={createPositionDropId(parentFolderId, index)}
          depth={depth}
          activeDragId={activeDragId}
        />,
      );

      if (node.type === "folder") {
        const isExpanded = expandedFolderIds.includes(node.id);
        const isEditing = editingFolderId === node.id;

        elements.push(
          <div key={node.id} className="space-y-1">
            <FolderRow
              node={node}
              depth={depth}
              isSelected={selectedNodeIdSet.has(node.id)}
              isGroupDragLeader={activeDragId === node.id && draggedNodeIds.length > 1}
              isGroupDragMember={
                Boolean(activeDragId) &&
                draggedNodeIdSet.has(node.id) &&
                node.id !== activeDragId
              }
              groupedDragCount={draggedNodeIds.length}
              isExpanded={isExpanded}
              isEditing={isEditing}
              editingFolderName={editingFolderName}
              setEditingFolderName={setEditingFolderName}
              handleNodePointerDown={handleNodePointerDown}
              handleNodeContextMenu={handleNodeContextMenu}
              toggleFolderExpanded={toggleFolderExpanded}
              startEditingFolderName={startEditingFolderName}
              commitEditingFolderName={commitEditingFolderName}
              cancelEditingFolderName={cancelEditingFolderName}
              activeDragId={activeDragId}
            />

            {isExpanded && (
              <div className="space-y-1">
                {renderRequestTreeNodes(node.children, node.id, depth + 1)}
              </div>
            )}
          </div>,
        );

        return;
      }

      const isEditing = editingRequestId === node.request.id;

      elements.push(
        <RequestRow
          key={node.id}
          node={node}
          depth={depth}
          isSelected={selectedNodeIdSet.has(node.id)}
          isGroupDragLeader={activeDragId === node.id && draggedNodeIds.length > 1}
          isGroupDragMember={
            Boolean(activeDragId) &&
            draggedNodeIdSet.has(node.id) &&
            node.id !== activeDragId
          }
          groupedDragCount={draggedNodeIds.length}
          isEditing={isEditing}
          activeRequestId={activeRequestId}
          editingRequestName={editingRequestName}
          setEditingRequestName={setEditingRequestName}
          handleNodePointerDown={handleNodePointerDown}
          handleNodeContextMenu={handleNodeContextMenu}
          selectRequest={selectRequest}
          startEditingRequestName={startEditingRequestName}
          commitEditingRequestName={commitEditingRequestName}
          cancelEditingRequestName={cancelEditingRequestName}
          methodStyleMap={methodStyleMap}
        />,
      );
    });

    elements.push(
      <PositionDropZone
        key={`drop-end-${parentFolderId ?? ROOT_PARENT_TOKEN}-${nodes.length}`}
        id={createPositionDropId(parentFolderId, nodes.length)}
        depth={depth}
        activeDragId={activeDragId}
      />,
    );

    return elements;
  };

  return (
    <aside className="min-h-0 overflow-auto border-y border-white/10 bg-[#1a1728] px-0 py-3">
      <div className="mb-3 flex items-center justify-between px-3">
        <h2 className="text-sm font-medium text-zinc-300">Requisicoes</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={createFolder}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300/45 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25"
            aria-label="Criar nova pasta"
            title="Criar nova pasta"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={createRequest}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300/45 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25"
            aria-label="Criar nova requisicao"
            title="Criar nova requisicao"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={treeSurfaceRef}
          className="relative mx-2 space-y-2 rounded-lg"
        >
          {requestTree.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/15 p-3 text-xs text-zinc-400">
              Nenhuma requisicao ainda.
            </p>
          )}

          {renderRequestTreeNodes(requestTree, null, 0)}
        </div>
      </DndContext>
    </aside>
  );
};
