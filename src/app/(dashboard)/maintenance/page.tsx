"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDevices } from "@/lib/api";
import {
  getMaintenances,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  linkMaintenanceToDevice,
} from "@/lib/api/maintenance";
import { Maintenance, Device } from "@/types";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTableCard } from "@/components/ui/data-table-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Wrench,
  Calendar,
  DollarSign,
  Gauge,
  CheckCircle,
  Clock,
  AlertTriangle,
  Car,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

// ─── Constantes ──────────────────────────────────────────────────
const MAINTENANCE_TYPES: { value: Maintenance["type"]; label: string }[] = [
  { value: "oil_change", label: "Troca de Óleo" },
  { value: "tire_rotation", label: "Rodízio de Pneus" },
  { value: "brake_service", label: "Freios" },
  { value: "general_inspection", label: "Revisão Geral" },
  { value: "other", label: "Outro" },
];

const MAINTENANCE_STATUSES: { value: Maintenance["status"]; label: string }[] = [
  { value: "scheduled", label: "Agendada" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "completed", label: "Concluída" },
  { value: "overdue", label: "Atrasada" },
];

function getTypeLabel(type: Maintenance["type"]): string {
  return MAINTENANCE_TYPES.find((t) => t.value === type)?.label ?? type;
}

// ─── Sub-componentes ──────────────────────────────────────────────
function StatusBadge({ status }: { status: Maintenance["status"] }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Concluída
        </Badge>
      );
    case "scheduled":
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Agendada
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
          <Wrench className="w-3 h-3 mr-1" />
          Em Andamento
        </Badge>
      );
    case "overdue":
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Atrasada
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function StatsCards({ maintenances }: { maintenances: Maintenance[] }) {
  const stats = useMemo(() => {
    const scheduled = maintenances.filter((m) => m.status === "scheduled").length;
    const inProgress = maintenances.filter((m) => m.status === "in_progress").length;
    const overdue = maintenances.filter((m) => m.status === "overdue").length;
    const totalCost = maintenances
      .filter((m) => m.status === "completed")
      .reduce((sum, m) => sum + (m.cost || 0), 0);
    return { total: maintenances.length, scheduled, inProgress, overdue, totalCost };
  }, [maintenances]);

  const cards = [
    { label: "Total", value: stats.total, icon: Wrench, color: "" },
    { label: "Agendadas", value: stats.scheduled, icon: Clock, color: "text-blue-500" },
    { label: "Em Andamento", value: stats.inProgress, icon: Wrench, color: "text-orange-500" },
    { label: "Atrasadas", value: stats.overdue, icon: AlertTriangle, color: "text-red-500" },
    {
      label: "Custo Total",
      value: `R$ ${stats.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-green-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
            <c.icon className={`h-4 w-4 ${c.color || "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface MaintenanceFormData {
  deviceId: number;
  type: Maintenance["type"];
  description: string;
  scheduledDate: string;
  cost: number;
  odometer: number;
  nextOdometer: number;
  notes: string;
  status: Maintenance["status"];
}

const defaultFormData: MaintenanceFormData = {
  deviceId: 0,
  type: "oil_change",
  description: "",
  scheduledDate: "",
  cost: 0,
  odometer: 0,
  nextOdometer: 0,
  notes: "",
  status: "scheduled",
};

function MaintenanceFormDialog({
  open,
  onOpenChange,
  editing,
  devices,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Maintenance | null;
  devices: Device[];
  onSubmit: (data: MaintenanceFormData) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState<MaintenanceFormData>(defaultFormData);

  const setField = useCallback(
    <K extends keyof MaintenanceFormData>(key: K, value: MaintenanceFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && editing) {
      setFormData({
        deviceId: editing.deviceId,
        type: editing.type,
        description: editing.description,
        scheduledDate: editing.scheduledDate?.split("T")[0] || "",
        cost: editing.cost || 0,
        odometer: editing.odometer || 0,
        nextOdometer: editing.nextOdometer || 0,
        notes: editing.notes || "",
        status: editing.status,
      });
    } else if (nextOpen) {
      setFormData(defaultFormData);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Manutenção" : "Nova Manutenção"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label className="flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-500" />
              Veículo
            </Label>
            <Select
              value={formData.deviceId ? formData.deviceId.toString() : ""}
              onValueChange={(v) => setField("deviceId", parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um veículo" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id.toString()}>
                    {device.plate ? `${device.plate} — ` : ""}{device.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Manutenção</Label>
            <Select value={formData.type} onValueChange={(v) => setField("type", v as Maintenance["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MAINTENANCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Data Agendada
            </Label>
            <Input type="date" value={formData.scheduledDate} onChange={(e) => setField("scheduledDate", e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Descrição</Label>
            <Input value={formData.description} onChange={(e) => setField("description", e.target.value)} placeholder="Ex: Troca de óleo e filtro" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              Custo (R$)
            </Label>
            <Input type="number" step="0.01" value={formData.cost || ""} onChange={(e) => setField("cost", parseFloat(e.target.value) || 0)} placeholder="0.00" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-500" />
              KM Atual
            </Label>
            <Input type="number" value={formData.odometer || ""} onChange={(e) => setField("odometer", parseInt(e.target.value) || 0)} placeholder="0" />
          </div>

          <div className="space-y-2">
            <Label>Próxima Manutenção (KM)</Label>
            <Input type="number" value={formData.nextOdometer || ""} onChange={(e) => setField("nextOdometer", parseInt(e.target.value) || 0)} placeholder="0" />
          </div>

          {editing && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setField("status", v as Maintenance["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={formData.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Detalhes adicionais sobre a manutenção..." rows={3} />
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={() => onSubmit(formData)} disabled={isPending || !formData.deviceId} className="flex-1">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editing ? "Atualizar" : "Agendar"} Manutenção
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceTable({
  maintenances,
  onEdit,
  onDelete,
  isDeleting,
}: {
  maintenances: Maintenance[];
  onEdit: (m: Maintenance) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) {
  if (maintenances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Wrench className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm">Nenhuma manutenção encontrada</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Veículo</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Agendada Para</TableHead>
          <TableHead>KM</TableHead>
          <TableHead>Custo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {maintenances.map((m) => (
          <TableRow key={m.id}>
            <TableCell><div className="font-medium">{m.deviceName || `Device #${m.deviceId}`}</div></TableCell>
            <TableCell><Badge variant="outline">{getTypeLabel(m.type)}</Badge></TableCell>
            <TableCell className="max-w-xs truncate">{m.description}</TableCell>
            <TableCell className="text-sm">{m.scheduledDate ? formatDate(m.scheduledDate) : "—"}</TableCell>
            <TableCell className="text-sm">{m.odometer ? `${m.odometer.toLocaleString()} km` : "—"}</TableCell>
            <TableCell className="text-sm font-medium">
              {m.cost ? `R$ ${m.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
            </TableCell>
            <TableCell><StatusBadge status={m.status} /></TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <ActionIconButton size="sm" onClick={() => onEdit(m)} label="Editar manutenção"><Edit className="w-4 h-4" /></ActionIconButton>
                <ActionIconButton size="sm" onClick={() => onDelete(m.id)} disabled={isDeleting} label="Excluir manutenção" destructive>
                  <Trash2 className="w-4 h-4" />
                </ActionIconButton>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Página principal ──────────────────────────────────────────────
export default function MaintenancePage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null);

  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: () => getDevices(),
    staleTime: 60_000,
  });

  const devicesMap = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);

  const { data: maintenances = [], isLoading } = useQuery({
    queryKey: ["maintenances"],
    queryFn: () => getMaintenances(),
  });

  const enrichedMaintenances = useMemo(
    () =>
      maintenances.map((m) => {
        if (m.deviceName) return m;
        const dev = devicesMap.get(m.deviceId);
        return dev ? { ...m, deviceName: dev.plate ? `${dev.plate} — ${dev.name}` : dev.name } : m;
      }),
    [maintenances, devicesMap],
  );

  const createMutation = useMutation({
    mutationFn: async (data: MaintenanceFormData) => {
      const dev = devicesMap.get(data.deviceId);
      const payload: Partial<Maintenance> = {
        ...data,
        deviceName: dev ? (dev.plate ? `${dev.plate} — ${dev.name}` : dev.name) : "",
      };
      const result = await createMaintenance(payload);
      if (data.deviceId) {
        try { await linkMaintenanceToDevice(data.deviceId, result.id); } catch {}
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenances"] });
      toast.success("Manutenção agendada com sucesso!");
      setIsDialogOpen(false);
    },
    onError: () => toast.error("Erro ao agendar manutenção"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Maintenance> }) =>
      updateMaintenance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenances"] });
      toast.success("Manutenção atualizada com sucesso!");
      setIsDialogOpen(false);
      setEditingMaintenance(null);
    },
    onError: () => toast.error("Erro ao atualizar manutenção"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMaintenance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenances"] });
      toast.success("Manutenção excluída com sucesso!");
    },
    onError: () => toast.error("Erro ao excluir manutenção"),
  });

  const handleSubmit = useCallback(
    (data: MaintenanceFormData) => {
      if (editingMaintenance) {
        updateMutation.mutate({ id: editingMaintenance.id, data });
      } else {
        createMutation.mutate(data);
      }
    },
    [editingMaintenance, updateMutation, createMutation],
  );

  const handleEdit = useCallback((m: Maintenance) => {
    setEditingMaintenance(m);
    setIsDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: number) => {
      if (confirm("Tem certeza que deseja excluir esta manutenção?")) {
        deleteMutation.mutate(id);
      }
    },
    [deleteMutation],
  );

  const filteredMaintenances = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return enrichedMaintenances.filter((m) => {
      const matchesSearch =
        m.description.toLowerCase().includes(q) ||
        (m.deviceName && m.deviceName.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      const matchesType = typeFilter === "all" || m.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [enrichedMaintenances, searchQuery, statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção"
        description="Gerencie manutenções preventivas e corretivas"
        icon={Wrench}
      />

      <StatsCards maintenances={enrichedMaintenances} />

      {/* Filtros e Ações */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar manutenções..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {MAINTENANCE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                {MAINTENANCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => { setEditingMaintenance(null); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Manutenção
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <DataTableCard isLoading={isLoading} contentClassName="pt-6">
        <MaintenanceTable
          maintenances={filteredMaintenances}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending}
        />
      </DataTableCard>

      <MaintenanceFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editing={editingMaintenance}
        devices={devices}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
