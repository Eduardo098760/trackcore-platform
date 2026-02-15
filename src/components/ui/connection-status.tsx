"use client";

import { useConnectionStatus } from '@/lib/hooks/useConnectionStatus';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';

export function ConnectionStatus() {
  const { isOnline, lastCheck, error } = useConnectionStatus();

  return (
    <Badge
      variant={isOnline ? "default" : "destructive"}
      className="flex items-center gap-1.5 cursor-default"
      title={
        isOnline
          ? `Conectado ao servidor\nÚltima verificação: ${lastCheck?.toLocaleTimeString()}`
          : `Desconectado do servidor\n${error || 'Sem conexão'}\nÚltima tentativa: ${lastCheck?.toLocaleTimeString()}`
      }
    >
      {isOnline ? (
        <>
          <Wifi className="h-3 w-3" />
          <span className="text-xs">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span className="text-xs">Offline</span>
        </>
      )}
    </Badge>
  );
}
