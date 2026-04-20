"use client";

import {
  Fragment,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  FolderRow,
  PositionDropZone,
  RequestRow,
} from "@/components/request-tree-panel-rows";
import type { RequestMethodStyle } from "@/components/request-tree-panel.types";
import {
  createPositionDropId,
} from "@/components/request-tree-panel.utils";
import type { ApiRequest, RequestTreeNode } from "@/lib/collections";

type RequestTreeNodesProps = {
  nodes: RequestTreeNode[];
  parentFolderId?: string | null;
  depth?: number;
  activeRequestId: string | null;
  activeDragId: string | null;
  draggedNodeIds: string[];
  draggedNodeIdSet: Set<string>;
  selectedNodeIdSet: Set<string>;
  expandedFolderIds: string[];
  editingFolderId: string | null;
  editingFolderName: string;
  setEditingFolderName: (value: string) => void;
  editingRequestId: string | null;
  editingRequestName: string;
  setEditingRequestName: (value: string) => void;
  methodStyleMap: Record<ApiRequest["method"], RequestMethodStyle>;
  isRectangleSelecting: boolean;
  handleNodePointerDown: (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => void;
  handleNodeContextMenu: (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => void;
  toggleFolderExpanded: (folderId: string) => void;
  startEditingFolderName: (folderId: string, currentName: string) => void;
  commitEditingFolderName: () => void;
  cancelEditingFolderName: () => void;
  selectRequest: (requestId: string) => void;
  startEditingRequestName: (requestId: string, currentName: string) => void;
  commitEditingRequestName: () => void;
  cancelEditingRequestName: () => void;
  folderNamePlaceholder: string;
  requestNamePlaceholder: string;
};

export const RequestTreeNodes = ({
  nodes,
  parentFolderId = null,
  depth = 0,
  activeRequestId,
  activeDragId,
  draggedNodeIds,
  draggedNodeIdSet,
  selectedNodeIdSet,
  expandedFolderIds,
  editingFolderId,
  editingFolderName,
  setEditingFolderName,
  editingRequestId,
  editingRequestName,
  setEditingRequestName,
  methodStyleMap,
  isRectangleSelecting,
  handleNodePointerDown,
  handleNodeContextMenu,
  toggleFolderExpanded,
  startEditingFolderName,
  commitEditingFolderName,
  cancelEditingFolderName,
  selectRequest,
  startEditingRequestName,
  commitEditingRequestName,
  cancelEditingRequestName,
  folderNamePlaceholder,
  requestNamePlaceholder,
}: RequestTreeNodesProps) => {
  return (
    <>
      {nodes.map((node, index) => (
        <Fragment key={node.id}>
          <PositionDropZone
            id={createPositionDropId(parentFolderId, index)}
            depth={depth}
            activeDragId={activeDragId}
          />

          {node.type === "folder" ? (
            <div className="space-y-1">
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
                isExpanded={expandedFolderIds.includes(node.id)}
                isEditing={editingFolderId === node.id}
                editingFolderName={editingFolderName}
                setEditingFolderName={setEditingFolderName}
                handleNodePointerDown={handleNodePointerDown}
                handleNodeContextMenu={handleNodeContextMenu}
                toggleFolderExpanded={toggleFolderExpanded}
                startEditingFolderName={startEditingFolderName}
                commitEditingFolderName={commitEditingFolderName}
                cancelEditingFolderName={cancelEditingFolderName}
                activeDragId={activeDragId}
                isRectangleSelecting={isRectangleSelecting}
                folderNamePlaceholder={folderNamePlaceholder}
              />

              {expandedFolderIds.includes(node.id) && (
                <div className="space-y-1">
                  <RequestTreeNodes
                    nodes={node.children}
                    parentFolderId={node.id}
                    depth={depth + 1}
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
                    folderNamePlaceholder={folderNamePlaceholder}
                    requestNamePlaceholder={requestNamePlaceholder}
                  />
                </div>
              )}
            </div>
          ) : (
            <RequestRow
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
              isEditing={editingRequestId === node.request.id}
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
              isRectangleSelecting={isRectangleSelecting}
              requestNamePlaceholder={requestNamePlaceholder}
            />
          )}
        </Fragment>
      ))}

      <PositionDropZone
        id={createPositionDropId(parentFolderId, nodes.length)}
        depth={depth}
        activeDragId={activeDragId}
      />
    </>
  );
};
