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
import { dump, load } from "js-yaml";
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
} from "@/lib/collections";

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

export default function Home() {
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
  const [collectionMenu, setCollectionMenu] = useState<CollectionMenuState>(null);
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<DeleteCollectionTarget>(null);

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
        targetCollections.length === 1 ? ` da coleção "${targetCollections[0].name}"` : " das coleções";
      showFeedback("success", `Exportação em ${format.toUpperCase()}${scopeLabel} concluída.`);
    } catch {
      showFeedback("error", "Não foi possível exportar as coleções.");
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
      throw new Error("Selecione arquivos .json, .yaml ou .yml para importar.");
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
      throw new Error("Nenhuma coleção válida encontrada nos arquivos selecionados.");
    }

    const uniqueImported = ensureUniqueCollectionIds(importedCollections, collections);
    saveCollections([...uniqueImported, ...collections]);

    const ignoredMessage =
      ignoredFilesCount > 0 ? ` ${ignoredFilesCount} arquivo(s) incompatível(is) foram ignorados.` : "";
    showFeedback(
      "success",
      `${uniqueImported.length} coleção(ões) importada(s) com sucesso.${ignoredMessage}`,
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
      const message = error instanceof Error ? error.message : "Falha ao importar arquivo.";
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
    showFeedback("success", `Coleção "${deleteCollectionTarget.name}" deletada com sucesso.`);
    closeDeleteCollectionModal();
  };

  return (
    <main className="relative h-full overflow-auto bg-[#100e1a] px-6 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-white">Coleções</h1>
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
              Importar
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="rounded-xl bg-violet-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
            >
              Criar coleção
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

        <section className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {collections.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-zinc-300">
              Nenhuma coleção criada ainda.
            </div>
          )}

          {collections.map((collection) => {
            const requestCount = countRequestsInTree(collection.requestTree);
            const folderCount = countFoldersInTree(collection.requestTree);
            const environmentCount = collection.environments.length;

            return (
              <article
                key={collection.id}
                tabIndex={0}
                role="link"
                onClick={() => router.push(`/collections/${collection.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/collections/${collection.id}`);
                  }
                }}
                className="flex aspect-square cursor-pointer flex-col rounded-xl border border-white/10 bg-[#1a1728] p-3 text-white transition hover:border-violet-300/40 hover:bg-[#221f33] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-3 pr-2 text-lg font-extrabold leading-6 text-zinc-50">{collection.name}</h2>
                  <button
                    type="button"
                    onClick={(event) => openCollectionMenu(event, collection.id)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 bg-[#121025] text-sm text-zinc-300 transition hover:border-violet-300/45 hover:text-violet-100"
                    aria-label={`Opções da coleção ${collection.name}`}
                    title="Opções"
                  >
                    ⋯
                  </button>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <p className="font-medium text-cyan-200">
                    Criada em {new Date(collection.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="font-medium text-violet-200">
                    {environmentCount} ambiente(s)
                  </p>
                  <p className="font-medium text-amber-200">
                    {folderCount} pasta(s)
                  </p>
                  <p className="font-medium text-emerald-200">
                    {requestCount} request(s)
                  </p>
                </div>
                <div className="mt-auto pt-3 text-xs font-medium text-violet-200/80">Clique para abrir</div>
              </article>
            );
          })}
        </section>
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
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={() => {
              handleExport("yaml", [selectedMenuCollection]);
              setCollectionMenu(null);
            }}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-white/10"
          >
            Exportar YAML
          </button>
          <button
            type="button"
            onClick={() => handleDeleteCollection(selectedMenuCollection.id)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-500/20"
          >
            Deletar coleção
          </button>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={closeImportModal}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#1a1728] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white">Importar Coleções</h2>
            <p className="mt-1 text-sm text-zinc-300">
              Selecione arquivos manualmente. Formatos aceitos: JSON e YAML.
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
              <p className="text-base font-semibold text-zinc-100">Clique para escolher os arquivos</p>
              <p className="mt-2 text-sm text-zinc-400">Você pode selecionar múltiplos arquivos de uma vez.</p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeImportModal}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
              >
                Fechar
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
            <h1 className="text-lg font-semibold text-white">Nova coleção</h1>
            <p className="mt-1 text-sm text-zinc-300">Insira o nome da coleção.</p>

            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: API de pagamentos"
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
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
              >
                Criar
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteCollectionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1728] p-5">
            <h2 className="text-lg font-semibold text-white">Deletar coleção</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Tem certeza que deseja deletar{" "}
              <span className="font-semibold text-zinc-100">&quot;{deleteCollectionTarget.name}&quot;</span>?
            </p>
            <p className="mt-1 text-xs text-rose-200">Essa ação não pode ser desfeita.</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteCollectionModal}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteCollection}
                className="rounded-lg border border-rose-300/50 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
