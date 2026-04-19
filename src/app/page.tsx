"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { dump, load } from "js-yaml";
import { useI18n } from "@/components/language-provider";
import {
  Collection,
  RequestTreeNode,
  createCollectionsExportPayload,
  countRequestsInTree,
  getCollectionsServerSnapshot,
  getCollectionsSnapshot,
  parseCollectionsData,
  saveCollections,
  subscribeCollections,
  updateCollections,
} from "@/lib/collections";
import { reorderItemsById } from "@/lib/request-page-helpers";

type CollectionMenuState = {
  collectionId: string;
  x: number;
  y: number;
} | null;

type DeleteCollectionTarget = {
  id: string;
  name: string;
} | null;

const COLLECTION_MENU_WIDTH = 172;
const COLLECTION_MENU_HEIGHT = 124;
const MENU_VIEWPORT_PADDING = 8;

const countFoldersInTree = (nodes: RequestTreeNode[]): number => {
  let count = 0;

  const walk = (items: RequestTreeNode[]) => {
    for (const item of items) {
      if (item.type === "folder") {
        count += 1;
        walk(item.children);
      }
    }
  };

  walk(nodes);
  return count;
};

type DraggableCollectionCardProps = {
  id: string;
  name: string;
  createdOnLabel: string;
  environmentsLabel: string;
  foldersLabel: string;
  requestsLabel: string;
  openHintLabel: string;
  optionsLabel: string;
  activeDragCollectionId: string | null;
  onOpenCollection: (collectionId: string) => void;
  onOpenCollectionMenu: (event: ReactMouseEvent<HTMLButtonElement>, collectionId: string) => void;
};

const DraggableCollectionCard = ({
  id,
  name,
  createdOnLabel,
  environmentsLabel,
  foldersLabel,
  requestsLabel,
  openHintLabel,
  optionsLabel,
  activeDragCollectionId,
  onOpenCollection,
  onOpenCollectionMenu,
}: DraggableCollectionCardProps) => {
  const {
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
  });
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id,
  });

  const setCombinedNodeRef = (element: HTMLElement | null) => {
    setDraggableNodeRef(element);
    setDroppableNodeRef(element);
  };

  const cardStyle = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.82 : 1,
  };
  const isDropTarget = Boolean(activeDragCollectionId) && activeDragCollectionId !== id && isOver;

  return (
    <article
      ref={setCombinedNodeRef}
      style={cardStyle}
      tabIndex={0}
      role="link"
      onClick={() => onOpenCollection(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenCollection(id);
        }
      }}
      className={`flex aspect-square cursor-pointer flex-col rounded-xl border bg-[#1a1728] p-3 text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 ${
        isDropTarget
          ? "border-violet-300/80 bg-[#26203b]"
          : "border-white/10 hover:border-violet-300/40 hover:bg-[#221f33]"
      }`}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="line-clamp-3 pr-2 text-lg font-extrabold leading-6 text-zinc-50">{name}</h2>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => onOpenCollectionMenu(event, id)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 bg-[#121025] text-sm text-zinc-300 transition hover:border-violet-300/45 hover:text-violet-100"
          aria-label={`${optionsLabel} ${name}`}
          title={optionsLabel}
        >
          ⋯
        </button>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <p className="font-medium text-cyan-200">{createdOnLabel}</p>
        <p className="font-medium text-violet-200">{environmentsLabel}</p>
        <p className="font-medium text-amber-200">{foldersLabel}</p>
        <p className="font-medium text-emerald-200">{requestsLabel}</p>
      </div>
      <div className="mt-auto pt-3 text-xs font-medium text-violet-200/80">{openHintLabel}</div>
    </article>
  );
};

