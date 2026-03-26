"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isPwaInstalled } from "@/lib/pwa-utils";

/**
 * Registra o Service Worker e escuta mensagens de clique em notificações.
 * Em modo PWA, solicita permissão de notificações automaticamente.
 * Deve ser montado uma vez no layout raiz do dashboard.
 */
export function ServiceWorkerRegistrar() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Registrar o Service Worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[SW] Service Worker registrado:", reg.scope);

        // Em modo PWA, solicitar permissão de notificações automaticamente
        if (isPwaInstalled() && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().then((permission) => {
            console.log("[SW] Permissão de notificações (PWA):", permission);
          });
        }
      })
      .catch((err) => {
        console.warn("[SW] Falha ao registrar Service Worker:", err);
      });

    // Escutar mensagens do SW (ex: clique em notificação)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "NOTIFICATION_CLICK") {
        const url = event.data.url;
        if (url) {
          router.push(url);
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [router]);

  return null;
}
