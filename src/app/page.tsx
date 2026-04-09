"use client";

import Link from "next/link";
import { FormEvent, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { dump, load } from "js-yaml";
import {
  Collection,
  createCollectionsExportPayload,
  countRequestsInTree,
  getCollectionsServerSnapshot,
  getCollectionsSnapshot,
  parseCollectionsData,
  saveCollections,
  subscribeCollections,
} from "@/lib/collections";

export default function Home() {
  const collections = useSyncExternalStore(
    subscribeCollections,
    getCollectionsSnapshot,
    getCollectionsServerSnapshot,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [ioFeedback, setIoFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setIoFeedback({ type, message });
  };

  const getExportFileName = (extension: "json" | "yaml") => {
    const datePart = new Date().toISOString().slice(0, 10);
    return `apinaut-collections-${datePart}.${extension}`;
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

  const handleExport = (format: "json" | "yaml") => {
    try {
      const payload = createCollectionsExportPayload(collections);

      if (format === "json") {
        triggerDownload(
          getExportFileName("json"),
          JSON.stringify(payload, null, 2),
          "application/json;charset=utf-8",
        );
      } else {
        triggerDownload(
          getExportFileName("yaml"),
          dump(payload, { noRefs: true }),
          "application/x-yaml;charset=utf-8",
        );
      }

      showFeedback("success", `Exportação em ${format.toUpperCase()} concluída.`);
    } catch {
      showFeedback("error", "Não foi possível exportar as coleções.");
    }
  };

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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const imported = parseImportedFileContent(content, file.name);

      if (!imported.length) {
        throw new Error("Nenhuma coleção válida encontrada no arquivo.");
      }

      const uniqueImported = ensureUniqueCollectionIds(imported, collections);
      saveCollections([...uniqueImported, ...collections]);
      showFeedback("success", `${uniqueImported.length} coleção(ões) importada(s) com sucesso.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao importar arquivo.";
      showFeedback("error", message);
    } finally {
      event.target.value = "";
    }
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
      },
      ...collections,
    ]);

    setName("");
    setIsModalOpen(false);
  };

  return (
    <main className="relative min-h-screen bg-[#100e1a] px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-white">Coleções</h1>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml,application/json,text/yaml,application/x-yaml,text/plain"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleImportClick}
              className="rounded-xl border border-white/15 bg-[#1a1728] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-[#221f33]"
            >
              Importar
            </button>
            <button
              type="button"
              onClick={() => handleExport("json")}
              className="rounded-xl border border-violet-300/40 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25"
            >
              Exportar JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport("yaml")}
              className="rounded-xl border border-violet-300/40 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25"
            >
              Exportar YAML
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

        <section className="space-y-3">
          {collections.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-zinc-300">
              Nenhuma coleção criada ainda.
            </div>
          )}

          {collections.map((collection) => {
            const requestCount = countRequestsInTree(collection.requestTree);

            return (
              <Link
                key={collection.id}
                href={`/collections/${collection.id}`}
                className="block rounded-xl border border-white/10 bg-[#1a1728] p-4 text-white transition hover:border-violet-300/40 hover:bg-[#221f33]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{collection.name}</h2>
                    <p className="mt-1 text-xs text-zinc-400">
                      Criada em {new Date(collection.createdAt).toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {requestCount} requisicao(oes)
                    </p>
                  </div>
                  <span className="text-sm text-zinc-300">Abrir</span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>

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
    </main>
  );
}
