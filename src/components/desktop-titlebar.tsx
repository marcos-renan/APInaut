"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Copy, Minus, X } from "lucide-react";

const TITLEBAR_HEIGHT_PX = 44;

export const DesktopTitleBar = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isElectronUserAgent = navigator.userAgent.toLowerCase().includes("electron");
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let bootstrapDesktopTimeout: ReturnType<typeof setTimeout> | null = null;

    if (isElectronUserAgent) {
      bootstrapDesktopTimeout = setTimeout(() => {
        setIsDesktop(true);
      }, 0);
    }

    const detectDesktop = () => {
      if (window.apinautDesktop?.isDesktop) {
        setIsDesktop(true);
        return;
      }

      if (attempts >= 20) {
        setIsDesktop(isElectronUserAgent);
        return;
      }

      attempts += 1;
      timeoutId = setTimeout(detectDesktop, 50);
    };

    detectDesktop();

    return () => {
      if (bootstrapDesktopTimeout) {
        clearTimeout(bootstrapDesktopTimeout);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    const desktopApi = window.apinautDesktop;

    document.body.classList.add("apinaut-desktop");

    if (!desktopApi) {
      return () => {
        document.body.classList.remove("apinaut-desktop");
      };
    }

    desktopApi
      .isMaximized()
      .then((value) => setIsMaximized(Boolean(value)))
      .catch(() => setIsMaximized(false));

    const unsubscribe = desktopApi.onMaximizeChange((value) => {
      setIsMaximized(value);
    });

    return () => {
      unsubscribe();
      document.body.classList.remove("apinaut-desktop");
    };
  }, [isDesktop]);

  if (!isDesktop) {
    return null;
  }

  return (
    <header
      className="apinaut-titlebar fixed inset-x-0 top-0 z-[90] flex items-center border-b border-white/10 bg-[#151225]/95 backdrop-blur"
      style={{
        height: `${TITLEBAR_HEIGHT_PX}px`,
      }}
    >
      <div className="flex items-center gap-2 pl-3">
        <Image
          src="/apinaut-logo.png"
          alt="APInaut"
          width={24}
          height={24}
          className="h-6 w-6 rounded-sm object-contain"
          priority
        />
        <span className="text-sm font-semibold text-zinc-100">APInaut</span>
      </div>

      <div className="apinaut-titlebar-no-drag ml-auto flex items-stretch">
        <button
          type="button"
          onClick={() => window.apinautDesktop?.minimize()}
          className="inline-flex h-11 w-14 items-center justify-center text-zinc-200 transition hover:bg-white/10"
          aria-label="Minimizar"
          title="Minimizar"
        >
          <Minus className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => window.apinautDesktop?.toggleMaximize()}
          className="inline-flex h-11 w-14 items-center justify-center text-zinc-200 transition hover:bg-white/10"
          aria-label={isMaximized ? "Restaurar" : "Maximizar"}
          title={isMaximized ? "Restaurar" : "Maximizar"}
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => window.apinautDesktop?.close()}
          className="inline-flex h-11 w-14 items-center justify-center text-rose-100 transition hover:bg-rose-500/85"
          aria-label="Fechar"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};
