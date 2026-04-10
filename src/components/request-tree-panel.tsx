"use client";

import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Plus,
} from "lucide-react";
import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import type { ApiRequest, RequestTreeNode } from "@/lib/collections";

type DragDropTarget =
  | { type: "root" }
  | { type: "folder"; folderId: string }
  | { type: "position"; parentFolderId: string | null; index: number }
  | null;

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
  draggingNodeId: string | null;
  dragDropTarget: DragDropTarget;
  methodStyleMap: Record<ApiRequest["method"], RequestMethodStyle>;
  setEditingRequestName: (value: string) => void;
  setEditingFolderName: (value: string) => void;
  createFolder: () => void;
  createRequest: () => void;
  selectRequest: (requestId: string) => void;
  toggleFolderExpanded: (folderId: string) => void;
  startEditingFolderName: (folderId: string, currentName: string) => void;
  startEditingRequestName: (requestId: string, currentName: string) => void;
  commitEditingFolderName: () => void;
  cancelEditingFolderName: () => void;
  commitEditingRequestName: () => void;
  cancelEditingRequestName: () => void;
  beginDragNode: (nodeId: string) => (event: ReactDragEvent<HTMLElement>) => void;
  endDragNode: () => void;
  dragOverRoot: (event: ReactDragEvent<HTMLDivElement>) => void;
  dropOnRoot: (event: ReactDragEvent<HTMLDivElement>) => void;
  dragOverFolder: (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
    folderId: string,
  ) => void;
  dropOnFolder: (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
    folderId: string,
  ) => void;
  dragOverRequest: (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
  ) => void;
  dropOnRequest: (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
  ) => void;
  dragOverPosition: (
    event: ReactDragEvent<HTMLDivElement>,
    parentFolderId: string | null,
    index: number,
  ) => void;
  dropOnPosition: (
    event: ReactDragEvent<HTMLDivElement>,
    parentFolderId: string | null,
    index: number,
  ) => void;
  openRequestContextMenu: (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => void;
};

const REQUEST_LIST_INDENT = 16;

