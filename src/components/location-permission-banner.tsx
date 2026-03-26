"use client";

import { useEffect, useState } from "react";
import { X, MapPin, Navigation } from "lucide-react";

const DISMISSED_KEY = "location-banner-dismissed";
const GRANTED_KEY = "location-permission-granted";
const DISMISS_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 dias

export function LocationPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    // Se já concedeu antes, não mostrar
    if (localStorage.getItem(GRANTED_KEY)) return;

    // Verificar se já tem permissão
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          localStorage.setItem(GRANTED_KEY, "1");
          return;
        }
        if (result.state === "denied") return;

        // Estado 'prompt' — mostrar banner
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DURATION) return;

        // Delay para não sobrecarregar com banners simultâneos
        setTimeout(() => setVisible(true), 8000);
      });
    } else {
      // Fallback: sempre mostrar se não dispensou
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DURATION) return;
      setTimeout(() => setVisible(true), 8000);
    }
  }, []);

  const handleEnable = () => {
    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        localStorage.setItem(GRANTED_KEY, "1");
        setVisible(false);
        setRequesting(false);
      },
      () => {
        setVisible(false);
        setRequesting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-[9997] w-80 animate-in slide-in-from-right-4 fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />

        <div className="p-4 pt-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-xl bg-emerald-500/10 p-2.5">
              <Navigation className="h-6 w-6 text-emerald-500" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground">Ativar Localização</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Veja a <strong>distância em tempo real</strong> entre você e seus veículos. Melhora
                a precisão do mapa e recursos de proximidade.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleEnable}
                  disabled={requesting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-[0.97] disabled:opacity-60"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {requesting ? "Ativando..." : "Permitir"}
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
