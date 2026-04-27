"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getDevices, getPositions } from "@/lib/api";
import { socket } from "@/lib/socket";
import { getPublicAppUrl, isLocalhostAppUrl } from "@/lib/public-runtime";
import {
  createDevice,
  updateDevice,
  deleteDevice,
  updateAccumulators,
} from "@/lib/api/devices";
import { Device, VehicleCategory } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTableCard } from "@/components/ui/data-table-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu, RowActionsMenuItem } from "@/components/ui/row-actions-menu";
import {
  Search,
  MapPin,
  History,
  Terminal,
  Filter,
  Plus,
  Edit,
  Trash2,
  Car,
  Gauge,
  Zap,
  Activity,
  Satellite,
  Share2,
  Wifi,
  ShieldOff,
  ChevronDown,
  Clock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDeviceStatusColor,
  getDeviceStatusLabel,
  formatDate,
  deriveDeviceStatus,
} from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareLocationDialog } from "@/components/vehicles/share-location-dialog";
import { SendCommandDialog } from "@/components/map/send-command-dialog";
import { usePermissions } from "@/lib/hooks/usePermissions";
import QRCode from "qrcode";

interface ActiveShare {
  shareId: string;
  deviceId: number;
  deviceName: string;
  plate: string;
  createdAt: number;
  expiresAt: number;
}

function getGuidedScanStatus(uniqueId?: string, phone?: string) {
  const hasImei = Boolean(uniqueId?.trim());
  const hasIccid = Boolean(phone?.trim());

  if (!hasImei) {
    return "Passo 1: escaneie o dispositivo para preencher o IMEI.";
  }

  if (!hasIccid) {
    return "Passo 2: agora escaneie o chip para preencher o ICCID.";
  }

  return "Leitura concluida. Revise os dados e salve o veiculo.";
}

// Countdown ao vivo para sub-linha de shares inline
function ShareCountdown({ expiresAt }: { expiresAt: number }) {
  const [ms, setMs] = useState(Math.max(0, expiresAt - Date.now()));
  useEffect(() => {
    const id = setInterval(
      () => setMs(Math.max(0, expiresAt - Date.now())),
      1000,
    );
    return () => clearInterval(id);
  }, [expiresAt]);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const urgent = ms < 5 * 60_000;
  return (
    <span
      className={urgent ? "text-[10px] font-medium text-red-400" : "text-[10px] text-muted-foreground"}
    >
      {h > 0 ? `${h}h ` : ""}
      {m}m {s}s
    </span>
  );
}