export const RequestTreePanel = ({
  requestTree,
  activeRequestId,
  editingRequestId,
  editingRequestName,
  editingFolderId,
  editingFolderName,
  expandedFolderIds,
  draggingNodeId,
  dragDropTarget,
  methodStyleMap,
  setEditingRequestName,
  setEditingFolderName,
  createFolder,
  createRequest,
  selectRequest,
  toggleFolderExpanded,
  startEditingFolderName,
  startEditingRequestName,
  commitEditingFolderName,
  cancelEditingFolderName,
  commitEditingRequestName,
  cancelEditingRequestName,
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
  openRequestContextMenu,
}: RequestTreePanelProps) => {
  const renderDropZone = (
    key: string,
    parentFolderId: string | null,
    index: number,
    depth: number,
  ) => {
    if (!draggingNodeId) {
      return null;
    }

    const isActive =
      dragDropTarget?.type === "position" &&
      dragDropTarget.parentFolderId === parentFolderId &&
      dragDropTarget.index === index;

    return (
      <div key={key} style={{ paddingLeft: `${depth * REQUEST_LIST_INDENT}px` }}>
        <div
          onDragOver={(event) => dragOverPosition(event, parentFolderId, index)}
          onDrop={(event) => dropOnPosition(event, parentFolderId, index)}
          className={`h-2 rounded transition ${
            isActive ? "bg-violet-400/65" : "bg-transparent hover:bg-violet-500/30"
          }`}
        />
      </div>
    );
  };

  const renderRequestTreeNodes = (nodes: RequestTreeNode[], parentFolderId: string | null, depth = 0) => {
    const elements: ReactNode[] = [];

    nodes.forEach((node, index) => {
      const beforeZone = renderDropZone(
        `drop-${parentFolderId ?? "root"}-${index}-${node.id}`,
        parentFolderId,
        index,
        depth,
      );

      if (beforeZone) {
        elements.push(beforeZone);
      }

      const rowIndentStyle = {
        paddingLeft: `${depth * REQUEST_LIST_INDENT}px`,
      } as CSSProperties;

      if (node.type === "folder") {
        const isExpanded = expandedFolderIds.includes(node.id);
        const isDropTarget = dragDropTarget?.type === "folder" && dragDropTarget.folderId === node.id;
        const isEditingFolder = editingFolderId === node.id;

        elements.push(
          <div key={node.id} className="space-y-1">
            <div
              style={rowIndentStyle}
              onContextMenu={(event) => openRequestContextMenu(event, node.id)}
              onDragOver={(event) => dragOverFolder(event, parentFolderId, index, node.id)}
              onDrop={(event) => dropOnFolder(event, parentFolderId, index, node.id)}
            >
              <div
                role="button"
                tabIndex={0}
                draggable={!isEditingFolder}
                onDragStart={beginDragNode(node.id)}
                onDragEnd={endDragNode}
                onClick={() => toggleFolderExpanded(node.id)}
                onDoubleClick={() => startEditingFolderName(node.id, node.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleFolderExpanded(node.id);
                  }
                }}
                className={`flex h-10 w-full items-center gap-2 rounded-lg border px-2 text-left text-sm transition ${
                  isDropTarget
                    ? "border-violet-300/60 bg-violet-500/25"
                    : "border-white/10 bg-[#121025] hover:bg-[#1f1b33]"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-300 ${
                    !isEditingFolder ? "cursor-grab active:cursor-grabbing hover:bg-white/10" : "opacity-40"
                  }`}
                  title="Arrastar pasta"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-zinc-300 transition ${isExpanded ? "rotate-90" : ""}`}
                />
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-violet-200" />
                ) : (
                  <Folder className="h-4 w-4 shrink-0 text-violet-200" />
                )}
                {!isEditingFolder && <span className="truncate font-medium text-zinc-100">{node.name}</span>}
              </div>

              {isEditingFolder && (
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

            {isExpanded && (
              <div className="space-y-1">{renderRequestTreeNodes(node.children, node.id, depth + 1)}</div>
            )}
          </div>,
        );

        return;
      }

      const request = node.request;
      const isEditing = editingRequestId === request.id;

      elements.push(
        <div key={request.id} style={rowIndentStyle}>
          <div
            onContextMenu={(event) => openRequestContextMenu(event, request.id)}
            onDragOver={(event) => dragOverRequest(event, parentFolderId, index)}
            onDrop={(event) => dropOnRequest(event, parentFolderId, index)}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
              activeRequestId === request.id
                ? methodStyleMap[request.method].listActive
                : methodStyleMap[request.method].listInactive
            }`}
          >
            <div
              role="button"
              tabIndex={0}
              draggable={!isEditing}
              onDragStart={beginDragNode(request.id)}
              onDragEnd={endDragNode}
              onClick={() => selectRequest(request.id)}
              onDoubleClick={() => startEditingRequestName(request.id, request.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectRequest(request.id);
                }
              }}
              className="w-full text-left"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-300 ${
                    !isEditing ? "cursor-grab active:cursor-grabbing hover:bg-white/10" : "opacity-40"
                  }`}
                  title="Arrastar requisicao"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
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
        </div>,
      );
    });

    const endZone = renderDropZone(
      `drop-${parentFolderId ?? "root"}-end-${nodes.length}`,
      parentFolderId,
      nodes.length,
      depth,
    );

    if (endZone) {
      elements.push(endZone);
    }

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
      <div
        className={`mx-3 mb-2 flex h-9 items-center justify-center rounded-lg border border-dashed text-xs font-medium transition ${
          dragDropTarget?.type === "root"
            ? "border-violet-300/70 bg-violet-500/20 text-violet-100"
            : "border-white/20 bg-[#121025] text-zinc-400"
        }`}
        onDragOver={dragOverRoot}
        onDrop={dropOnRoot}
      >
        Soltar na raiz
      </div>
      <div
        className={`space-y-2 rounded-lg ${
          dragDropTarget?.type === "root" ? "ring-1 ring-violet-300/60 ring-offset-1 ring-offset-[#1a1728]" : ""
        }`}
        onDragOver={dragOverRoot}
        onDrop={dropOnRoot}
      >
        {requestTree.length === 0 && (
          <p className="rounded-lg border border-dashed border-white/15 p-3 text-xs text-zinc-400">
            Nenhuma requisicao ainda.
          </p>
        )}

        {renderRequestTreeNodes(requestTree, null)}
      </div>
    </aside>
  );
};