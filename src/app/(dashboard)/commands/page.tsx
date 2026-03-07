"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getDevices, sendCommand } from "@/lib/api";
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
} from "lucide-react";
import { formatDate, deriveDeviceStatus } from "@/lib/utils";
import { Command, Device } from "@/types";

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
    value: "engineStop",
    label: "Bloquear Veículo",
    description: "Corta a alimentação do motor remotamente",
    icon: Lock,
    dangerous: true,
  },
  {
    value: "engineResume",
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
  const [confirmDangerous, setConfirmDangerous] = useState(false);
  const [history, setHistory] = useState<Command[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: () => getDevices(),
  });

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
    }: {
      deviceId: number;
      type: string;
      attributes?: Record<string, any>;
    }) => sendCommand(deviceId, type, attributes),
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
    </div>
  );
}
