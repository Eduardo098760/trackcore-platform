"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Loader2, Send, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { DashboardSummarySettings } from "@/types/dashboard-summary";
import {
  getDashboardSummarySettings,
  updateDashboardSummarySettings,
  dispatchDashboardSummary,
} from "@/lib/api/dashboard-summary";
import {
  KPI_REPORT_FREQUENCY_OPTIONS,
  KPI_REPORT_PERIOD_OPTIONS,
  type KPIReportFrequency,
  type KPIReportPeriod,
} from "@/types/kpi";

const WEEKDAY_OPTIONS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

interface DashboardSummaryScheduleCardProps {
  canManage: boolean;
  variant?: "card" | "embedded";
}

export function DashboardSummaryScheduleCard({ canManage, variant = "card" }: DashboardSummaryScheduleCardProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary-settings"],
    queryFn: getDashboardSummarySettings,
    enabled: canManage,
  });

  const settings = data?.settings;

  const saveMutation = useMutation({
    mutationFn: updateDashboardSummarySettings,
    onSuccess: (response) => {
      queryClient.setQueryData(["dashboard-summary-settings"], response);
      toast.success("Resumo programado salvo com sucesso.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Falha ao salvar o resumo programado.");
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: () => dispatchDashboardSummary({ force: true, currentUserOnly: true }),
    onSuccess: (response) => {
      const sent = response.results.find((item) => item.status === "sent");
      const skipped = response.results.find((item) => item.status === "skipped");
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary-settings"] });
      if (sent) {
        toast.success("Resumo da dashboard enviado para o seu email.");
        return;
      }
      toast.error(skipped?.message || "Nenhum resumo foi enviado.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Falha ao enviar resumo da dashboard.");
    },
  });

  const updateField = <K extends keyof DashboardSummarySettings>(field: K, value: DashboardSummarySettings[K]) => {
    if (!settings) return;
    saveMutation.mutate({ [field]: value } as Partial<DashboardSummarySettings>);
  };

  const lastStatus = useMemo(() => {
    if (!settings?.enabled) {
      return { label: "Opcional", variant: "secondary" as const };
    }

    return { label: "Agendado", variant: "default" as const };
  }, [settings?.enabled]);

  if (!canManage) {
    return null;
  }

  const content = isLoading || !settings ? (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" />
      Carregando configuração do resumo...
    </div>
  ) : (
    <>
      <div className="flex items-center justify-between rounded-xl border p-4">
        <div>
          <p className="text-sm font-medium">Receber resumo no meu email</p>
          <p className="text-xs text-muted-foreground">
            Quando ativo, o resumo vai somente para {settings.recipientEmail || "o email cadastrado na sua conta"}.
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(checked) => updateField("enabled", checked)}
          disabled={saveMutation.isPending}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Frequência</Label>
          <Select
            value={settings.frequency}
            onValueChange={(value) => updateField("frequency", value as KPIReportFrequency)}
            disabled={saveMutation.isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Frequência" />
            </SelectTrigger>
            <SelectContent>
              {KPI_REPORT_FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Período do resumo</Label>
          <Select
            value={settings.period}
            onValueChange={(value) => updateField("period", value as KPIReportPeriod)}
            disabled={saveMutation.isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {KPI_REPORT_PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Hora do envio</Label>
          <Input
            type="time"
            value={settings.deliveryTime}
            onChange={(event) => updateField("deliveryTime", event.target.value)}
            disabled={saveMutation.isPending}
          />
        </div>
      </div>

      {settings.frequency === "weekly" && (
        <div className="space-y-2 md:max-w-xs">
          <Label>Dia do envio semanal</Label>
          <Select
            value={String(settings.weeklyDay)}
            onValueChange={(value) => updateField("weeklyDay", Number(value))}
            disabled={saveMutation.isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Dia da semana" />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground flex items-center gap-2">
          <CalendarClock className="w-4 h-4" />
          Escopo do resumo
        </p>
        <p>O email usa os dados da sua dashboard: estatísticas operacionais atuais e KPIs personalizados habilitados no dashboard.</p>
        <p>O envio é individual. Ativar aqui não habilita resumo para outros gestores da organização.</p>
        {settings.lastSentAt && <p>Último envio: {new Date(settings.lastSentAt).toLocaleString("pt-BR")}</p>}
        {settings.nextRunAt && <p>Próximo envio previsto: {new Date(settings.nextRunAt).toLocaleString("pt-BR")}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => sendNowMutation.mutate()} disabled={sendNowMutation.isPending || !settings.recipientEmail}>
          {sendNowMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Enviar agora
        </Button>
      </div>
    </>
  );

  if (variant === "embedded") {
    return <div className="space-y-5">{content}</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Resumo Programado da Dashboard
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            O gestor habilita essa opção apenas na própria conta e recebe o panorama da dashboard no email cadastrado.
          </p>
        </div>
        <Badge variant={lastStatus.variant}>{lastStatus.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-5">{content}</CardContent>
    </Card>
  );
}
