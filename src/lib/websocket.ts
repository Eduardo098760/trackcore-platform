'use client';

import { Device, Position, Event } from '@/types';

type WebSocketMessage = 
  | { type: 'positions'; data: Position[] }
  | { type: 'devices'; data: Device[] }
  | { type: 'events'; data: Event[] };

type WebSocketCallback = (message: WebSocketMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private callbacks: Set<WebSocketCallback> = new Set();
  private isManualClose: boolean = false;

  constructor(url: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001') {
    this.url = url;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isManualClose = false;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);

          // Normalize different message shapes to our WebSocketMessage union
          let message: any = raw;

          // If server sends a single position under type 'position', normalize to 'positions'
          if (raw && raw.type === 'position' && raw.data) {
            message = { type: 'positions', data: Array.isArray(raw.data) ? raw.data : [raw.data] };
          }

          // If server sends raw array of positions
          else if (Array.isArray(raw) && raw.length && raw[0] && raw[0].deviceId !== undefined) {
            message = { type: 'positions', data: raw };
          }

          // Debug log to help diagnose why updates may not arrive
          try { console.debug('WS message received:', message.type || typeof message, message); } catch (e) {}

          this.callbacks.forEach(callback => callback(message));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      this.connect();
    }, this.reconnectInterval);
  }

  disconnect() {
    this.isManualClose = true;
    
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
    return () => {
      this.callbacks.delete(callback);
    };
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (typeof window === 'undefined') {
    // Return a mock client for SSR
    return {
      connect: () => {},
      disconnect: () => {},
      subscribe: () => () => {},
      send: () => {},
      isConnected: () => false,
    } as any;
  }

  if (!wsClient) {
    wsClient = new WebSocketClient();
  }

  return wsClient;
}
