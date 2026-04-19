"use client";

import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useI18n } from "@/components/language-provider";
import {
  type RequestTreePanelProps,
} from "@/components/request-tree-panel.types";
import {
  RequestTreePanelHeader,
} from "@/components/request-tree-panel-header";
import { RequestTreeNodes } from "@/components/request-tree-panel-tree";
import {
  DOUBLE_CLICK_SELECTION_INTERVAL_MS,
  DOUBLE_CLICK_SELECTION_MAX_DISTANCE,
  ShiftAwarePointerSensor,
  flattenNodeIdsInRenderOrder,
  getTopLevelSelectionForMove,
  parseDropTargetId,
} from "@/components/request-tree-panel.utils";


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
  const { t } = useI18n();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [draggedNodeIds, setDraggedNodeIds] = useState<string[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isRectangleSelecting, setIsRectangleSelecting] = useState(false);
  const treeSurfaceRef = useRef<HTMLDivElement | null>(null);
  const lastSelectionActivationPointRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const rectangleSessionRef = useRef<{
    pointerId: number;
    areaRect: DOMRect;
    start: { x: number; y: number };
  } | null>(null);
  const selectionOverlayRef = useRef<HTMLDivElement | null>(null);

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

  const canStartSelectionFromTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return !target.closest("button,input,textarea,select,[contenteditable='true']");
  };

  const isTreeBackgroundTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return !target.closest("[data-tree-row='true']");
  };

  const isPrimaryPointerDown = (event: Event) => {
    if (!("button" in event)) {
      return false;
    }

    return Number((event as MouseEvent).button) === 0;
  };

  const getPointerCoordinates = (event: Event) => {
    if (!("clientX" in event) || !("clientY" in event)) {
      return null;
    }

    const { clientX, clientY } = event as MouseEvent;

    if (typeof clientX !== "number" || typeof clientY !== "number") {
      return null;
    }

    return {
      x: clientX,
      y: clientY,
    };
  };

  useEffect(() => {
    const area = treeSurfaceRef.current;

    if (!area) {
      return;
    }

    const selector = document.createElement("div");
    selector.style.position = "fixed";
    selector.style.pointerEvents = "none";
    selector.style.border = "1px solid rgba(196, 181, 253, 0.96)";
    selector.style.background = "rgba(167, 139, 250, 0.28)";
    selector.style.boxShadow = "inset 0 0 0 1px rgba(167, 139, 250, 0.22)";
    selector.style.mixBlendMode = "normal";
    selector.style.borderRadius = "6px";
    selector.style.zIndex = "2147483647";
    selector.style.display = "none";
    document.body.appendChild(selector);
    selectionOverlayRef.current = selector;

    const getClampedPoint = (x: number, y: number, areaRect: DOMRect) => ({
      x: Math.min(Math.max(x, areaRect.left), areaRect.right),
      y: Math.min(Math.max(y, areaRect.top), areaRect.bottom),
    });

    const setSelectorRect = (
      start: { x: number; y: number },
      current: { x: number; y: number },
    ) => {
      const left = Math.min(start.x, current.x);
      const top = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);

      selector.style.left = `${left}px`;
      selector.style.top = `${top}px`;
      selector.style.width = `${width}px`;
      selector.style.height = `${height}px`;
      selector.style.display = "block";
    };

    const updateSelectionFromRectangle = (start: { x: number; y: number }, current: { x: number; y: number }) => {
      const selectionRect = {
        left: Math.min(start.x, current.x),
        right: Math.max(start.x, current.x),
        top: Math.min(start.y, current.y),
        bottom: Math.max(start.y, current.y),
      };

      const selectables = Array.from(
        area.querySelectorAll<HTMLElement>(".apinaut-tree-selectable"),
      );

      const nextSelection = selectables
        .filter((element) => {
          const elementRect = element.getBoundingClientRect();
          return (
            elementRect.right >= selectionRect.left &&
            elementRect.left <= selectionRect.right &&
            elementRect.bottom >= selectionRect.top &&
            elementRect.top <= selectionRect.bottom
          );
        })
        .map((element) => element.dataset.nodeId ?? null)
        .filter((nodeId): nodeId is string => Boolean(nodeId));

      setSelectedNodeIds((currentSelection) =>
        currentSelection.length === nextSelection.length &&
        currentSelection.every((nodeId) => nextSelection.includes(nodeId))
          ? currentSelection
          : nextSelection,
      );
    };

    const endRectangleSelection = (pointerId?: number) => {
      const session = rectangleSessionRef.current;
      if (!session) {
        return;
      }

      if (
        typeof pointerId === "number" &&
        pointerId !== session.pointerId
      ) {
        return;
      }

      if (area.hasPointerCapture(session.pointerId)) {
        area.releasePointerCapture(session.pointerId);
      }

      rectangleSessionRef.current = null;
      selector.style.display = "none";
      setIsRectangleSelecting(false);
      document.body.style.userSelect = "";
    };

    const handlePointerMove = (event: PointerEvent) => {
      const session = rectangleSessionRef.current;
      if (!session) {
        return;
      }

      const clamped = getClampedPoint(event.clientX, event.clientY, session.areaRect);
      setSelectorRect(session.start, clamped);
      updateSelectionFromRectangle(session.start, clamped);
    };

    const handlePointerUp = (event: PointerEvent) => {
      endRectangleSelection(event.pointerId);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      endRectangleSelection(event.pointerId);
    };

    const handleAreaPointerDown = (event: PointerEvent) => {
      if (!isPrimaryPointerDown(event)) {
        return;
      }

      if (!canStartSelectionFromTarget(event.target)) {
        return;
      }

      if (!isTreeBackgroundTarget(event.target)) {
        return;
      }

      const coordinates = getPointerCoordinates(event);
      if (!coordinates) {
        return;
      }

      const now = performance.now();
      const previous = lastSelectionActivationPointRef.current;
      const isDoubleClickActivation =
        previous !== null &&
        now - previous.time <= DOUBLE_CLICK_SELECTION_INTERVAL_MS &&
        Math.hypot(coordinates.x - previous.x, coordinates.y - previous.y) <= DOUBLE_CLICK_SELECTION_MAX_DISTANCE;

      if (!isDoubleClickActivation) {
        lastSelectionActivationPointRef.current = {
          time: now,
          x: coordinates.x,
          y: coordinates.y,
        };
        return;
      }

      lastSelectionActivationPointRef.current = null;
      const areaRect = area.getBoundingClientRect();
      const start = getClampedPoint(coordinates.x, coordinates.y, areaRect);

      rectangleSessionRef.current = {
        pointerId: event.pointerId,
        areaRect,
        start,
      };

      area.setPointerCapture(event.pointerId);
      setIsRectangleSelecting(true);
      document.body.style.userSelect = "none";
      setSelectorRect(start, start);
      updateSelectionFromRectangle(start, start);
      event.preventDefault();
    };

    area.addEventListener("pointerdown", handleAreaPointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      area.removeEventListener("pointerdown", handleAreaPointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      endRectangleSelection();
      selector.remove();
      selectionOverlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handlePointerDownOutsideTree = (event: PointerEvent) => {
      const area = treeSurfaceRef.current;

      if (!area || !(event.target instanceof Node) || area.contains(event.target)) {
        return;
      }

      setSelectedNodeIds((current) => (current.length > 0 ? [] : current));
    };

    window.addEventListener("pointerdown", handlePointerDownOutsideTree);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDownOutsideTree);
    };
  }, []);

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

  return (
    <aside className="flex min-h-0 flex-col overflow-auto border-y border-white/10 bg-[#1a1728] px-0 py-3">
      <RequestTreePanelHeader
        title={t("requestTree.title")}
        createFolderLabel={t("requestTree.createFolder")}
        createRequestLabel={t("requestTree.createRequest")}
        onCreateFolder={createFolder}
        onCreateRequest={createRequest}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={treeSurfaceRef}
          className="relative isolate flex-1 w-full rounded-lg pl-5"
        >
          <div className="min-h-full space-y-2 pr-2 pb-2">
            {requestTree.length === 0 && (
              <p className="rounded-lg border border-dashed border-white/15 p-3 text-xs text-zinc-400">
                {t("requestTree.none")}
              </p>
            )}

            <RequestTreeNodes
              nodes={requestTree}
              activeRequestId={activeRequestId}
              activeDragId={activeDragId}
              draggedNodeIds={draggedNodeIds}
              draggedNodeIdSet={draggedNodeIdSet}
              selectedNodeIdSet={selectedNodeIdSet}
              expandedFolderIds={expandedFolderIds}
              editingFolderId={editingFolderId}
              editingFolderName={editingFolderName}
              setEditingFolderName={setEditingFolderName}
              editingRequestId={editingRequestId}
              editingRequestName={editingRequestName}
              setEditingRequestName={setEditingRequestName}
              methodStyleMap={methodStyleMap}
              isRectangleSelecting={isRectangleSelecting}
              handleNodePointerDown={handleNodePointerDown}
              handleNodeContextMenu={handleNodeContextMenu}
              toggleFolderExpanded={toggleFolderExpanded}
              startEditingFolderName={startEditingFolderName}
              commitEditingFolderName={commitEditingFolderName}
              cancelEditingFolderName={cancelEditingFolderName}
              selectRequest={selectRequest}
              startEditingRequestName={startEditingRequestName}
              commitEditingRequestName={commitEditingRequestName}
              cancelEditingRequestName={cancelEditingRequestName}
              folderNamePlaceholder={t("requestTree.folderNamePlaceholder")}
              requestNamePlaceholder={t("requestTree.requestNamePlaceholder")}
            />
          </div>
        </div>
      </DndContext>
    </aside>
  );
};
