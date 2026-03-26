/**
 * Utilitários para detectar modo PWA (standalone)
 */

/** Verifica se o app está rodando como PWA instalado (desktop/tablet) */
export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Chave para marcar que o PWA já foi autenticado pela primeira vez */
const PWA_AUTHED_KEY = "pwa-authenticated";

export function isPwaFirstLaunch(): boolean {
  if (!isPwaInstalled()) return false;
  return !localStorage.getItem(PWA_AUTHED_KEY);
}

export function markPwaAuthenticated(): void {
  localStorage.setItem(PWA_AUTHED_KEY, Date.now().toString());
}

export function clearPwaAuthenticated(): void {
  localStorage.removeItem(PWA_AUTHED_KEY);
}
