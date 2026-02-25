'use client';

import { Device, Position, Event } from '@/types';

type WebSocketMessage = 
  | { type: 'positions'; data: Position[] }
  | { type: 'devices'; data: Device[] }
  | { type: 'events'; data: Event[] };

type WebSocketCallback = (message: WebSocketMessage) => void;

/**
 * Deriva a URL do WebSocket do Traccar a partir da URL da API configurada.
 * Exemplos:
 *   http://localhost:8082/api  → ws://localhost:8082/api/socket
 *   https://meu-traccar.com/api → wss://meu-traccar.com/api/socket
 *   /api/traccar (proxy relativo) → ws://[hostname-atual]/api/traccar/socket
 */
function deriveTraccarWsUrl(): string {
  // 1. Variável explícita tem prioridade
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

  // 2. URL absoluta do Traccar (ex: http://localhost:8082/api)
  if (/^https?:\/\//i.test(apiUrl)) {
    const wsBase = apiUrl
      .replace(/^http:/i, 'ws:')
      .replace(/^https:/i, 'wss:')
      .replace(/\/api\/?$/, ''); // remove /api do final
    return `${wsBase}/api/socket`;
  }

  // 3. Proxy relativo (/api/traccar) → conecta no mesmo host via ws
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host  = window.location.host;
    const base  = apiUrl.replace(/\/+$/, '');
    return `${proto}//${host}${base}/socket`;
  }

  return 'ws://localhost:8082/api/socket';
}

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY_MS          = 2_000;
const MAX_DELAY_MS           = 60_000;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private callbacks: Set<WebSocketCallback> = new Set();
  private isManualClose  = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt        = 0;
  private _isConnected   = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (this.attempt >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WebSocket] Número máximo de tentativas atingido. Use o polling como fallback.');
      return;
    }

    this.isManualClose = false;
    const url = deriveTraccarWsUrl();

    try {
      console.debug(`[WebSocket] Conectando (tentativa ${this.attempt + 1}): ${url}`);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Conectado:', url);
        this._isConnected = true;
        this.attempt = 0; // reset backoff ao conectar
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          let message: WebSocketMessage | null = null;

          if (raw?.type === 'positions' && Array.isArray(raw.data)) {
            message = raw as WebSocketMessage;
          } else if (raw?.type === 'position' && raw.data) {
            message = { type: 'positions', data: Array.isArray(raw.data) ? raw.data : [raw.data] };
          } else if (raw?.type === 'devices' && Array.isArray(raw.data)) {
            message = raw as WebSocketMessage;
          } else if (raw?.type === 'events' && Array.isArray(raw.data)) {
            message = raw as WebSocketMessage;
          } else if (Array.isArray(raw) && raw[0]?.deviceId !== undefined) {
            message = { type: 'positions', data: raw };
          }

          if (message) {
            console.debug('[WebSocket] Mensagem recebida:', message.type, (message.data as any[]).length);
            this.callbacks.forEach(cb => cb(message!));
          }
        } catch (err) {
          console.error('[WebSocket] Erro ao processar mensagem:', err);
        }
      };

      this.ws.onerror = () => {
        // Browsers escondem detalhes do erro por segurança — o objeto sempre é {}
        // Usamos warn (não error) para não poluir o console como erro crítico
        if (this.attempt === 0) {
          console.warn(`[WebSocket] Falha ao conectar em ${url}. Usando polling como fallback.`);
        }
      };

      this.ws.onclose = (ev) => {
        this._isConnected = false;
        if (this.isManualClose) return;
        console.debug(`[WebSocket] Conexão encerrada (code=${ev.code}). Reagendando reconexão...`);
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('[WebSocket] Exceção ao criar conexão:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.isManualClose) return;
    if (this.attempt >= MAX_RECONNECT_ATTEMPTS) return;

    this.attempt++;
    // Backoff exponencial: 2s, 4s, 8s … até 60s
    const delay = Math.min(BASE_DELAY_MS * 2 ** (this.attempt - 1), MAX_DELAY_MS);
    console.debug(`[WebSocket] Reconectando em ${(delay / 1000).toFixed(0)}s (tentativa ${this.attempt}/${MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  disconnect() {
    this.isManualClose = true;
    this._isConnected  = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
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

  send(message: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Não conectado — mensagem descartada');
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
      send: () => {},
      isConnected: () => false,
    } as unknown as WebSocketClient;
  }

  if (!wsClient) {
    wsClient = new WebSocketClient();
  }

  return wsClient;
}
