'use client';

import { Device, Position, Event } from '@/types';

type WebSocketMessage = 
  | { type: 'positions'; data: Position[] }
  | { type: 'devices'; data: Device[] }
  | { type: 'events'; data: Event[] };

type WebSocketCallback = (message: WebSocketMessage) => void;
type ConnectionCallback = (connected: boolean) => void;

/**
 * Deriva a URL do WebSocket do Traccar a partir da URL da API configurada.
 */
function deriveTraccarWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

  if (/^https?:\/\//i.test(apiUrl)) {
    const wsBase = apiUrl
      .replace(/^http:/i, 'ws:')
      .replace(/^https:/i, 'wss:')
      .replace(/\/api\/?$/, '');
    return `${wsBase}/api/socket`;
  }

  // Sem URL explícita: conecta diretamente via proxy path do Next.js rewrite
  // O WebSocket NÃO passa por rewrites do Next.js, então usa o mesmo host
  // com o path /api/traccar/socket que será redirecionado pelo servidor
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host  = window.location.host;
    return `${proto}//${host}/api/traccar/socket`;
  }

  return 'ws://localhost:8082/api/socket';
}

const BASE_DELAY_MS  = 1_500;
const MAX_DELAY_MS   = 30_000;
const HEARTBEAT_MS   = 25_000; // ping a cada 25s
const HEARTBEAT_TIMEOUT_MS = 10_000; // se não responder em 10s, reconecta

class WebSocketClient {
  private ws: WebSocket | null = null;
  private callbacks: Set<WebSocketCallback> = new Set();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();
  private isManualClose  = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private attempt        = 0;
  private _isConnected   = false;
  private _lastMessageTime = 0;
  private visibilityHandler: (() => void) | null = null;

  get lastMessageTime() { return this._lastMessageTime; }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.isManualClose = false;
    const url = deriveTraccarWsUrl();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this._isConnected = true;
        this._lastMessageTime = Date.now();
        this.attempt = 0;
        this.clearReconnectTimer();
        this.startHeartbeat();
        this.notifyConnectionChange(true);
        this.setupVisibilityHandler();
      };

      this.ws.onmessage = (event) => {
        this._lastMessageTime = Date.now();
        this.resetHeartbeatTimeout();

        try {
          const raw = JSON.parse(event.data);
          
          // Formato Traccar padrão: { positions: [...], devices: [...], events: [...] }
          if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            if (Array.isArray(raw.positions) && raw.positions.length > 0) {
              // Traccar envia speed em knots — normaliza para km/h
              const normalized = raw.positions.map((p: any) => ({
                ...p,
                speed: typeof p.speed === 'number' ? p.speed * 1.852 : p.speed,
              }));
              const msg: WebSocketMessage = { type: 'positions', data: normalized };
              this.callbacks.forEach(cb => cb(msg));
            }
            if (Array.isArray(raw.devices) && raw.devices.length > 0) {
              const msg: WebSocketMessage = { type: 'devices', data: raw.devices };
              this.callbacks.forEach(cb => cb(msg));
            }
            if (Array.isArray(raw.events) && raw.events.length > 0) {
              const msg: WebSocketMessage = { type: 'events', data: raw.events };
              this.callbacks.forEach(cb => cb(msg));
            }
          }
        } catch (err) {
          console.error('[WebSocket] Erro ao processar mensagem:', err);
        }
      };

      this.ws.onerror = () => {
        if (this.attempt === 0) {
          console.warn(`[WebSocket] Falha ao conectar em ${url}. Usando polling como fallback.`);
        }
      };

      this.ws.onclose = (ev) => {
        const wasConnected = this._isConnected;
        this._isConnected = false;
        this.stopHeartbeat();
        if (wasConnected) this.notifyConnectionChange(false);
        if (this.isManualClose) return;
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('[WebSocket] Exceção ao criar conexão:', err);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      // Se não recebemos nada há mais que o timeout, a conexão está morta
      if (Date.now() - this._lastMessageTime > HEARTBEAT_MS + HEARTBEAT_TIMEOUT_MS) {
        console.warn('[WebSocket] Sem resposta do servidor — reconectando');
        this.forceReconnect();
        return;
      }

      // Envia um ping (Traccar ignora mensagens desconhecidas, mas mantém a conexão viva)
      try {
        this.ws.send('{}');
      } catch {
        // no-op
      }

      // Seta timeout: se nenhuma mensagem chegar em HEARTBEAT_TIMEOUT_MS, reconecta
      this.heartbeatTimeout = setTimeout(() => {
        if (Date.now() - this._lastMessageTime > HEARTBEAT_TIMEOUT_MS) {
          console.warn('[WebSocket] Heartbeat timeout — reconectando');
          this.forceReconnect();
        }
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_MS);
  }

  private resetHeartbeatTimeout() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.resetHeartbeatTimeout();
  }

  private forceReconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      try { this.ws.close(); } catch { /* no-op */ }
      this.ws = null;
    }
    this._isConnected = false;
    this.notifyConnectionChange(false);
    this.attempt = 0; // reset para reconectar imediatamente
    this.scheduleReconnect();
  }

  private setupVisibilityHandler() {
    if (this.visibilityHandler) return;
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        // Voltou à aba: verifica se a conexão está viva
        if (!this.isConnected()) {
          this.attempt = 0;
          this.connect();
        } else if (Date.now() - this._lastMessageTime > HEARTBEAT_MS) {
          // Conexão parece viva mas não recebemos dados durante a ausência
          this.forceReconnect();
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.isManualClose) return;

    this.attempt++;
    // Backoff exponencial: 1.5s, 3s, 6s, 12s … até 30s
    const delay = Math.min(BASE_DELAY_MS * 2 ** (this.attempt - 1), MAX_DELAY_MS);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionCallbacks.forEach(cb => cb(connected));
  }

  disconnect() {
    this.isManualClose = true;
    this._isConnected  = false;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(callback: WebSocketCallback) {
    this.callbacks.add(callback);
    return () => { this.callbacks.delete(callback); };
  }

  onConnectionChange(callback: ConnectionCallback) {
    this.connectionCallbacks.add(callback);
    return () => { this.connectionCallbacks.delete(callback); };
  }

  send(message: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  isConnected(): boolean {
    return this._isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (typeof window === 'undefined') {
    return {
      connect: () => {},
      disconnect: () => {},
      subscribe: () => () => {},
      onConnectionChange: () => () => {},
      send: () => {},
      isConnected: () => false,
      lastMessageTime: 0,
    } as unknown as WebSocketClient;
  }

  if (!wsClient) {
    wsClient = new WebSocketClient();
  }

  return wsClient;
}