export default function VehiclesPage() {
  const normalizePhone = useCallback((phone?: string) => String(phone || "").replace(/\D/g, ""), []);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [shareDevice, setShareDevice] = useState<Device | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [commandDevice, setCommandDevice] = useState<Device | null>(null);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // shares ativos: map deviceId -> lista de shares
  const [activeSharesMap, setActiveSharesMap] = useState<
    Map<number, ActiveShare[]>
  >(new Map());
  const [expandedShares, setExpandedShares] = useState<Set<number>>(new Set());
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refreshActiveShares = useCallback(async () => {
    try {
      const res = await fetch("/api/share/active");
      if (res.ok) {
        const shares: ActiveShare[] = await res.json();
        const map = new Map<number, ActiveShare[]>();
        for (const s of shares) {
          const arr = map.get(s.deviceId) || [];
          arr.push(s);
          map.set(s.deviceId, arr);
        }
        setActiveSharesMap(map);
      }
    } catch {
      /* silencioso */
    }
  }, []);

  const handleRevokeInline = async (shareId: string, deviceId: number) => {
    setRevokingId(shareId);
    try {
      const res = await fetch("/api/share/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Acesso revogado");
      setActiveSharesMap((prev) => {
        const next = new Map(prev);
        const arr = (next.get(deviceId) || []).filter(
          (s) => s.shareId !== shareId,
        );
        if (arr.length === 0) {
          next.delete(deviceId);
          setExpandedShares((e) => {
            const n = new Set(e);
            n.delete(deviceId);
            return n;
          });
        } else {
          next.set(deviceId, arr);
        }
        return next;
      });
    } catch {
      toast.error("Erro ao revogar acesso");
    } finally {
      setRevokingId(null);
    }
  };

  useEffect(() => {
    refreshActiveShares();
    const id = setInterval(refreshActiveShares, 30_000);
    return () => clearInterval(id);
  }, [refreshActiveShares]);
  const [formData, setFormData] = useState({
    name: "",
    uniqueId: "",
    phone: "",
    model: "",
    contact: "",
    category: "car" as VehicleCategory,
    plate: "",
    speedLimit: 80,
    odometer: 0,
    attributes: {} as Record<string, any>,
  });
  const [scanQr, setScanQr] = useState("");
  const [scanStatus, setScanStatus] = useState(getGuidedScanStatus("", ""));
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanAccessWarning, setScanAccessWarning] = useState<string | null>(null);

  const scanProgress = {
    imeiDone: Boolean(formData.uniqueId.trim()),
    iccidDone: Boolean(formData.phone.trim()),
  };

  const currentScanStep = !scanProgress.imeiDone
    ? "imei"
    : !scanProgress.iccidDone
      ? "iccid"
      : "done";

  const {
    data: devices = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      console.log("🚗 Buscando dispositivos...");
      try {
        const result = await getDevices();
        console.log("✅ Dispositivos recebidos:", result);
        return result;
      } catch (err) {
        console.error("❌ Erro ao buscar dispositivos:", err);
        throw err;
      }
    },
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => getPositions(),
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (device: Omit<Device, "id">) => createDevice(device),
    onSuccess: (createdDevice, variables) => {
      // Adiciona o novo device ao cache imediatamente.
      // Campos customizados (plate, color, etc.) podem não vir no root da resposta POST
      // do Traccar — por isso usa variables (formData enviado) como fonte primária.
      queryClient.setQueryData(["devices"], (old: Device[] = []) => [
        ...old,
        {
          ...createdDevice,
          plate: (variables as any).plate ?? (createdDevice as any).plate ?? "",
          model: (variables as any).model ?? (createdDevice as any).model ?? "",
          color: (variables as any).color ?? (createdDevice as any).color ?? "",
          contact:
            (variables as any).contact ?? (createdDevice as any).contact ?? "",
          category:
            (variables as any).category ??
            (createdDevice as any).category ??
            "car",
          speedLimit: Math.round(
            (variables as any).speedLimit ??
              (createdDevice as any).speedLimit ??
              80,
          ),
        },
      ]);
      queryClient.invalidateQueries({
        queryKey: ["devices"],
        refetchType: "none",
      });
      toast.success("Veículo criado com sucesso!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao criar veículo");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Device> }) =>
      updateDevice(id, data),
    onSuccess: (updatedDevice, variables) => {
      // Atualiza o cache imediatamente.
      // Campos customizados (plate, speedLimit, etc.) ficam em `attributes` no Traccar
      // e podem não vir no nível raiz da resposta PUT — por isso usamos variables.data
      // como fonte confiável para esses campos.
      queryClient.setQueryData(["devices"], (old: Device[] = []) =>
        old.map((d) => {
          if (d.id !== variables.id) return d;
          return {
            ...d,
            ...updatedDevice,
            plate:
              (variables.data as any).plate ??
              (updatedDevice as any).plate ??
              d.plate,
            model:
              (variables.data as any).model ??
              (updatedDevice as any).model ??
              d.model,
            color:
              (variables.data as any).color ??
              (updatedDevice as any).color ??
              d.color,
            contact:
              (variables.data as any).contact ??
              (updatedDevice as any).contact ??
              d.contact,
            category:
              (variables.data as any).category ??
              (updatedDevice as any).category ??
              d.category,
            speedLimit: Math.round(
              (variables.data as any).speedLimit ??
                (updatedDevice as any).speedLimit ??
                d.speedLimit ??
                80,
            ),
          };
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Veículo atualizado com sucesso!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao atualizar veículo");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Veículo removido com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao remover veículo");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      uniqueId: "",
      phone: "",
      model: "",
      contact: "",
      category: "car",
      plate: "",
      speedLimit: 80,
      odometer: 0,
      attributes: {},
    });
    setScanQr("");
    setScanStatus(getGuidedScanStatus("", ""));
    setScanError(null);
    setScanAccessWarning(null);
    setEditingDevice(null);
  };

  const createScanSession = useCallback(async () => {
    try {
      setScanStatus("Preparando o leitor do celular...");
      setScanError(null);

      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("failed_to_create_session");

      const json = await res.json();
      const sessionId = json.sessionId as string;
      const token = json.token as string;
      const expires = json.expiresAt as number;

      socket.emit("join-session", { sessionId, token, expires });

      const baseUrl = getPublicAppUrl();
      const scanUrl = `${baseUrl}/scan?session=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}&expires=${encodeURIComponent(expires)}`;
      const qrDataUrl = await QRCode.toDataURL(scanUrl);

      setScanQr(qrDataUrl);
      setScanStatus(getGuidedScanStatus(formData.uniqueId, formData.phone));
      setScanAccessWarning(
        isLocalhostAppUrl(baseUrl)
          ? "Este QR aponta para localhost. No celular isso nao abre. Acesse a plataforma pelo IP da sua maquina ou configure NEXT_PUBLIC_APP_URL com algo como http://192.168.x.x:3000."
          : null,
      );
    } catch (error) {
      console.error("Erro criando sessão de leitura:", error);
      setScanError("Não foi possível preparar a leitura automática.");
      setScanStatus("Falha ao criar sessão de leitura.");
    }
  }, [formData.phone, formData.uniqueId]);

  useEffect(() => {
    if (!isDialogOpen || !!editingDevice) {
      return;
    }

    createScanSession();

    const handleScanResult = (data: any) => {
      if (data.type === "imei") {
        setFormData((prev) => {
          const next = { ...prev, uniqueId: data.value };
          setScanStatus(getGuidedScanStatus(next.uniqueId, next.phone));
          return next;
        });
      }

      if (data.type === "iccid") {
        setFormData((prev) => {
          const next = { ...prev, phone: data.value };
          setScanStatus(getGuidedScanStatus(next.uniqueId, next.phone));
          return next;
        });
      }
    };

    const handleSessionError = (data: any) => {
      setScanError(data?.reason || "Erro na sessão de leitura.");
    };

    const handleScanError = (data: any) => {
      setScanError(data?.reason || "Erro ao validar leitura.");
    };

    socket.on("scan-result", handleScanResult);
    socket.on("session-error", handleSessionError);
    socket.on("scan-error", handleScanError);

    return () => {
      socket.off("scan-result", handleScanResult);
      socket.off("session-error", handleSessionError);
      socket.off("scan-error", handleScanError);
    };
  }, [createScanSession, editingDevice, isDialogOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { odometer, ...formRest } = formData;
    const normalizedFormRest = {
      ...formRest,
      phone: normalizePhone(formRest.phone),
    };

    if (editingDevice) {
      const updateData = {
        ...editingDevice,
        ...normalizedFormRest,
        id: editingDevice.id,
        disabled: editingDevice.disabled ?? false,
      };
      try {
        await updateMutation.mutateAsync({
          id: editingDevice.id,
          data: updateData,
        });
        if (odometer >= 0) {
          const pos = positionsMap.get(editingDevice.id);
          const currentHours = (pos?.attributes as any)?.hours ?? 0;
          await updateAccumulators(editingDevice.id, odometer, currentHours);
          // Atualiza o cache de posições imediatamente — o Traccar não altera
          // a posição já armazenada ao mudar o acumulador, apenas posições futuras.
          queryClient.setQueryData<any[]>(["positions"], (old = []) =>
            old.map((p) =>
              p.deviceId === editingDevice.id
                ? {
                    ...p,
                    attributes: {
                      ...p.attributes,
                      totalDistance: odometer * 1000,
                      odometer: undefined,
                    },
                  }
                : p,
            ),
          );
        }
      } catch {
        /* tratado pelos callbacks da mutation */
      }
    } else {
      const deviceData = {
        ...normalizedFormRest,
        status: "offline" as const,
        lastUpdate: new Date().toISOString(),
        disabled: false,
      };
      try {
        const created = await createMutation.mutateAsync(deviceData);
        if (odometer > 0) {
          await updateAccumulators(created.id, odometer);
          queryClient.setQueryData<any[]>(["positions"], (old = []) => [
            ...old,
            {
              deviceId: created.id,
              attributes: { totalDistance: odometer * 1000 },
            },
          ]);
        }
      } catch {
        /* tratado pelos callbacks da mutation */
      }
    }
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    const pos = positionsMap.get(device.id);
    const currentOdoKm = pos?.attributes?.totalDistance
      ? Math.round(pos.attributes.totalDistance / 1000)
      : (pos?.attributes?.odometer ?? 0);
    setFormData({
      name: device.name ?? "",
      uniqueId: device.uniqueId ?? "",
      phone: device.phone ?? "",
      model: device.model ?? "",
      contact: device.contact ?? "",
      category: device.category ?? "car",
      plate: device.plate ?? "",
      speedLimit: device.speedLimit ?? 80,
      odometer: currentOdoKm,
      attributes: device.attributes ?? {},
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja remover este veículo?")) {
      deleteMutation.mutate(id);
    }
  };

  const positionsMap = new Map(positions.map((p) => [p.deviceId, p]));

  const filteredDevices = devices.filter((device) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (device.name ?? "").toLowerCase().includes(q) ||
      (device.plate ?? "").toLowerCase().includes(q) ||
      (device.uniqueId ?? "").toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" || device.status === statusFilter;
    const matchesCategory =
      categoryFilter === "all" || device.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Mensagem de erro se houver */}
      {error && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="text-red-500">⚠️</div>
              <div>
                <h3 className="font-semibold text-red-900">
                  Erro ao carregar veículos
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  {error instanceof Error ? error.message : "Erro desconhecido"}
                </p>
                <p className="text-xs text-red-600 mt-2">
                  Verifique se você está autenticado e se o servidor Traccar
                  está acessível.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => window.location.reload()}
                >
                  Tentar Novamente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <PageHeader
        icon={Car}
        title="Gerenciamento de Veículos"
        description={`${filteredDevices.length} veículos encontrados`}
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Veículo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingDevice ? "Editar Veículo" : "Novo Veículo"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome do Veículo *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Ex: Veículo 001"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="plate">Placa *</Label>
                    <Input
                      id="plate"
                      value={formData.plate}
                      onChange={(e) =>
                        setFormData({ ...formData, plate: e.target.value })
                      }
                      placeholder="Ex: ABC-1234"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="uniqueId">IMEI / ID do Rastreador *</Label>
                    <Input
                      id="uniqueId"
                      value={formData.uniqueId}
                      onChange={(e) =>
                        setFormData({ ...formData, uniqueId: e.target.value })
                      }
                      placeholder="Ex: 123456789012345"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Identificador único do dispositivo GPS
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="phone">Número do Chip (SIM)</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: normalizePhone(e.target.value) })
                      }
                      placeholder="Ex: +5511999999999"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Número do chip GSM usado quando o envio por SMS estiver habilitado na plataforma
                    </p>
                  </div>
                </div>

                {!editingDevice && (
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                    <p className="text-sm font-semibold">Hierarquia da operação</p>
                    <p className="text-xs text-muted-foreground">
                      1. Em Configuração SMS você define qual empresa fará o envio dos comandos por SMS.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      2. No cadastro do dispositivo você informa IMEI e número do chip para deixar o veículo pronto para esse envio.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      3. Depois, a tela de Comandos e os Comandos Salvos usam esses dados para disparar comandos pelo canal escolhido.
                    </p>
                  </div>
                )}

                {!editingDevice && (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">Leitura por celular</p>
                        <p className="text-xs text-muted-foreground">
                          Use o celular para fotografar primeiro o IMEI e depois o ICCID com Google Vision.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={createScanSession}>
                        Gerar novo QR do leitor
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div
                        className={`rounded-xl border p-3 ${scanProgress.imeiDone ? "border-emerald-500/40 bg-emerald-500/10" : currentScanStep === "imei" ? "border-cyan-500/40 bg-cyan-500/10" : "border-border bg-background"}`}
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Passo 1
                        </div>
                        <div className="mt-1 text-sm font-semibold">Escanear o dispositivo</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Capture a etiqueta do rastreador para preencher o IMEI.
                        </div>
                        <div className="mt-3 text-xs font-medium">
                          {scanProgress.imeiDone ? "Concluido" : currentScanStep === "imei" ? "Em andamento" : "Aguardando"}
                        </div>
                        {scanProgress.imeiDone ? (
                          <div className="mt-2 text-xs text-emerald-700 break-all">{formData.uniqueId}</div>
                        ) : null}
                      </div>

                      <div
                        className={`rounded-xl border p-3 ${scanProgress.iccidDone ? "border-emerald-500/40 bg-emerald-500/10" : currentScanStep === "iccid" ? "border-cyan-500/40 bg-cyan-500/10" : "border-border bg-background"}`}
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Passo 2
                        </div>
                        <div className="mt-1 text-sm font-semibold">Escanear o chip</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Depois fotografe o SIM para preencher o ICCID.
                        </div>
                        <div className="mt-3 text-xs font-medium">
                          {scanProgress.iccidDone ? "Concluido" : currentScanStep === "iccid" ? "Em andamento" : "Aguardando"}
                        </div>
                        {scanProgress.iccidDone ? (
                          <div className="mt-2 text-xs text-emerald-700 break-all">{formData.phone}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-start">
                      <div className="rounded-lg border bg-background p-3 min-w-[180px] min-h-[180px] flex items-center justify-center">
                        {scanQr ? (
                          <img src={scanQr} alt="QR de leitura do dispositivo" className="w-40 h-40" />
                        ) : (
                          <span className="text-xs text-muted-foreground text-center">
                            Preparando QR de leitura...
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <p className="font-medium">{scanStatus}</p>
                        {scanAccessWarning ? (
                          <p className="text-amber-600 text-xs">{scanAccessWarning}</p>
                        ) : null}
                        {scanError ? (
                          <p className="text-destructive text-xs">{scanError}</p>
                        ) : null}
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          <li>Abra o leitor no celular apontando para este QR.</li>
                          <li>Primeiro fotografe a etiqueta do dispositivo para capturar o IMEI.</li>
                          <li>Em seguida fotografe o chip para capturar o ICCID.</li>
                          <li>Se a leitura falhar, use a digitacao manual como fallback.</li>
                          <li>Os campos do formulario serao preenchidos automaticamente.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="model">Modelo do Rastreador</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) =>
                        setFormData({ ...formData, model: e.target.value })
                      }
                      placeholder="Ex: GT06, TK103, Concox"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoria *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Carro</SelectItem>
                        <SelectItem value="motorcycle">Moto</SelectItem>
                        <SelectItem value="truck">Caminhão</SelectItem>
                        <SelectItem value="bus">Ônibus</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="trailer">Carreta</SelectItem>
                        <SelectItem value="bicycle">Bicicleta</SelectItem>
                        <SelectItem value="boat">Barco</SelectItem>
                        <SelectItem value="airplane">Avião</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="contact">Contato / Responsável</Label>
                  <Input
                    id="contact"
                    value={formData.contact}
                    onChange={(e) =>
                      setFormData({ ...formData, contact: e.target.value })
                    }
                    placeholder="Ex: João Silva - Motorista"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="speedLimit">
                      Limite de Velocidade (km/h) *
                    </Label>
                    <Input
                      id="speedLimit"
                      type="number"
                      value={formData.speedLimit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          speedLimit: parseInt(e.target.value) || 80,
                        })
                      }
                      placeholder="80"
                      min="10"
                      max="200"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Alerta ao exceder este limite
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="odometer">Hodômetro (km)</Label>
                    <Input
                      id="odometer"
                      type="number"
                      value={formData.odometer}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          odometer: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ajusta o hodômetro do veículo
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingDevice ? "Atualizar Veículo" : "Criar Veículo"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* ── Painel de Compartilhamentos Ativos ──────────────────────────────── */}
      {Array.from(activeSharesMap.values()).flat().length > 0 && (
        <div className="rounded-2xl border border-green-500/25 bg-green-500/[0.04] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-green-500/15">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-green-500/15 border border-green-500/25">
                <Wifi className="w-3.5 h-3.5 text-green-400" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 text-[8px] font-bold text-white flex items-center justify-center">
                  {Array.from(activeSharesMap.values()).flat().length}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-green-400">
                  Compartilhamentos Ativos
                </p>
                <p className="text-[11px] text-green-500/70">
                  Terceiros podem ver a localização em tempo real
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 px-3"
              onClick={async () => {
                const all = Array.from(activeSharesMap.values()).flat();
                for (const s of all)
                  await handleRevokeInline(s.shareId, s.deviceId);
              }}
              disabled={!!revokingId}
            >
              <ShieldOff className="w-3.5 h-3.5 mr-1.5" />
              Encerrar todos
            </Button>
          </div>

          {/* Lista de shares */}
          <div className="divide-y divide-green-500/10">
            {Array.from(activeSharesMap.entries()).map(([deviceId, shares]) =>
              shares.map((share) => (
                <div
                  key={share.shareId}
                  className="flex items-center gap-4 px-4 py-2.5 hover:bg-green-500/[0.04] transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <div className="w-48 shrink-0">
                    <p className="text-sm font-semibold text-white leading-tight truncate">
                      {share.deviceName}
                    </p>
                    {share.plate && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {share.plate}
                      </p>
                    )}
                  </div>
                  <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground w-36 shrink-0">
                    <Clock className="w-3 h-3 shrink-0" />
                    Criado às{" "}
                    {new Date(share.createdAt).toLocaleTimeString("pt-BR")}
                  </div>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      Expira em
                    </span>
                    <ShareCountdown expiresAt={share.expiresAt} />
                    <span className="text-[10px] text-muted-foreground hidden sm:inline shrink-0">
                      ({new Date(share.expiresAt).toLocaleTimeString("pt-BR")})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent border border-border"
                      onClick={() => {
                        const device = devices.find((d) => d.id === deviceId);
                        if (device) {
                          setShareDevice(device);
                          setIsShareOpen(true);
                        }
                      }}
                    >
                      <Share2 className="w-3 h-3 mr-1" />
                      Gerenciar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                      onClick={() =>
                        handleRevokeInline(share.shareId, deviceId)
                      }
                      disabled={revokingId === share.shareId}
                    >
                      {revokingId === share.shareId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <ShieldOff className="w-3.5 h-3.5 mr-1" />
                          Encerrar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )),
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <Card className="backdrop-blur-xl bg-card/90 border-border">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por placa ou nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="moving">Em movimento</SelectItem>
                <SelectItem value="stopped">Parado</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="car">Carro</SelectItem>
                <SelectItem value="motorcycle">Moto</SelectItem>
                <SelectItem value="truck">Caminhão</SelectItem>
                <SelectItem value="bus">Ônibus</SelectItem>
                <SelectItem value="van">Van</SelectItem>
                <SelectItem value="trailer">Carreta</SelectItem>
                <SelectItem value="bicycle">Bicicleta</SelectItem>
                <SelectItem value="boat">Barco</SelectItem>
                <SelectItem value="airplane">Avião</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <DataTableCard
        isLoading={isLoading}
        isEmpty={filteredDevices.length === 0}
        cardClassName="backdrop-blur-xl bg-card/90 border-border"
        contentClassName="pt-6"
        loadingRows={5}
        skeletonClassName="h-16 w-full"
        emptyState={
          <div className="text-center py-12">
            <Filter className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum veículo encontrado com os filtros aplicados
            </p>
          </div>
        }
      >
        <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-bold">Placa</TableHead>
                  <TableHead className="font-bold">Nome</TableHead>
                  <TableHead className="font-bold">IMEI / ID</TableHead>
                  <TableHead className="font-bold">Chip (SIM)</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Hodômetro</TableHead>
                  <TableHead className="font-bold">Sensores</TableHead>
                  <TableHead className="font-bold">
                    Última Atualização
                  </TableHead>
                  <TableHead className="font-bold text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device) => {
                  const position = positionsMap.get(device.id);
                  const deviceShares = activeSharesMap.get(device.id) || [];
                  const hasShares = deviceShares.length > 0;
                  const isExpanded = expandedShares.has(device.id);
                  return (
                    <Fragment key={device.id}>
                      <TableRow className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-950/20 dark:hover:to-purple-950/20 transition-all">
                        <TableCell className="font-bold">
                          {device.plate}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{device.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {device.model}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {device.uniqueId}
                          </code>
                        </TableCell>
                        <TableCell>
                          {device.phone ? (
                            <span className="text-xs">{device.phone}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const effectiveStatus = deriveDeviceStatus(
                              device.status,
                              position,
                            );
                            return (
                              <Badge
                                className={getDeviceStatusColor(
                                  effectiveStatus,
                                )}
                              >
                                {getDeviceStatusLabel(effectiveStatus)}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="font-medium text-indigo-600 dark:text-indigo-400">
                              {position?.attributes.totalDistance
                                ? `${(position.attributes.totalDistance / 1000).toFixed(1)} km`
                                : position?.attributes.odometer
                                  ? `${position.attributes.odometer.toLocaleString("pt-BR")} km`
                                  : "0 km"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${position?.attributes.ignition ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                            >
                              <Zap className="w-3 h-3" />
                              {position?.attributes.ignition ? "ON" : "OFF"}
                            </div>
                            <div
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${position?.attributes.motion ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                            >
                              <Activity className="w-3 h-3" />
                              {position?.attributes.motion ? "MOV" : "STOP"}
                            </div>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400">
                              <Satellite className="w-3 h-3" />
                              {position?.attributes.sat || 0}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(device.lastUpdate)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <RowActionsMenu
                              label={`Ações de ${device.name}`}
                              indicator={hasShares ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-background bg-green-400 animate-pulse" /> : undefined}
                            >
                                <RowActionsMenuItem icon={Edit} onClick={() => handleEdit(device)}>
                                  Editar veículo
                                </RowActionsMenuItem>
                                <RowActionsMenuItem
                                  icon={MapPin}
                                  onClick={() => router.push(`/map?deviceId=${device.id}`)}
                                >
                                  Ver no mapa
                                </RowActionsMenuItem>
                                {can("commands") && (
                                  <RowActionsMenuItem
                                    icon={Terminal}
                                    onClick={() => {
                                      setCommandDevice(device);
                                      setIsCommandOpen(true);
                                    }}
                                    className="text-blue-600 focus:text-blue-600"
                                  >
                                    Enviar comando
                                  </RowActionsMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <RowActionsMenuItem
                                  icon={Share2}
                                  onClick={() => {
                                    if (hasShares) {
                                      setExpandedShares((prev) => {
                                        const next = new Set(prev);
                                        next.has(device.id)
                                          ? next.delete(device.id)
                                          : next.add(device.id);
                                        return next;
                                      });
                                      return;
                                    }

                                    setShareDevice(device);
                                    setIsShareOpen(true);
                                  }}
                                  className={hasShares ? "text-green-500 focus:text-green-500" : "text-sky-500 focus:text-sky-500"}
                                >
                                  {hasShares
                                    ? `${isExpanded ? "Ocultar" : "Ver"} compartilhamentos (${deviceShares.length})`
                                    : "Compartilhar localização"}
                                </RowActionsMenuItem>
                                {hasShares && (
                                  <RowActionsMenuItem
                                    icon={ChevronDown}
                                    onClick={() => {
                                      setShareDevice(device);
                                      setIsShareOpen(true);
                                    }}
                                    className="text-sky-500 focus:text-sky-500"
                                  >
                                    Novo link de compartilhamento
                                  </RowActionsMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <RowActionsMenuItem
                                  icon={Trash2}
                                  onClick={() => handleDelete(device.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  Remover veículo
                                </RowActionsMenuItem>
                            </RowActionsMenu>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Sub-linha de shares ativos */}
                      {hasShares && isExpanded && (
                        <TableRow
                          key={`share-${device.id}`}
                          className="bg-green-500/[0.03] hover:bg-green-500/[0.05]"
                        >
                          <TableCell colSpan={9} className="py-0">
                            <div className="py-2 px-3 space-y-1.5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-green-500 flex items-center gap-1.5">
                                  <Wifi className="w-3 h-3" />
                                  {deviceShares.length} link
                                  {deviceShares.length > 1 ? "s" : ""} de
                                  compartilhamento ativo
                                  {deviceShares.length > 1 ? "s" : ""}
                                </span>
                                <div className="flex items-center gap-2">
                                  {deviceShares.length > 1 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
                                      onClick={async () => {
                                        for (const s of deviceShares)
                                          await handleRevokeInline(
                                            s.shareId,
                                            device.id,
                                          );
                                      }}
                                      disabled={!!revokingId}
                                    >
                                      <ShieldOff className="w-3 h-3 mr-1" />
                                      Revogar todos
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 px-2"
                                    onClick={() => {
                                      setShareDevice(device);
                                      setIsShareOpen(true);
                                    }}
                                  >
                                    <Share2 className="w-3 h-3 mr-1" />
                                    Novo link
                                  </Button>
                                </div>
                              </div>
                              {deviceShares.map((share) => (
                                <div
                                  key={share.shareId}
                                  className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-black/10 border border-green-500/15"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                                  <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <ShareCountdown expiresAt={share.expiresAt} />
                                  <span className="text-[10px] text-muted-foreground flex-1">
                                    Criado às{" "}
                                    {new Date(
                                      share.createdAt,
                                    ).toLocaleTimeString("pt-BR")}
                                    {" • "}
                                    Expira{" "}
                                    {new Date(
                                      share.expiresAt,
                                    ).toLocaleTimeString("pt-BR")}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                                    onClick={() =>
                                      handleRevokeInline(
                                        share.shareId,
                                        device.id,
                                      )
                                    }
                                    disabled={revokingId === share.shareId}
                                  >
                                    {revokingId === share.shareId ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <>
                                        <ShieldOff className="w-3 h-3 mr-1" />
                                        Revogar
                                      </>
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
        </Table>
      </DataTableCard>

      <ShareLocationDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        device={shareDevice}
        onShareChange={refreshActiveShares}
      />

      <SendCommandDialog
        device={commandDevice}
        open={isCommandOpen}
        onOpenChange={setIsCommandOpen}
      />
    </div>
  );
}
