"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDevices,
  sendCommand,
  getSavedCommands,
  createSavedCommand,
  updateSavedCommand,
  deleteSavedCommand,
  linkCommandToDevice,
  unlinkCommandFromDevice,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Terminal,
  Lock,
  Unlock,
  MapPin,
  RotateCcw,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Search,
  X,
  Wifi,
  WifiOff,
  Car,
  FileText,
  ChevronDown,
  MessageSquare,
  BookmarkCheck,
  Plus,
  Pencil,
  Settings2,
  Loader2,
} from "lucide-react";
import { formatDate, deriveDeviceStatus } from "@/lib/utils";
import { Command, Device, TraccarCommand } from "@/types";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// ─── Constantes de tipos de comando ──────────────────────────────────────────
const COMMAND_TYPES = [
  {
    value: "positionSingle",
    label: "Solicitar Posição",
    description: "Solicita a posição atual do rastreador",
    icon: MapPin,
    dangerous: false,
  },
  {
    value: "engineResume",
    label: "Bloquear Veículo",
    description: "Corta a alimentação do motor remotamente",
    icon: Lock,
    dangerous: true,
  },
  {
    value: "engineStop",
    label: "Desbloquear Veículo",
    description: "Restaura a alimentação do motor",
    icon: Unlock,
    dangerous: false,
  },
  {
    value: "rebootDevice",
    label: "Reiniciar Rastreador",
    description: "Reinicia o dispositivo rastreador",
    icon: RotateCcw,
    dangerous: false,
  },
  {
    value: "custom",
    label: "Comando Personalizado",
    description: "Envia um comando de texto customizado",
    icon: FileText,
    dangerous: false,
  },
];

// ─── Histórico local (localStorage) ─────────────────────────────────────────
const STORAGE_KEY = "commandHistory";
const MAX_HISTORY = 50;

function loadHistory(): Command[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: Command[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_HISTORY)),
    );
  } catch {
    /* ignore */
  }
}

