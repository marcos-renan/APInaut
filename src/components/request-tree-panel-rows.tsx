"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type {
  FolderRowProps,
  PositionDropZoneProps,
  RequestRowProps,
} from "@/components/request-tree-panel.types";
import {
  REQUEST_LIST_INDENT,
  createFolderDropId,
} from "@/components/request-tree-panel.utils";

export const PositionDropZone = ({ id, depth, activeDragId }: PositionDropZoneProps) => {
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

export const FolderRow = ({
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
  isRectangleSelecting,
  folderNamePlaceholder,
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
  const dragInteractionProps = isEditing || isRectangleSelecting ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setCombinedRef}
      style={rowStyle}
      data-tree-row="true"
      data-node-id={node.id}
      className={`apinaut-tree-selectable w-full ${isRectangleSelecting ? "pointer-events-none" : ""}`}
    >
      <div
        className={`flex h-[var(--apinaut-tree-row-height,40px)] w-full items-center gap-2 rounded-lg border px-2 text-left text-sm transition ${
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
          placeholder={folderNamePlaceholder}
        />
      )}
    </div>
  );
};

export const RequestRow = ({
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
  isRectangleSelecting,
  requestNamePlaceholder,
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
  const dragInteractionProps = isEditing || isRectangleSelecting ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      style={rowStyle}
      data-tree-row="true"
      data-node-id={node.id}
      className={`apinaut-tree-selectable ${isRectangleSelecting ? "pointer-events-none" : ""}`}
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
            placeholder={requestNamePlaceholder}
          />
        )}
      </div>
    </div>
  );
};
