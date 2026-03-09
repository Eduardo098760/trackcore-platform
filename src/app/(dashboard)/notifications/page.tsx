"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDevices } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  Search,
  Volume2,
  VolumeX,
  Car,
  X,
  ChevronDown,
  Power,
  PowerOff,
  MapPin,
  Zap,
  Activity,
  BatteryLow,
  Wrench,
  Siren,
  Gauge,
  Info,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ─── Tipos ───────────────────────────────────────

interface NotificationSettings {
  inApp: { enabled: boolean; sound: boolean; desktop: boolean };
  email: { enabled: boolean; address: string; frequency: "instant" | "hourly" | "daily" };
  sms: { enabled: boolean; phone: string };
  push: { enabled: boolean };
  events: Record<string, boolean>;
  eventDevices: Record<string, number[]>; // vazio = todos; com ids = específicos
}

// ─── Catálogo de tipos de evento ─────────────────

const EVENT_CATALOG: Record<string, { label: string; icon: React.ElementType; color: string; iconColor: string }> = {
  speedLimit:    { label: "Excesso de Velocidade",  icon: Gauge,      color: "text-amber-500",    iconColor: "text-amber-500" },
  geofenceEnter: { label: "Entrada em Cerca",       icon: MapPin,     color: "text-blue-500",     iconColor: "text-blue-500" },
  geofenceExit:  { label: "Saída de Cerca",         icon: MapPin,     color: "text-orange-500",   iconColor: "text-orange-500" },
  ignitionOn:    { label: "Ignição Ligada",          icon: Zap,        color: "text-emerald-500",  iconColor: "text-emerald-500" },
  ignitionOff:   { label: "Ignição Desligada",       icon: Zap,        color: "text-slate-400",    iconColor: "text-slate-400" },
  deviceOffline: { label: "Dispositivo Offline",     icon: PowerOff,   color: "text-red-500",      iconColor: "text-red-500" },
  deviceOnline:  { label: "Dispositivo Online",      icon: Power,      color: "text-emerald-500",  iconColor: "text-emerald-500" },
  deviceMoving:  { label: "Dispositivo em Movimento", icon: Activity,  color: "text-blue-500",     iconColor: "text-blue-500" },
  deviceStopped: { label: "Dispositivo Parado",      icon: Info,       color: "text-slate-400",    iconColor: "text-slate-400" },
  lowBattery:    { label: "Bateria Fraca",           icon: BatteryLow, color: "text-amber-500",    iconColor: "text-amber-500" },
  maintenance:   { label: "Manutenção",              icon: Wrench,     color: "text-blue-500",     iconColor: "text-blue-500" },
  sos:           { label: "SOS / Emergência",        icon: Siren,      color: "text-red-500",      iconColor: "text-red-500" },
};

// ─── Storage helpers ─────────────────────────────

const DEFAULT_SETTINGS: NotificationSettings = {
  inApp: { enabled: true, sound: true, desktop: false },
  email: { enabled: false, address: "", frequency: "instant" },
  sms: { enabled: false, phone: "" },
  push: { enabled: false },
  events: {},
  eventDevices: {},
};

