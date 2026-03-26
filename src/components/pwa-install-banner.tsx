"use client";

import { useEffect, useState } from "react";
import { X, Download, Monitor } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Não mostrar se já está instalado como PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Não mostrar se foi dispensado recentemente
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DURATION) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-lg animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Gradient accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-primary to-blue-400" />

        <div className="p-4 pt-5">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 rounded-xl bg-primary/10 p-2.5">
              <Monitor className="h-6 w-6 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground">Instalar Rastrear</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acesse mais rápido direto da sua área de trabalho, como um aplicativo nativo.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  {installing ? "Instalando..." : "Instalar App"}
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Agora não
                </button>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
