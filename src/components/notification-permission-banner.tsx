"use client";

import { useEffect, useState } from "react";
import { X, Bell, BellRing } from "lucide-react";

const DISMISSED_KEY = "notification-banner-dismissed";
const DISMISS_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 dias

export function NotificationPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DURATION) return;

    // Mostrar após 5s para não sobrecarregar o usuário no login
    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        // Mostrar notificação de confirmação
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SHOW_NOTIFICATION",
            payload: {
              title: "🔔 Notificações ativadas!",
              body: "Você receberá alertas de eventos da sua frota em tempo real.",
              tag: "notification-enabled",
              icon: "/logos/rastrear-icone-light.png",
              badge: "/logos/rastrear-icone-light.png",
            },
          });
        }
      }
      setVisible(false);
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-[9998] w-80 animate-in slide-in-from-right-4 fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

        <div className="p-4 pt-5">
          <div className="flex items-start gap-3">
            {/* Animated bell icon */}
            <div className="flex-shrink-0 rounded-xl bg-amber-500/10 p-2.5">
              <BellRing className="h-6 w-6 text-amber-500 animate-[wiggle_1s_ease-in-out_3]" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground">Ativar Notificações</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Receba alertas de <strong>excesso de velocidade</strong>,{" "}
                <strong>cercas geográficas</strong>,<strong> dispositivos offline</strong> e mais —
                mesmo com o navegador em segundo plano.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleEnable}
                  disabled={requesting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition-all hover:bg-amber-600 active:scale-[0.97] disabled:opacity-60"
                >
                  <Bell className="h-3.5 w-3.5" />
                  {requesting ? "Ativando..." : "Ativar"}
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Depois
                </button>
              </div>
            </div>

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
