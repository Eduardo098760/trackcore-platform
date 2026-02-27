/**
 * Store em memória para rastreamento de links de compartilhamento ativos.
 * Persiste durante toda a execução do processo Node.js.
 */

export interface ActiveShare {
  shareId:    string;
  deviceId:   number;
  deviceName: string;
  plate:      string;
  createdAt:  number; // Unix ms
  expiresAt:  number; // Unix ms
  revoked:    boolean;
}

// Map module-level: persiste entre requests no mesmo processo
const store = new Map<string, ActiveShare>();

/** Registra um novo link de compartilhamento */
export function registerShare(share: Omit<ActiveShare, 'revoked'>): void {
  cleanupExpired();
  store.set(share.shareId, { ...share, revoked: false });
}

/** Revoga um link pelo shareId. Retorna false se não encontrado. */
export function revokeShare(shareId: string): boolean {
  const s = store.get(shareId);
  if (!s) return false;
  s.revoked = true;
  return true;
}

/** Verifica se um share foi revogado */
export function isRevoked(shareId: string): boolean {
  return store.get(shareId)?.revoked === true;
}

/** Lista shares ativos (não expirados e não revogados) de um dispositivo */
export function getSharesForDevice(deviceId: number): ActiveShare[] {
  cleanupExpired();
  const now = Date.now();
  return Array.from(store.values()).filter(
    s => s.deviceId === deviceId && !s.revoked && s.expiresAt > now,
  );
}

/** Lista todos os shares ativos de todos os dispositivos */
export function getAllActiveShares(): ActiveShare[] {
  cleanupExpired();
  const now = Date.now();
  return Array.from(store.values()).filter(s => !s.revoked && s.expiresAt > now);
}

/** Remove entradas expiradas do store */
function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, share] of store.entries()) {
    if (share.expiresAt < now) store.delete(id);
  }
}
