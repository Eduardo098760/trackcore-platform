"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDevices } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth";
import {
  getTraccarNotifications,
  createTraccarNotification,
  updateTraccarNotification,
  deleteTraccarNotification,
  testTraccarNotification,
  TRACCAR_EVENT_TYPES,
  type TraccarNotification,
} from "@/lib/api/notifications";
import {
  addUserNotification,
  removeUserNotification,
  addDeviceNotification,
  removeDeviceNotification,
} from "@/lib/api/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  Wrench,
  Siren,
  Gauge,
  Info,
  AlertTriangle,
  FileText,
  Image,
  UserCheck,
  HelpCircle,
  Send,
  Loader2,
  Plus,
  Trash2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Catálogo de tipos de evento Traccar ─────────

const EVENT_CATALOG: Record<
  string,
  { label: string; icon: React.ElementType; iconColor: string }
> = {
  deviceOnline:    { label: "Dispositivo Online",       icon: Power,        iconColor: "text-emerald-500" },
  deviceOffline:   { label: "Dispositivo Offline",      icon: PowerOff,     iconColor: "text-red-500" },
  deviceUnknown:   { label: "Dispositivo Desconhecido", icon: HelpCircle,   iconColor: "text-slate-400" },
  deviceInactive:  { label: "Dispositivo Inativo",      icon: Info,         iconColor: "text-slate-400" },
  deviceMoving:    { label: "Dispositivo em Movimento",  icon: Activity,    iconColor: "text-blue-500" },
  deviceStopped:   { label: "Dispositivo Parado",       icon: Info,         iconColor: "text-slate-400" },
  deviceOverspeed: { label: "Excesso de Velocidade",    icon: Gauge,        iconColor: "text-amber-500" },
  ignitionOn:      { label: "Ignição Ligada",           icon: Zap,          iconColor: "text-emerald-500" },
  ignitionOff:     { label: "Ignição Desligada",        icon: Zap,          iconColor: "text-slate-400" },
  geofenceEnter:   { label: "Entrada em Cerca",         icon: MapPin,       iconColor: "text-blue-500" },
  geofenceExit:    { label: "Saída de Cerca",           icon: MapPin,       iconColor: "text-orange-500" },
  alarm:           { label: "Alarme / SOS",             icon: Siren,        iconColor: "text-red-500" },
  maintenance:     { label: "Manutenção",               icon: Wrench,       iconColor: "text-blue-500" },
  driverChanged:   { label: "Mudança de Motorista",     icon: UserCheck,    iconColor: "text-cyan-500" },
  commandResult:   { label: "Resultado de Comando",     icon: FileText,     iconColor: "text-indigo-500" },
  textMessage:     { label: "Mensagem de Texto",        icon: MessageSquare,iconColor: "text-violet-500" },
  media:           { label: "Mídia Recebida",           icon: Image,        iconColor: "text-pink-500" },
};

// Canais de notificação Traccar
const CHANNELS = [
  { key: "web",      label: "Web",   icon: Globe,         color: "text-blue-500" },
  { key: "mail",     label: "Email", icon: Mail,          color: "text-emerald-500" },
  { key: "sms",      label: "SMS",   icon: Smartphone,    color: "text-purple-500" },
  { key: "firebase", label: "Push",  icon: MessageSquare, color: "text-orange-500" },
] as const;

// ─── Local client settings ─────────────────────

interface LocalNotifSettings {
  sound: boolean;
  desktop: boolean;
}

function loadLocalSettings(): LocalNotifSettings {
  try {
    const stored = localStorage.getItem("notificationClientSettings");
    if (!stored) return { sound: true, desktop: false };
    return JSON.parse(stored);
  } catch {
    return { sound: true, desktop: false };
  }
}

function saveLocalSettings(s: LocalNotifSettings) {
  localStorage.setItem("notificationClientSettings", JSON.stringify(s));
}

// ─── Dropdown de veículos por regra ─────────────

