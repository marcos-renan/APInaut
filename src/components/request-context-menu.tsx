"use client";

import { useI18n } from "@/components/language-provider";

type RequestContextMenuProps = Record<string, any>;

export const RequestContextMenu = ({
  requestContextMenu,
  requestContextMenuTargetNode,
  requestContextMenuRef,
  createRequestInFolder,
  createFolderInFolder,
  startEditingRequestName,
  startEditingFolderName,
  deleteNode,
}: RequestContextMenuProps) => {
  const { t } = useI18n();

  if (!requestContextMenu || !requestContextMenuTargetNode) {
    return null;
  }

  return (
    <div
      ref={requestContextMenuRef}
      className="fixed z-50 w-44 overflow-hidden rounded-lg border border-white/15 bg-[#1a1728] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{
        left: requestContextMenu.x,
        top: requestContextMenu.y,
      }}
    >
      {requestContextMenuTargetNode.type === "folder" && (
        <>
          <button
            type="button"
            onClick={() => createRequestInFolder(requestContextMenuTargetNode.id)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-violet-100 transition hover:bg-violet-500/20"
          >
            {t("requestMenu.newRequestHere")}
          </button>
          <button
            type="button"
            onClick={() => createFolderInFolder(requestContextMenuTargetNode.id)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-violet-100 transition hover:bg-violet-500/20"
          >
            {t("requestMenu.newFolderHere")}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() =>
          requestContextMenuTargetNode.type === "request"
            ? startEditingRequestName(
                requestContextMenuTargetNode.request.id,
                requestContextMenuTargetNode.request.name,
              )
            : startEditingFolderName(requestContextMenuTargetNode.id, requestContextMenuTargetNode.name)
        }
        className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-white/10"
      >
        {t("common.rename")}
      </button>
      <button
        type="button"
        onClick={() => deleteNode(requestContextMenuTargetNode.id)}
        className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-500/20"
      >
        {t("common.delete")}
      </button>
    </div>
  );
};
