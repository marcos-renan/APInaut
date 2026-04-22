import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import type { ApiRequest, RequestTreeNode } from "@/lib/collections";

export type RequestMethodStyle = {
  select: string;
  badge: string;
  listActive: string;
  listInactive: string;
  optionColor: string;
};

export type RequestTreePanelProps = {
  requestTree: RequestTreeNode[];
  activeRequestId: string | null;
  centerOnRequestId: string | null;
  centerOnRequestVersion: number;
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

export type DropTarget =
  | {
      type: "folder";
      targetFolderId: string;
    }
  | {
      type: "position";
      targetParentFolderId: string | null;
      targetIndex: number;
    };

export type FolderRowProps = {
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
  isRectangleSelecting: boolean;
  folderNamePlaceholder: string;
};

export type RequestRowProps = {
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
  isRectangleSelecting: boolean;
  requestNamePlaceholder: string;
};

export type PositionDropZoneProps = {
  id: string;
  depth: number;
  activeDragId: string | null;
};