function loadSettings(): NotificationSettings {
  try {
    const stored = localStorage.getItem("notificationSettings");
    if (!stored) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      inApp: { ...DEFAULT_SETTINGS.inApp, ...parsed.inApp },
      email: { ...DEFAULT_SETTINGS.email, ...parsed.email },
      sms: { ...DEFAULT_SETTINGS.sms, ...parsed.sms },
      push: { ...DEFAULT_SETTINGS.push, ...parsed.push },
      events: parsed.events ?? {},
      eventDevices: parsed.eventDevices ?? {},
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: NotificationSettings) {
  localStorage.setItem("notificationSettings", JSON.stringify(settings));
  // Sync rules format for compatibility
  syncRulesFormat(settings);
  // Sync vehicle-specific rules to vehicleNotifRulesV2 (bidirectional with vehicle panel)
  syncToVehicleNotifRules(settings);
}

/**
 * Sincroniza eventDevices da central para vehicleNotifRulesV2,
 * garantindo que regras criadas aqui apareçam no painel do veículo.
 */
function syncToVehicleNotifRules(settings: NotificationSettings) {
  try {
    const stored = localStorage.getItem('vehicleNotifRulesV2');
    const all: Record<string, Array<{ id: string; eventType: string; sound: boolean; createdAt: string }>> =
      stored ? JSON.parse(stored) : {};

    for (const [eventType, deviceIds] of Object.entries(settings.eventDevices)) {
      if (!settings.events[eventType]) continue;
      for (const deviceId of deviceIds) {
        const key = String(deviceId);
        const existing = all[key] || [];
        const hasRule = existing.some(r => r.eventType === eventType);
        if (!hasRule) {
          existing.push({
            id: `${deviceId}-${eventType}-${Date.now()}`,
            eventType,
            sound: settings.inApp?.sound ?? true,
            createdAt: new Date().toISOString(),
          });
          all[key] = existing;
        }
      }
    }

    localStorage.setItem('vehicleNotifRulesV2', JSON.stringify(all));
  } catch {}
}

function syncRulesFormat(settings: NotificationSettings) {
  try {
    const rules = Object.entries(settings.events)
      .filter(([, enabled]) => enabled)
      .map(([eventType]) => ({
        id: `rule-${eventType}`,
        eventType,
        deviceIds: settings.eventDevices[eventType] ?? [],
        channels: { inApp: settings.inApp.enabled, sound: settings.inApp.sound, desktop: settings.inApp.desktop },
        enabled: true,
        createdAt: new Date().toISOString(),
      }));
    localStorage.setItem("notificationRules", JSON.stringify(rules));
  } catch {}
}

// ─── Dropdown de veículos por evento ─────────────

function VehicleSelector({
  eventKey,
  selectedIds,
  onChangeIds,
  allDevices,
}: {
  eventKey: string;
  selectedIds: number[];
  onChangeIds: (ids: number[]) => void;
  allDevices: { id: number; name?: string; plate?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return allDevices;
    const q = search.toLowerCase();
    return allDevices.filter(
      (d) => d.name?.toLowerCase().includes(q) || d.plate?.toLowerCase().includes(q),
    );
  }, [allDevices, search]);

  const toggle = (id: number) => {
    onChangeIds(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  const label = selectedIds.length === 0
    ? "Todos os veículos"
    : selectedIds.length === 1
      ? (() => { const d = allDevices.find((x) => x.id === selectedIds[0]); return d?.plate || d?.name || "1 veículo"; })()
      : `${selectedIds.length} veículos`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/40"
      >
        <Car className="w-3 h-3" />
        <span>{label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar veículo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pl-8 border-border/50"
              />
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
            <span className="text-[11px] font-medium text-muted-foreground">
              {selectedIds.length === 0 ? "Monitorando todos" : `${selectedIds.length} selecionado(s)`}
            </span>
            {selectedIds.length > 0 && (
              <button
                onClick={() => onChangeIds([])}
                className="text-[10px] text-primary hover:underline"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Tags dos selecionados */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border/30 bg-muted/20">
              {selectedIds.map((id) => {
                const dev = allDevices.find((d) => d.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                    {dev?.plate || dev?.name || `#${id}`}
                    <button onClick={() => toggle(id)} className="hover:text-destructive">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="max-h-[200px] overflow-y-auto">
            {filtered.map((dev) => {
              const selected = selectedIds.includes(dev.id);
              return (
                <label
                  key={dev.id}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-border/10 last:border-0 transition-colors text-xs ${
                    selected ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(dev.id)}
                    className="rounded border-muted-foreground/40 text-primary w-3.5 h-3.5"
                  />
                  <Car className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block truncate">{dev.name || dev.plate}</span>
                    {dev.plate && dev.name && (
                      <span className="text-[10px] text-muted-foreground font-mono">{dev.plate}</span>
                    )}
                  </div>
                  {selected && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                </label>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum veículo encontrado</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>(loadSettings);

  const { data: allDevices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: () => getDevices(),
    staleTime: 60_000,
  });

  const activeEvents = Object.values(settings.events).filter(Boolean).length;

  const updateSettings = useCallback((next: NotificationSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const updateChannel = <K extends "inApp" | "email" | "sms" | "push">(
    key: K,
    value: NotificationSettings[K],
  ) => {
    updateSettings({ ...settings, [key]: value });
  };

  const toggleEvent = (eventKey: string) => {
    const next = { ...settings, events: { ...settings.events, [eventKey]: !settings.events[eventKey] } };
    updateSettings(next);
  };

  const setEventDevices = (eventKey: string, ids: number[]) => {
    const next = {
      ...settings,
      eventDevices: { ...settings.eventDevices, [eventKey]: ids },
    };
    updateSettings(next);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações de Notificações"
        description="Personalize como você recebe alertas e notificações"
        icon={Bell}
        stats={[
          { label: "Eventos ativos", value: activeEvents, variant: "success" },
          { label: "Total de tipos", value: Object.keys(EVENT_CATALOG).length, variant: "default" },
        ]}
      />

      {/* ════════════════════════════════════════════════
          CANAIS DE ENTREGA — Grid 2x2
          ════════════════════════════════════════════════ */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* ── Notificações na Plataforma ── */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-bold">Notificações na Plataforma</h3>
              <p className="text-xs text-muted-foreground">Receba notificações diretamente na plataforma em tempo real</p>
            </div>
          </div>

          <div className="space-y-3 divide-y divide-border/30">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium">Ativar notificações na plataforma</p>
                <p className="text-xs text-muted-foreground">Exibir alertas no painel de notificações</p>
              </div>
              <Switch
                checked={settings.inApp.enabled}
                onCheckedChange={(v) => updateChannel("inApp", { ...settings.inApp, enabled: v })}
              />
            </div>
            {settings.inApp.enabled && (
              <>
                <div className="flex items-center justify-between pt-3">
                  <div className="flex items-center gap-2">
                    {settings.inApp.sound ? <Volume2 className="w-4 h-4 text-muted-foreground" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">Som de notificação</p>
                      <p className="text-xs text-muted-foreground">Reproduzir som ao receber notificações</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.inApp.sound}
                    onCheckedChange={(v) => updateChannel("inApp", { ...settings.inApp, sound: v })}
                  />
                </div>
                <div className="flex items-center justify-between pt-3">
                  <div>
                    <p className="text-sm font-medium">Notificações do navegador</p>
                    <p className="text-xs text-muted-foreground">Exibir notificações desktop do navegador</p>
                  </div>
                  <Switch
                    checked={settings.inApp.desktop}
                    onCheckedChange={(v) => updateChannel("inApp", { ...settings.inApp, desktop: v })}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Notificações por Email ── */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Mail className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-bold">Notificações por Email</h3>
              <p className="text-xs text-muted-foreground">Receba alertas importantes no seu email</p>
            </div>
          </div>

          <div className="space-y-3 divide-y divide-border/30">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium">Ativar notificações por email</p>
                <p className="text-xs text-muted-foreground">Enviar alertas para o email cadastrado</p>
              </div>
              <Switch
                checked={settings.email.enabled}
                onCheckedChange={(v) => updateChannel("email", { ...settings.email, enabled: v })}
              />
            </div>
            {settings.email.enabled && (
              <>
                <div className="pt-3 space-y-2">
                  <p className="text-sm font-medium">Endereço de Email</p>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={settings.email.address}
                    onChange={(e) => updateChannel("email", { ...settings.email, address: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="pt-3 space-y-2">
                  <p className="text-sm font-medium">Frequência de Envio</p>
                  <Select
                    value={settings.email.frequency}
                    onValueChange={(v: "instant" | "hourly" | "daily") => updateChannel("email", { ...settings.email, frequency: v })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Instantâneo</SelectItem>
                      <SelectItem value="hourly">A cada hora</SelectItem>
                      <SelectItem value="daily">Resumo diário</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {settings.email.frequency === "instant" && "Enviar email imediatamente ao ocorrer evento"}
                    {settings.email.frequency === "hourly" && "Resumo agrupado enviado a cada hora"}
                    {settings.email.frequency === "daily" && "Resumo diário com todos os eventos do dia"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Notificações por SMS ── */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <h3 className="text-base font-bold">Notificações por SMS</h3>
                <p className="text-xs text-muted-foreground">Receba alertas críticos via mensagem de texto</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-500">Premium</Badge>
          </div>

          <div className="space-y-3 divide-y divide-border/30">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium">Ativar notificações por SMS</p>
                <p className="text-xs text-muted-foreground">Enviar SMS para eventos críticos</p>
              </div>
              <Switch
                checked={settings.sms.enabled}
                onCheckedChange={(v) => updateChannel("sms", { ...settings.sms, enabled: v })}
              />
            </div>
            {settings.sms.enabled && (
              <div className="pt-3 space-y-2">
                <p className="text-sm font-medium">Número de Telefone</p>
                <Input
                  type="tel"
                  placeholder="+55 (11) 99999-9999"
                  value={settings.sms.phone}
                  onChange={(e) => updateChannel("sms", { ...settings.sms, phone: e.target.value })}
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Custos adicionais podem ser aplicados</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Notificações Push ── */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <h3 className="text-base font-bold">Notificações Push</h3>
              <p className="text-xs text-muted-foreground">Receba notificações no seu dispositivo móvel</p>
            </div>
          </div>

          <div className="space-y-3 divide-y divide-border/30">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium">Ativar notificações push</p>
                <p className="text-xs text-muted-foreground">Enviar push para o aplicativo móvel</p>
              </div>
              <Switch
                checked={settings.push.enabled}
                onCheckedChange={(v) => updateChannel("push", { enabled: v })}
              />
            </div>
            {settings.push.enabled && (
              <div className="pt-3">
                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Para receber notificações push, instale o aplicativo TrackCore em seu dispositivo móvel e faça login com sua conta.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          TIPOS DE EVENTOS — Grid 2 colunas
          ════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold">Tipos de Eventos</h3>
          <p className="text-xs text-muted-foreground">Selecione quais tipos de eventos devem gerar notificações</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(EVENT_CATALOG).map(([key, { label, icon: Icon, iconColor }]) => {
            const enabled = !!settings.events[key];
            const deviceIds = settings.eventDevices[key] ?? [];

            return (
              <div
                key={key}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  enabled
                    ? "border-border bg-card"
                    : "border-border/30 bg-card"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{label}</span>
                  {enabled && (
                    <VehicleSelector
                      eventKey={key}
                      selectedIds={deviceIds}
                      onChangeIds={(ids) => setEventDevices(key, ids)}
                      allDevices={allDevices}
                    />
                  )}
                </div>

                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleEvent(key)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
