"use client";

import { FormEvent, useEffect, useState } from "react";

type Collection = {
  id: string;
  name: string;
  createdAt: string;
};

const STORAGE_KEY = "apinaut.collections";

const loadCollections = (): Collection[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as Collection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function Home() {
  const [collections, setCollections] = useState<Collection[]>(loadCollections);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  }, [collections]);

  const handleCreateCollection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      return;
    }

    setCollections((current) => [
      {
        id: crypto.randomUUID(),
        name: cleanName,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);

    setName("");
    setIsModalOpen(false);
  };

  return (
    <main className="relative min-h-screen bg-[#100e1a] px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-white">Coleções</h1>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl bg-violet-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
          >
            Criar coleção
          </button>
        </div>

        <section className="space-y-3">
          {collections.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-zinc-300">
              Nenhuma coleção criada ainda.
            </div>
          )}

          {collections.map((collection) => (
            <article
              key={collection.id}
              className="rounded-xl border border-white/10 bg-[#1a1728] p-4 text-white"
            >
              <h2 className="text-base font-semibold">{collection.name}</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Criada em {new Date(collection.createdAt).toLocaleString("pt-BR")}
              </p>
            </article>
          ))}
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
