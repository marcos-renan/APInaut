"use client";

import { FolderPlus, Plus } from "lucide-react";

type RequestTreePanelHeaderProps = {
  title: string;
  createFolderLabel: string;
  createRequestLabel: string;
  onCreateFolder: () => void;
  onCreateRequest: () => void;
};

export const RequestTreePanelHeader = ({
  title,
  createFolderLabel,
  createRequestLabel,
  onCreateFolder,
  onCreateRequest,
}: RequestTreePanelHeaderProps) => {
  return (
    <div className="mb-3 flex items-center justify-between px-3">
      <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onCreateFolder}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300/45 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25"
          aria-label={createFolderLabel}
          title={createFolderLabel}
        >
          <FolderPlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onCreateRequest}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300/45 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25"
          aria-label={createRequestLabel}
          title={createRequestLabel}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
