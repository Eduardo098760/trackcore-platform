"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Device, Command } from "@/types";
import { formatDate } from "@/lib/utils";
import {
  Terminal,
  Lock,
  Unlock,
  MapPin,
  RotateCcw,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Send,
} from "lucide-react";

const COMMAND_LABELS: Record<string, { label: string; icon: typeof Terminal }> = {
  positionSingle: { label: "Solicitar Posição", icon: MapPin },
  engineResume: { label: "Bloquear Veículo", icon: Lock },
  engineStop: { label: "Desbloquear Veículo", icon: Unlock },
  rebootDevice: { label: "Reiniciar Rastreador", icon: RotateCcw },
  custom: { label: "Comando Personalizado", icon: FileText },
};

function getStatusBadge(status?: Command["status"]) {
  switch (status) {
    case "delivered":
    case "sent":
      return (
        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-[10px]">
          <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
          Enviado
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[10px]">
          <XCircle className="w-2.5 h-2.5 mr-0.5" />
          Falhou
        </Badge>
      );
    default:
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
          <Clock className="w-2.5 h-2.5 mr-0.5" />
          Pendente
        </Badge>
      );
  }
}

interface RecentCommandsProps {
  devices: Device[];
}

export function RecentCommands({ devices }: RecentCommandsProps) {
  const [commands, setCommands] = useState<Command[]>([]);

  useEffect(() => {
    function load() {
      try {
        const raw = localStorage.getItem("commandHistory");
        setCommands(raw ? JSON.parse(raw) : []);
      } catch {
        setCommands([]);
      }
    }
    load();
    // Atualiza quando há mudança no localStorage (outra aba ou dialog)
    window.addEventListener("storage", load);
    const interval = setInterval(load, 15_000);
    return () => {
      window.removeEventListener("storage", load);
      clearInterval(interval);
    };
  }, []);

  const devicesMap = useMemo(
    () => new Map(devices.map((d) => [d.id, d])),
    [devices],
  );

  const recent = commands.slice(0, 8);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Terminal className="w-5 h-5" />
          Comandos Recentes
        </CardTitle>
        <Link href="/commands">
          <Button variant="ghost" size="sm" className="text-xs">
            <Send className="w-3.5 h-3.5 mr-1" />
            Enviar
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Terminal className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhum comando enviado</p>
              <Link href="/commands">
                <Button variant="link" size="sm" className="mt-1 text-xs">
                  Enviar um comando
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((cmd) => {
                const device = devicesMap.get(cmd.deviceId);
                const meta = COMMAND_LABELS[cmd.type] || { label: cmd.type, icon: Terminal };
                const Icon = meta.icon;
                const vehicleLabel = device
                  ? `${device.name}${device.plate ? ` · ${device.plate}` : ""}`
                  : `Veículo #${cmd.deviceId}`;

                return (
                  <div
                    key={cmd.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                      <Icon className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{meta.label}</p>
                        {getStatusBadge(cmd.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate" title={vehicleLabel}>
                        {vehicleLabel}
                      </p>
                      {cmd.sentTime && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatDate(cmd.sentTime)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