function VehicleSelector({
  selectedIds,
  onChangeIds,
  allDevices,
}: {
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

  const label =
    selectedIds.length === 0
      ? "Todos os veículos"
      : selectedIds.length === 1
        ? (() => {
            const d = allDevices.find((x) => x.id === selectedIds[0]);
            return d?.plate || d?.name || "1 veículo";
          })()
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
              <button onClick={() => onChangeIds([])} className="text-[10px] text-primary hover:underline">
                Limpar
              </button>
            )}
          </div>

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
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // ── Local client settings (som / desktop) ──
  const [localSettings, setLocalSettings] = useState<LocalNotifSettings>(loadLocalSettings);
  const updateLocal = useCallback((next: LocalNotifSettings) => {
    setLocalSettings(next);
    saveLocalSettings(next);
  }, []);

  // ── Dialog para nova/editar regra ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotif, setEditingNotif] = useState<TraccarNotification | null>(null);
  const [formType, setFormType] = useState("");
  const [formChannels, setFormChannels] = useState<string[]>(["web"]);
  const [formAlways, setFormAlways] = useState(true);
  const [formDeviceIds, setFormDeviceIds] = useState<number[]>([]);

  // ── Queries ──
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["traccar-notifications"],
    queryFn: getTraccarNotifications,
  });

  const { data: allDevices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: getDevices,
    staleTime: 60_000,
  });

  // Mapa tipo → notificação
  const notifByType = useMemo(() => {
    const map: Record<string, TraccarNotification> = {};
    for (const n of notifications) map[n.type] = n;
    return map;
  }, [notifications]);

  // Tipos de evento já usados
  const usedTypes = useMemo(() => new Set(notifications.map((n) => n.type)), [notifications]);

  // Tipos disponíveis para criar novas regras
  const availableTypes = useMemo(
    () => (TRACCAR_EVENT_TYPES as readonly string[]).filter((t) => !usedTypes.has(t)),
    [usedTypes],
  );

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: async (data: Omit<TraccarNotification, "id">) => {
      const notif = await createTraccarNotification(data);
      // Vincular ao usuário atual
      if (user?.id) await addUserNotification(user.id, notif.id);
      return notif;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traccar-notifications"] });
      toast.success("Regra de notificação criada!");
      setDialogOpen(false);
    },
    onError: () => toast.error("Erro ao criar regra de notificação"),
  });

  const updateMut = useMutation({
    mutationFn: (data: Partial<TraccarNotification> & { id: number }) =>
      updateTraccarNotification(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traccar-notifications"] });
      toast.success("Regra atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar regra"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTraccarNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traccar-notifications"] });
      toast.success("Regra removida!");
    },
    onError: () => toast.error("Erro ao remover regra"),
  });

  const testMut = useMutation({
    mutationFn: testTraccarNotification,
    onSuccess: () => toast.success("Notificação de teste enviada!"),
    onError: () => toast.error("Erro ao enviar teste"),
  });

  // ── Handlers ──
  const openNewDialog = () => {
    setEditingNotif(null);
    setFormType(availableTypes[0] || "");
    setFormChannels(["web"]);
    setFormAlways(true);
    setFormDeviceIds([]);
    setDialogOpen(true);
  };

  const openEditDialog = (n: TraccarNotification) => {
    setEditingNotif(n);
    setFormType(n.type);
    setFormChannels(n.notificators ? n.notificators.split(",").filter(Boolean) : ["web"]);
    setFormAlways(n.always);
    setFormDeviceIds([]);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const notificators = formChannels.join(",");
    if (editingNotif) {
      updateMut.mutate({
        id: editingNotif.id,
        type: editingNotif.type,
        notificators,
        always: formAlways,
      });
    } else {
      if (!formType) return;
      createMut.mutate({
        type: formType,
        notificators,
        always: formAlways,
      });
    }
    setDialogOpen(false);
  };

  const toggleChannel = (notif: TraccarNotification, channel: string) => {
    const channels = notif.notificators ? notif.notificators.split(",").filter(Boolean) : [];
    const has = channels.includes(channel);
    const next = has ? channels.filter((c) => c !== channel) : [...channels, channel];
    if (next.length === 0) return; // Deve ter pelo menos 1 canal
    updateMut.mutate({ id: notif.id, type: notif.type, notificators: next.join(","), always: notif.always });
  };

  const isBusy = createMut.isPending || updateMut.isPending;

  return (
      <div className="space-y-6">
        <PageHeader
          title="Configurações de Notificações"
          description="Gerencie regras de notificação integradas ao servidor Traccar"
          icon={Bell}
          stats={[
            { label: "Regras ativas", value: notifications.length, variant: "success" },
            { label: "Tipos de evento", value: Object.keys(EVENT_CATALOG).length, variant: "default" },
          ]}
        />

        {/* ════════════════════════════════════════════════
            CONFIGURAÇÕES LOCAIS DO NAVEGADOR
            ════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-bold">Configurações do Navegador</h3>
              <p className="text-xs text-muted-foreground">
                Preferências locais de som e notificações desktop
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                {localSettings.sound ? (
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">Som de notificação</p>
                  <p className="text-xs text-muted-foreground">Reproduzir som ao receber alertas</p>
                </div>
              </div>
              <Switch
                checked={localSettings.sound}
                onCheckedChange={(v) => updateLocal({ ...localSettings, sound: v })}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Notificações desktop</p>
                <p className="text-xs text-muted-foreground">Exibir alertas do navegador</p>
              </div>
              <Switch
                checked={localSettings.desktop}
                onCheckedChange={(v) => updateLocal({ ...localSettings, desktop: v })}
              />
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            CANAIS DISPONÍVEIS — Resumo informativo
            ════════════════════════════════════════════════ */}
        <div className="grid gap-3 sm:grid-cols-4">
          {CHANNELS.map(({ key, label, icon: Icon, color }) => {
            const count = notifications.filter((n) =>
              n.notificators?.split(",").includes(key),
            ).length;
            return (
              <div key={key} className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {count} {count === 1 ? "regra" : "regras"}
                  </p>
                </div>
                {count > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    Ativo
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* ════════════════════════════════════════════════
            REGRAS DE NOTIFICAÇÃO — Lista com canais
            ════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">Regras de Notificação (Servidor)</h3>
              <p className="text-xs text-muted-foreground">
                Cada regra dispara uma notificação pelo Traccar nos canais selecionados
              </p>
            </div>
            <Button onClick={openNewDialog} size="sm" disabled={availableTypes.length === 0}>
              <Plus className="w-4 h-4 mr-1" /> Nova Regra
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Bell className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhuma regra de notificação criada</p>
              <p className="text-xs text-muted-foreground">
                Clique em &quot;Nova Regra&quot; para configurar alertas por email, SMS, push e web
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => {
                const meta = EVENT_CATALOG[notif.type];
                const Icon = meta?.icon || AlertTriangle;
                const iconColor = meta?.iconColor || "text-muted-foreground";
                const channels = notif.notificators ? notif.notificators.split(",").filter(Boolean) : [];

                return (
                  <div
                    key={notif.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    {/* Ícone do evento */}
                    <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
                    </div>

                    {/* Info do evento */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {meta?.label || notif.type}
                        </span>
                        {notif.always ? (
                          <Badge variant="outline" className="text-[10px]">
                            Todos os dispositivos
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Dispositivos específicos
                          </Badge>
                        )}
                      </div>

                      {/* Checkboxes de canais */}
                      <div className="flex items-center gap-3 mt-1.5">
                        {CHANNELS.map(({ key, label, icon: ChIcon, color }) => {
                          const active = channels.includes(key);
                          return (
                            <label key={key} className="flex items-center gap-1 cursor-pointer" title={active ? `Desativar ${label}` : `Ativar ${label}`}>
                              <Checkbox
                                checked={active}
                                onCheckedChange={() => toggleChannel(notif, key)}
                                className="w-3.5 h-3.5"
                              />
                              <ChIcon
                                className={`w-3 h-3 ${active ? color : "text-muted-foreground/40"}`}
                              />
                              <span
                                className={`text-[10px] ${active ? "text-foreground" : "text-muted-foreground/50"}`}
                              >
                                {label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Enviar teste"
                        onClick={() => testMut.mutate(notif.id)}
                        disabled={testMut.isPending}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar regra"
                        onClick={() => openEditDialog(notif)}
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Remover regra"
                        onClick={() => deleteMut.mutate(notif.id)}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════
            CRIAÇÃO RÁPIDA — Grid de todos os tipos
            ════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold">Ativação Rápida por Evento</h3>
            <p className="text-xs text-muted-foreground">
              Ative ou desative tipos de evento. Ativar cria uma regra web automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(EVENT_CATALOG).map(([key, { label, icon: Icon, iconColor }]) => {
              const existing = notifByType[key];
              const enabled = !!existing;

              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    enabled ? "border-primary/30 bg-primary/5" : "border-border/30 bg-card"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{label}</span>
                    {enabled && (
                      <div className="flex gap-1 mt-0.5">
                        {existing.notificators
                          ?.split(",")
                          .filter(Boolean)
                          .map((ch) => {
                            const meta = CHANNELS.find((c) => c.key === ch);
                            return (
                              <Badge key={ch} variant="secondary" className="text-[9px] px-1 py-0">
                                {meta?.label || ch}
                              </Badge>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  <Switch
                    checked={enabled}
                    onCheckedChange={() => {
                      if (enabled) {
                        deleteMut.mutate(existing.id);
                      } else {
                        createMut.mutate({ type: key, notificators: "web", always: true });
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ Dialog Criar/Editar Regra ═══ */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingNotif ? "Editar Regra" : "Nova Regra de Notificação"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Tipo de evento */}
              {!editingNotif && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Tipo de Evento</p>
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                    {availableTypes.map((t) => {
                      const meta = EVENT_CATALOG[t];
                      const Icon = meta?.icon || AlertTriangle;
                      return (
                        <label
                          key={t}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-sm ${
                            formType === t ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="eventType"
                            value={t}
                            checked={formType === t}
                            onChange={() => setFormType(t)}
                            className="sr-only"
                          />
                          <Icon className={`w-4 h-4 ${meta?.iconColor || "text-muted-foreground"}`} />
                          <span>{meta?.label || t}</span>
                        </label>
                      );
                    })}
                    {availableTypes.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Todos os tipos de evento já têm regras
                      </p>
                    )}
                  </div>
                </div>
              )}

              {editingNotif && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  {(() => {
                    const meta = EVENT_CATALOG[editingNotif.type];
                    const Icon = meta?.icon || AlertTriangle;
                    return (
                      <>
                        <Icon className={`w-5 h-5 ${meta?.iconColor || "text-muted-foreground"}`} />
                        <span className="text-sm font-medium">{meta?.label || editingNotif.type}</span>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Canais */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Canais de Entrega</p>
                <div className="grid grid-cols-2 gap-2">
                  {CHANNELS.map(({ key, label, icon: Icon, color }) => {
                    const active = formChannels.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          active ? "border-primary/30 bg-primary/5" : "border-border/50 hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={active}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormChannels((prev) => [...prev, key]);
                            } else {
                              const next = formChannels.filter((c) => c !== key);
                              if (next.length > 0) setFormChannels(next);
                            }
                          }}
                        />
                        <Icon className={`w-4 h-4 ${active ? color : "text-muted-foreground/40"}`} />
                        <span className="text-sm">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Todos os dispositivos */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Todos os dispositivos</p>
                  <p className="text-xs text-muted-foreground">
                    Dispara para qualquer dispositivo vinculado ao usuário
                  </p>
                </div>
                <Switch checked={formAlways} onCheckedChange={setFormAlways} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isBusy || (!editingNotif && !formType)}>
                {isBusy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editingNotif ? "Salvar" : "Criar Regra"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
