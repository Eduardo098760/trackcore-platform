"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { getMaintenances } from "@/lib/api/maintenance";
import {
  Wrench,
  CalendarClock,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export function MaintenanceSummary() {
  const { data: maintenances = [], isLoading } = useQuery({
    queryKey: ["maintenances-dashboard"],
    queryFn: getMaintenances,
    refetchInterval: 120_000,
  });

  const counts = {
    scheduled: maintenances.filter((m) => m.status === "scheduled").length,
    overdue: maintenances.filter((m) => m.status === "overdue").length,
    inProgress: maintenances.filter((m) => m.status === "in_progress").length,
    completed: maintenances.filter((m) => m.status === "completed").length,
  };

  const upcoming = maintenances
    .filter((m) => m.status === "scheduled" || m.status === "overdue")
    .sort((a, b) => {
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    })
    .slice(0, 5);

  const statusConfig: Record<
    string,
    { label: string; className: string; icon: typeof Clock }
  > = {
    scheduled: {
      label: "Agendada",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      icon: CalendarClock,
    },
    overdue: {
      label: "Atrasada",
      className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      icon: AlertTriangle,
    },
    in_progress: {
      label: "Em Andamento",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      icon: Clock,
    },
    completed: {
      label: "Concluída",
      className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      icon: CheckCircle,
    },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Manutenções
        </CardTitle>
        <Link href="/maintenance">
          <Button variant="ghost" size="sm" className="text-xs">
            Ver todas
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {/* Status counters */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {(
            [
              { key: "scheduled", label: "Agendadas", color: "text-blue-500" },
              { key: "overdue", label: "Atrasadas", color: "text-red-500" },
              { key: "inProgress", label: "Em Andamento", color: "text-amber-500" },
              { key: "completed", label: "Concluídas", color: "text-green-500" },
            ] as const
          ).map(({ key, label, color }) => (
            <div
              key={key}
              className="text-center p-2 rounded-lg bg-muted/50"
            >
              <p className={`text-xl font-bold ${color}`}>
                {counts[key]}
              </p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Upcoming list */}
        <ScrollArea className="h-[200px] pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Wrench className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma manutenção pendente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((m) => {
                const cfg = statusConfig[m.status] || statusConfig.scheduled;
                const StatusIcon = cfg.icon;
                return (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-muted/60 shrink-0">
                      <StatusIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {m.description || "Manutenção"}
                        </p>
                        <Badge className={`${cfg.className} text-[10px] shrink-0`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {m.deviceName || `Veículo #${m.deviceId}`}
                      </p>
                      {m.scheduledDate && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatDate(m.scheduledDate)}
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
