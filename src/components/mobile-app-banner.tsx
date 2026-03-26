"use client";

import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";

const DISMISSED_KEY = "mobile-app-banner-dismissed";
const DISMISS_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 dias

const APP_STORE_URL = "https://apps.apple.com/br/app/rastrear-telemetria-iot/id6698845713";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.gps.rastrear";
const DOWNLOAD_PAGE = "https://www.rastrear.tec.br/download";

function detectMobilePlatform(): "ios" | "android" | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return null;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export function MobileAppBanner() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    // Não mostrar se já está em modo standalone (PWA instalado)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Só mostrar em mobile
    if (!isMobileDevice()) return;

    // Não mostrar se foi dispensado recentemente
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DURATION) return;

    setPlatform(detectMobilePlatform());
    setVisible(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  };

  const getStoreUrl = () => {
    if (platform === "ios") return APP_STORE_URL;
    if (platform === "android") return PLAY_STORE_URL;
    return DOWNLOAD_PAGE;
  };

  const getStoreLabel = () => {
    if (platform === "ios") return "App Store";
    if (platform === "android") return "Google Play";
    return "Download";
  };

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] animate-in slide-in-from-top-4 fade-in duration-500">
      <div className="bg-gradient-to-r from-blue-600 via-primary to-blue-500 text-white shadow-lg">
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-3">
            {/* App icon */}
            <div className="flex-shrink-0 rounded-xl bg-white/20 backdrop-blur-sm p-2">
              <Smartphone className="h-6 w-6 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight">App Rastrear</h3>
              <p className="text-[11px] text-white/80 leading-tight mt-0.5">
                Melhor experiência no app nativo. Grátis!
              </p>
            </div>

            {/* CTA */}
            <a
              href={getStoreUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDismiss}
              className="flex-shrink-0 rounded-lg bg-white px-3.5 py-1.5 text-xs font-bold text-blue-600 shadow-sm transition-all active:scale-[0.97]"
            >
              {getStoreLabel()}
            </a>

            {/* Close */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 rounded-full p-1 text-white/70 transition-colors hover:text-white hover:bg-white/10"
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