export default function Home() {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const collections = useSyncExternalStore(
    subscribeCollections,
    getCollectionsSnapshot,
    getCollectionsServerSnapshot,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [ioFeedback, setIoFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const collectionMenuRef = useRef<HTMLDivElement | null>(null);
  const suppressCollectionOpenAfterDragRef = useRef(false);
  const [collectionMenu, setCollectionMenu] = useState<CollectionMenuState>(null);
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<DeleteCollectionTarget>(null);
  const [activeDragCollectionId, setActiveDragCollectionId] = useState<string | null>(null);
  const collectionDndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const suppressCollectionOpenAfterDrag = () => {
    suppressCollectionOpenAfterDragRef.current = true;
    window.setTimeout(() => {
      suppressCollectionOpenAfterDragRef.current = false;
    }, 180);
  };

  const openCollectionFromCard = (collectionId: string) => {
    if (suppressCollectionOpenAfterDragRef.current) {
      return;
    }

    router.push(`/collections/${collectionId}`);
  };

  const handleCollectionDragStart = (event: DragStartEvent) => {
    setActiveDragCollectionId(String(event.active.id));
    suppressCollectionOpenAfterDrag();
  };

  const handleCollectionDragCancel = () => {
    setActiveDragCollectionId(null);
    suppressCollectionOpenAfterDrag();
  };

  const handleCollectionDragEnd = (event: DragEndEvent) => {
    const sourceCollectionId = String(event.active.id);
    const targetCollectionId = event.over?.id ? String(event.over.id) : null;

    setActiveDragCollectionId(null);
    suppressCollectionOpenAfterDrag();

    if (!targetCollectionId || sourceCollectionId === targetCollectionId) {
      return;
    }

    updateCollections((current) =>
      reorderItemsById(current, sourceCollectionId, targetCollectionId),
    );
  };

  const showFeedback = (type: "success" | "error", message: string) => {
    setIoFeedback({ type, message });
  };

  const sanitizeFileSegment = (value: string) => {
    const clean = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return clean || "collection";
  };

  const getExportFileName = (baseName: string, extension: "json" | "yaml") => {
    const datePart = new Date().toISOString().slice(0, 10);
    return `${baseName}-${datePart}.${extension}`;
  };

  const triggerDownload = (fileName: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: "json" | "yaml", targetCollections: Collection[] = collections) => {
    try {
      const payload = createCollectionsExportPayload(targetCollections);
      const fileBaseName =
        targetCollections.length === 1
          ? `apinaut-${sanitizeFileSegment(targetCollections[0].name)}`
          : "apinaut-collections";

      if (format === "json") {
        triggerDownload(
          getExportFileName(fileBaseName, "json"),
          JSON.stringify(payload, null, 2),
          "application/json;charset=utf-8",
        );
      } else {
        triggerDownload(
          getExportFileName(fileBaseName, "yaml"),
          dump(payload, { noRefs: true }),
          "application/x-yaml;charset=utf-8",
        );
      }

      const scopeLabel =
        targetCollections.length === 1
          ? t("home.feedback.exportSuccessSingle", {
              format: format.toUpperCase(),
              name: targetCollections[0].name,
            })
          : t("home.feedback.exportSuccessAll", {
              format: format.toUpperCase(),
            });
      showFeedback("success", scopeLabel);
    } catch {
      showFeedback("error", t("home.feedback.exportError"));
    }
  };

  const openCollectionMenu = (event: ReactMouseEvent<HTMLButtonElement>, collectionId: string) => {
    event.preventDefault();
    event.stopPropagation();

    const x = Math.max(
      MENU_VIEWPORT_PADDING,
      Math.min(event.clientX, window.innerWidth - COLLECTION_MENU_WIDTH - MENU_VIEWPORT_PADDING),
    );
    const y = Math.max(
      MENU_VIEWPORT_PADDING,
      Math.min(event.clientY, window.innerHeight - COLLECTION_MENU_HEIGHT - MENU_VIEWPORT_PADDING),
    );

    setCollectionMenu({
      collectionId,
      x,
      y,
    });
  };

  useEffect(() => {
    if (!collectionMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        collectionMenuRef.current &&
        event.target instanceof Node &&
        collectionMenuRef.current.contains(event.target)
      ) {
        return;
      }

      setCollectionMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCollectionMenu(null);
      }
    };

    const handleScroll = () => {
      setCollectionMenu(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [collectionMenu]);

  const selectedMenuCollection = useMemo(
    () =>
      collectionMenu ? collections.find((collection) => collection.id === collectionMenu.collectionId) ?? null : null,
    [collectionMenu, collections],
  );

  const ensureUniqueCollectionIds = (items: Collection[], existing: Collection[]) => {
    const seenIds = new Set(existing.map((collection) => collection.id));

    return items.map((collection) => {
      let nextId = collection.id;

      while (!nextId || seenIds.has(nextId)) {
        nextId = crypto.randomUUID();
      }

      seenIds.add(nextId);

      return {
        ...collection,
        id: nextId,
      };
    });
  };

  const parseImportedFileContent = (textContent: string, fileName: string) => {
    const lowerName = fileName.toLowerCase();
    const isJsonByName = lowerName.endsWith(".json");
    const isYamlByName = lowerName.endsWith(".yaml") || lowerName.endsWith(".yml");

    if (isJsonByName) {
      return parseCollectionsData(JSON.parse(textContent));
    }

    if (isYamlByName) {
      return parseCollectionsData(load(textContent));
    }

    try {
      return parseCollectionsData(JSON.parse(textContent));
    } catch {
      return parseCollectionsData(load(textContent));
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
  };

  const importCollectionsFromFiles = async (inputFiles: File[]) => {
    const supportedFiles = inputFiles.filter((file) => {
      const lowerName = file.name.toLowerCase();
      return lowerName.endsWith(".json") || lowerName.endsWith(".yaml") || lowerName.endsWith(".yml");
    });

    if (supportedFiles.length === 0) {
      throw new Error(t("home.feedback.importUnsupported"));
    }

    const importedCollections: Collection[] = [];
    let ignoredFilesCount = 0;

    for (const file of supportedFiles) {
      try {
        const content = await file.text();
        const parsedCollections = parseImportedFileContent(content, file.name);

        if (!parsedCollections.length) {
          ignoredFilesCount += 1;
          continue;
        }

        importedCollections.push(...parsedCollections);
      } catch {
        ignoredFilesCount += 1;
      }
    }

    if (importedCollections.length === 0) {
      throw new Error(t("home.feedback.importNone"));
    }

    const uniqueImported = ensureUniqueCollectionIds(importedCollections, collections);
    saveCollections([...uniqueImported, ...collections]);

    const ignoredMessage =
      ignoredFilesCount > 0 ? t("home.feedback.importIgnored", { count: ignoredFilesCount }) : "";
    showFeedback(
      "success",
      `${t("home.feedback.importSuccess", { count: uniqueImported.length })}${ignoredMessage}`,
    );
    closeImportModal();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];

    if (files.length === 0) {
      return;
    }

    try {
      await importCollectionsFromFiles(files);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("home.feedback.importFailed");
      showFeedback("error", message);
    } finally {
      event.target.value = "";
    }
  };

  const handleOpenFilePicker = () => {
    importFileInputRef.current?.click();
  };

  const handleCreateCollection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      return;
    }

    saveCollections([
      {
        id: crypto.randomUUID(),
        name: cleanName,
        createdAt: new Date().toISOString(),
        requestTree: [],
        environments: [],
        activeEnvironmentId: null,
        lastActiveRequestId: null,
      },
      ...collections,
    ]);

    setName("");
    setIsModalOpen(false);
  };

  const handleDeleteCollection = (collectionId: string) => {
    const target = collections.find((collection) => collection.id === collectionId);

    if (!target) {
      return;
    }

    setDeleteCollectionTarget({
      id: target.id,
      name: target.name,
    });
    setCollectionMenu(null);
  };

  const closeDeleteCollectionModal = () => {
    setDeleteCollectionTarget(null);
  };

  const confirmDeleteCollection = () => {
    if (!deleteCollectionTarget) {
      return;
    }

    saveCollections(collections.filter((collection) => collection.id !== deleteCollectionTarget.id));
    showFeedback("success", t("home.feedback.deleteSuccess", { name: deleteCollectionTarget.name }));
    closeDeleteCollectionModal();
  };

  return (
    <main className="relative h-full overflow-auto bg-[#100e1a] px-6 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-white">{t("home.title")}</h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              ref={importFileInputRef}
              type="file"
              multiple
              accept=".json,.yaml,.yml,application/json,text/yaml,application/x-yaml,text/plain"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="rounded-xl border border-white/15 bg-[#1a1728] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-[#221f33]"
            >
              {t("home.import")}
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="rounded-xl bg-violet-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
            >
              {t("home.createCollection")}
            </button>
          </div>
        </div>

        {ioFeedback && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              ioFeedback.type === "success"
                ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                : "border-rose-300/35 bg-rose-500/10 text-rose-100"
            }`}
          >
            {ioFeedback.message}
          </div>
        )}

        <DndContext
          sensors={collectionDndSensors}
          onDragStart={handleCollectionDragStart}
          onDragCancel={handleCollectionDragCancel}
          onDragEnd={handleCollectionDragEnd}
        >
          <section className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
            {collections.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-zinc-300">
                {t("home.none")}
              </div>
            )}

            {collections.map((collection) => {
              const requestCount = countRequestsInTree(collection.requestTree);
              const folderCount = countFoldersInTree(collection.requestTree);
              const environmentCount = collection.environments.length;

              return (
                <DraggableCollectionCard
                  key={collection.id}
                  id={collection.id}
                  name={collection.name}
                  createdOnLabel={t("home.createdOn", { date: formatDate(collection.createdAt) })}
                  environmentsLabel={t("home.environments", { count: environmentCount })}
                  foldersLabel={t("home.folders", { count: folderCount })}
                  requestsLabel={t("home.requests", { count: requestCount })}
                  openHintLabel={t("home.clickToOpen")}
                  optionsLabel={t("home.options")}
                  activeDragCollectionId={activeDragCollectionId}
                  onOpenCollection={openCollectionFromCard}
                  onOpenCollectionMenu={openCollectionMenu}
                />
              );
            })}
          </section>
        </DndContext>
      </div>

      {collectionMenu && selectedMenuCollection && (
        <div
          ref={collectionMenuRef}
          className="fixed z-40 w-44 overflow-hidden rounded-lg border border-white/15 bg-[#1a1728] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          style={{
            left: collectionMenu.x,
            top: collectionMenu.y,
          }}
        >
          <button
            type="button"
            onClick={() => {
              handleExport("json", [selectedMenuCollection]);
              setCollectionMenu(null);
            }}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-white/10"
          >
            {t("home.exportJson")}
          </button>
          <button
            type="button"
            onClick={() => {
              handleExport("yaml", [selectedMenuCollection]);
              setCollectionMenu(null);
            }}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-white/10"
          >
            {t("home.exportYaml")}
          </button>
          <button
            type="button"
            onClick={() => handleDeleteCollection(selectedMenuCollection.id)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-500/20"
          >
            {t("home.deleteCollection")}
          </button>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={closeImportModal}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#1a1728] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white">{t("home.importModal.title")}</h2>
            <p className="mt-1 text-sm text-zinc-300">
              {t("home.importModal.description")}
            </p>

            <div
              onClick={handleOpenFilePicker}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpenFilePicker();
                }
              }}
              className="mt-5 min-h-[240px] cursor-pointer rounded-xl border border-dashed border-white/20 bg-[#121025] p-10 text-center transition hover:border-violet-300/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            >
              <p className="text-base font-semibold text-zinc-100">{t("home.importModal.dropTitle")}</p>
              <p className="mt-2 text-sm text-zinc-400">{t("home.importModal.dropDescription")}</p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeImportModal}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-6">
          <form
            onSubmit={handleCreateCollection}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1728] p-5"
          >
            <h1 className="text-lg font-semibold text-white">{t("home.newCollection.title")}</h1>
            <p className="mt-1 text-sm text-zinc-300">{t("home.newCollection.description")}</p>

            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("home.newCollection.placeholder")}
              className="mt-4 h-11 w-full rounded-lg border border-white/15 bg-[#100e1a] px-3 text-sm text-white outline-none ring-violet-400 transition focus:ring-2"
              required
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setName("");
                }}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
              >
                {t("common.create")}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteCollectionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1728] p-5">
            <h2 className="text-lg font-semibold text-white">{t("home.deleteModal.title")}</h2>
            <p className="mt-2 text-sm text-zinc-300">
              {t("home.deleteModal.confirm", { name: deleteCollectionTarget.name })}
            </p>
            <p className="mt-1 text-xs text-rose-200">{t("home.deleteModal.warning")}</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteCollectionModal}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDeleteCollection}
                className="rounded-lg border border-rose-300/50 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