// ─── Componente de busca de veículo ─────────────────────────────────────────
function VehicleSearch({
  devices,
  selectedDeviceId,
  onSelect,
}: {
  devices: Device[];
  selectedDeviceId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return devices;
    const q = query.toLowerCase();
    return devices.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.plate?.toLowerCase().includes(q) ||
        d.uniqueId?.toLowerCase().includes(q) ||
        d.phone?.toLowerCase().includes(q),
    );
  }, [devices, query]);

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id.toString() === selectedDeviceId),
    [devices, selectedDeviceId],
  );

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const getStatusInfo = (device: Device) => {
    const status = deriveDeviceStatus(device.status);
    if (status === "moving" || status === "online" || status === "stopped")
      return { color: "text-green-500", label: "Online" };
    return { color: "text-gray-400", label: "Offline" };
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Área do trigger / veículo selecionado */}
      {selectedDevice && !isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setQuery("");
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-white dark:bg-gray-900 hover:border-primary/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Car className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {selectedDevice.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedDevice.plate || selectedDevice.uniqueId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(() => {
              const info = getStatusInfo(selectedDevice);
              return (
                <Badge
                  variant="secondary"
                  className="text-[10px] gap-1 px-1.5"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${info.color === "text-green-500" ? "bg-green-500" : "bg-gray-400"}`}
                  />
                  {info.label}
                </Badge>
              );
            })()}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onSelect("");
                setQuery("");
              }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Buscar por nome, placa ou IMEI..."
            className="pl-9 pr-9 bg-white dark:bg-gray-900"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown de resultados */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-[280px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum veículo encontrado
            </div>
          ) : (
            filtered.map((device) => {
              const info = getStatusInfo(device);
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => {
                    onSelect(device.id.toString());
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors border-b border-border/50 last:border-0 ${
                    selectedDeviceId === device.id.toString()
                      ? "bg-accent/50"
                      : ""
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${info.color === "text-green-500" ? "bg-green-500" : "bg-gray-400"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {device.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[device.plate, device.uniqueId]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {info.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function CommandsPage() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [selectedCommand, setSelectedCommand] = useState<string>("");
  const [customText, setCustomText] = useState("");
  const [useSms, setUseSms] = useState(false);
  const [confirmDangerous, setConfirmDangerous] = useState(false);
  const [history, setHistory] = useState<Command[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Template management state
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TraccarCommand | null>(null);
  const [tplType, setTplType] = useState("positionSingle");
  const [tplDescription, setTplDescription] = useState("");
  const [tplTextChannel, setTplTextChannel] = useState(false);
  const [tplCustomData, setTplCustomData] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: () => getDevices(),
  });

  // Buscar comandos salvos vinculados ao dispositivo selecionado
  const { data: savedCommands = [] } = useQuery({
    queryKey: ["savedCommands", selectedDeviceId],
    queryFn: () => getSavedCommands(parseInt(selectedDeviceId)),
    enabled: !!selectedDeviceId,
  });

  // Todos os templates de comando (para gerenciamento)
  const { data: allTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["commandTemplates"],
    queryFn: () => getSavedCommands(),
  });

  const createTemplateMut = useMutation({
    mutationFn: (data: Omit<TraccarCommand, "id">) => createSavedCommand(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commandTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["savedCommands"] });
      setShowTemplateDialog(false);
      toast.success("Template criado!");
    },
    onError: () => toast.error("Erro ao criar template"),
  });

  const updateTemplateMut = useMutation({
    mutationFn: (data: TraccarCommand) => updateSavedCommand(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commandTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["savedCommands"] });
      setShowTemplateDialog(false);
      setEditingTemplate(null);
      toast.success("Template atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar template"),
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (id: number) => deleteSavedCommand(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commandTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["savedCommands"] });
      toast.success("Template removido!");
    },
    onError: () => toast.error("Erro ao remover template"),
  });

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTplType("positionSingle");
    setTplDescription("");
    setTplTextChannel(false);
    setTplCustomData("");
    setShowTemplateDialog(true);
  };

  const openEditTemplate = (tpl: TraccarCommand) => {
    setEditingTemplate(tpl);
    setTplType(tpl.type);
    setTplDescription(tpl.description || "");
    setTplTextChannel(!!tpl.textChannel);
    setTplCustomData(tpl.attributes?.data || "");
    setShowTemplateDialog(true);
  };

  const handleSaveTemplate = () => {
    const payload = {
      deviceId: 0,
      type: tplType,
      description: tplDescription || undefined,
      textChannel: tplTextChannel || undefined,
      attributes: tplType === "custom" && tplCustomData ? { data: tplCustomData } : {},
    };
    if (editingTemplate) {
      updateTemplateMut.mutate({ ...editingTemplate, ...payload });
    } else {
      createTemplateMut.mutate(payload);
    }
  };

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id.toString() === selectedDeviceId),
    [devices, selectedDeviceId],
  );

  const isOffline = useMemo(() => {
    if (!selectedDevice) return false;
    const status = deriveDeviceStatus(selectedDevice.status);
    return status === "offline" || status === "unknown";
  }, [selectedDevice]);

  const addToHistory = useCallback(
    (deviceId: number, type: string, status: Command["status"]) => {
      setHistory((prev) => {
        const entry: Command = {
          id: Date.now(),
          deviceId,
          type,
          sentTime: new Date().toISOString(),
          status,
        };
        const updated = [entry, ...prev].slice(0, MAX_HISTORY);
        saveHistory(updated);
        return updated;
      });
    },
    [],
  );

  const sendCommandMutation = useMutation({
    mutationFn: ({
      deviceId,
      type,
      attributes,
      textChannel,
    }: {
      deviceId: number;
      type: string;
      attributes?: Record<string, any>;
      textChannel?: boolean;
    }) => sendCommand(deviceId, type, attributes, textChannel),
    onSuccess: (_data, variables) => {
      setError(null);
      addToHistory(variables.deviceId, variables.type, "sent");
      setSelectedCommand("");
      setCustomText("");
      setConfirmDangerous(false);
    },
    onError: (err: any, variables) => {
      const msg =
        err?.details?.message || err?.message || "Falha ao enviar comando";
      setError(msg);
      addToHistory(variables.deviceId, variables.type, "failed");
    },
  });

  const handleSendCommand = () => {
    if (!selectedDeviceId || !selectedCommand) return;

    const cmd = COMMAND_TYPES.find((c) => c.value === selectedCommand);
    if (cmd?.dangerous && !confirmDangerous) {
      setConfirmDangerous(true);
      return;
    }

    setError(null);

    const attributes: Record<string, any> = {};
    if (selectedCommand === "custom" && customText.trim()) {
      attributes.data = customText.trim();
    }

    sendCommandMutation.mutate({
      deviceId: parseInt(selectedDeviceId),
      type: selectedCommand,
      attributes,
      textChannel: useSms || undefined,
    });
  };

  const handleSendSavedCommand = (saved: TraccarCommand) => {
    if (!selectedDeviceId) return;
    setError(null);
    sendCommandMutation.mutate({
      deviceId: parseInt(selectedDeviceId),
      type: saved.type,
      attributes: saved.attributes || {},
      textChannel: saved.textChannel || useSms || undefined,
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const getStatusIcon = (status: Command["status"]) => {
    switch (status) {
      case "delivered":
      case "sent":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusLabel = (status: Command["status"]) => {
    switch (status) {
      case "delivered":
        return "Entregue";
      case "sent":
        return "Enviado";
      case "pending":
        return "Pendente";
      case "failed":
        return "Falhou";
    }
  };

  const getStatusColor = (status: Command["status"]) => {
    switch (status) {
      case "delivered":
      case "sent":
        return "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400";
      case "pending":
        return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400";
      case "failed":
        return "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Terminal}
        title="Comandos Remotos"
        description="Envie comandos para os rastreadores dos veículos. Você também pode enviar pela tela do mapa."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Send Command Panel */}
        <Card className="backdrop-blur-xl bg-gradient-to-br from-white/90 to-gray-50/90 dark:from-gray-950/90 dark:to-gray-900/90 border-white/20">
          <CardHeader>
            <CardTitle className="text-xl">Enviar Novo Comando</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Busca de veículo com filtro */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Veículo
              </label>
              <VehicleSearch
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                onSelect={(id) => {
                  setSelectedDeviceId(id);
                  setError(null);
                  setConfirmDangerous(false);
                  sendCommandMutation.reset();
                }}
              />
            </div>

            {/* Aviso de offline / fila */}
            {selectedDevice && isOffline && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                      Veículo offline
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
                      O comando será enfileirado e enviado quando o dispositivo
                      ficar online.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Comandos salvos (vindos do Traccar) */}
            {selectedDeviceId && savedCommands.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
                  <BookmarkCheck className="w-4 h-4 text-muted-foreground" />
                  Comandos Salvos
                </label>
                <div className="space-y-2">
                  {savedCommands.map((saved) => {
                    const cmdType = COMMAND_TYPES.find((c) => c.value === saved.type);
                    const Icon = cmdType?.icon || Terminal;
                    return (
                      <div
                        key={saved.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
                      >
                        <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                          <Icon className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {saved.description || cmdType?.label || saved.type}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {saved.type}{saved.textChannel ? " · SMS" : " · GPRS"}
                            {saved.attributes?.data ? ` · ${saved.attributes.data}` : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendSavedCommand(saved)}
                          disabled={sendCommandMutation.isPending}
                          className="h-8 text-xs shrink-0"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Enviar
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-border/50 mt-4 pt-2">
                  <p className="text-[10px] text-muted-foreground">Ou escolha um comando abaixo:</p>
                </div>
              </div>
            )}

            {/* Seleção de comando */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Comando
              </label>
              <div className="grid grid-cols-2 gap-3">
                {COMMAND_TYPES.map((cmd) => {
                  const Icon = cmd.icon;
                  const isSelected = selectedCommand === cmd.value;
                  return (
                    <button
                      key={cmd.value}
                      onClick={() => {
                        setSelectedCommand(cmd.value);
                        setConfirmDangerous(false);
                        setError(null);
                        sendCommandMutation.reset();
                      }}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? `bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-transparent shadow-lg scale-[1.02]`
                          : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 mb-1 ${isSelected ? "text-white" : ""}`}
                      />
                      <p
                        className={`text-xs font-semibold ${isSelected ? "text-white" : ""}`}
                      >
                        {cmd.label}
                      </p>
                      <p
                        className={`text-[10px] mt-0.5 leading-tight ${isSelected ? "text-white/80" : "text-muted-foreground"}`}
                      >
                        {cmd.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campo de texto para comando personalizado */}
            {selectedCommand === "custom" && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Texto do comando
                </label>
                <Input
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Ex: setdigout 0"
                  className="font-mono text-sm bg-white dark:bg-gray-900"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Use formato de texto para protocolos baseados em texto, ou hexadecimal para protocolos binários.
                </p>
              </div>
            )}

            {/* Canal de envio: GPRS ou SMS */}
            {selectedCommand && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/40">
                <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Enviar via SMS</p>
                  <p className="text-[10px] text-muted-foreground">
                    Use SMS se o comando GPRS não funcionar (o dispositivo precisa ter chip com SMS habilitado)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUseSms(!useSms)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${useSms ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${useSms ? "translate-x-5" : ""}`} />
                </button>
              </div>
            )}

            {/* Confirmação para comandos perigosos */}
            {confirmDangerous && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                      Tem certeza?
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                      O comando de bloqueio cortará a alimentação do motor.
                      Certifique-se de que o veículo está em local seguro.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleSendCommand}
              disabled={
                !selectedDeviceId ||
                !selectedCommand ||
                (selectedCommand === "custom" && !customText.trim()) ||
                sendCommandMutation.isPending
              }
              className={`w-full ${
                confirmDangerous
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              }`}
              size="lg"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendCommandMutation.isPending
                ? "Enviando..."
                : confirmDangerous
                  ? "Confirmar Bloqueio"
                  : "Enviar Comando"}
            </Button>

            {sendCommandMutation.isSuccess && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Comando enviado com sucesso!
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                      Erro ao enviar comando
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Command History (local) */}
        <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-950/90 border-white/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Histórico de Comandos</CardTitle>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={handleClearHistory}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {history.slice(0, 20).map((command) => {
                const device = devices.find(
                  (d) => d.id === command.deviceId,
                );
                const cmdType = COMMAND_TYPES.find(
                  (ct) => ct.value === command.type,
                );
                const Icon = cmdType?.icon || Terminal;

                return (
                  <div
                    key={command.id}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-900/50 dark:to-gray-950/50 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className="p-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600"
                      >
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm truncate">
                            {cmdType?.label || command.type}
                          </h4>
                          <Badge
                            className={`text-[10px] shrink-0 ${getStatusColor(command.status)}`}
                          >
                            {getStatusIcon(command.status)}
                            <span className="ml-1">
                              {getStatusLabel(command.status)}
                            </span>
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {device
                            ? `${device.plate ? `${device.plate} · ` : ""}${device.name}`
                            : `Veículo #${command.deviceId}`}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          {formatDate(command.sentTime)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {history.length === 0 && (
                <div className="text-center py-8">
                  <Terminal className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum comando enviado ainda
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Comandos também podem ser enviados pela tela do mapa
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning Card */}
      <Card className="backdrop-blur-xl bg-gradient-to-r from-yellow-50/80 to-orange-50/80 dark:from-yellow-950/20 dark:to-orange-950/20 border-yellow-200 dark:border-yellow-800">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-yellow-500 rounded-lg">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-yellow-900 dark:text-yellow-200 mb-1">
                Atenção ao enviar comandos
              </h4>
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                Os comandos de bloqueio podem afetar o funcionamento do veículo.
                Use com cautela e apenas quando necessário. Certifique-se de que
                o veículo está em local seguro antes de enviar comandos de
                bloqueio. Se o veículo estiver offline, o comando será
                enfileirado e enviado assim que reconectar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Templates de Comandos Salvos ── */}
      <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-950/90 border-white/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Templates de Comandos Salvos
          </CardTitle>
          <Button size="sm" onClick={openNewTemplate} className="gap-1">
            <Plus className="w-4 h-4" /> Novo Template
          </Button>
        </CardHeader>
        <CardContent>
          {loadingTemplates ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : allTemplates.length === 0 ? (
            <div className="text-center py-8">
              <BookmarkCheck className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum template de comando salvo
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Crie templates para reutilizar comandos rapidamente ao enviar para dispositivos
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {allTemplates.map((tpl) => {
                const cmdType = COMMAND_TYPES.find((c) => c.value === tpl.type);
                const Icon = cmdType?.icon || Terminal;
                return (
                  <div
                    key={tpl.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                      <Icon className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {tpl.description || cmdType?.label || tpl.type}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {tpl.type}
                        {tpl.textChannel ? " · SMS" : " · GPRS"}
                        {tpl.attributes?.data ? ` · ${tpl.attributes.data}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditTemplate(tpl)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        onClick={() => deleteTemplateMut.mutate(tpl.id)}
                        disabled={deleteTemplateMut.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Dialog: Criar/Editar Template ── */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar Template" : "Novo Template de Comando"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Descrição</Label>
              <Input
                value={tplDescription}
                onChange={(e) => setTplDescription(e.target.value)}
                placeholder="Ex: Bloqueio padrão, Posição rápida..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tipo de Comando</Label>
              <Select value={tplType} onValueChange={setTplType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMAND_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tplType === "custom" && (
              <div>
                <Label>Texto do comando</Label>
                <Input
                  value={tplCustomData}
                  onChange={(e) => setTplCustomData(e.target.value)}
                  placeholder="Ex: setdigout 0"
                  className="mt-1 font-mono text-sm"
                />
              </div>
            )}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <Label className="text-sm">Enviar via SMS</Label>
                <p className="text-xs text-muted-foreground">Canal de envio padrão do template</p>
              </div>
              <Switch checked={tplTextChannel} onCheckedChange={setTplTextChannel} />
            </div>
            <Button
              onClick={handleSaveTemplate}
              disabled={createTemplateMut.isPending || updateTemplateMut.isPending}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              {(createTemplateMut.isPending || updateTemplateMut.isPending) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BookmarkCheck className="w-4 h-4 mr-2" />
              )}
              {editingTemplate ? "Atualizar" : "Criar Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
