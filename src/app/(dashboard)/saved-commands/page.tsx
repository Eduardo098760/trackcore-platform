"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TraccarCommand } from "@/types";
import {
  getSavedCommands,
  createSavedCommand,
  updateSavedCommand,
  deleteSavedCommand,
} from "@/lib/api";
import { getDevices } from "@/lib/api/devices";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTableCard } from "@/components/ui/data-table-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileCog,
  Plus,
  Edit,
  Trash2,
  Search,
  Terminal,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { BASE_COMMAND_TYPES, getBaseCommandLabel } from "@/lib/commands/catalog";

const COMMAND_TYPES = [
  ...BASE_COMMAND_TYPES.map(({ value, label }) => ({ value, label })),
  { value: "setTimezone", label: "Definir Fuso Horário" },
  { value: "sendSms", label: "Enviar SMS" },
  { value: "sendUssd", label: "Enviar USSD" },
  { value: "sosNumber", label: "Número SOS" },
  { value: "silenceTime", label: "Modo Silencioso" },
  { value: "setIndicator", label: "Configurar Indicador" },
  { value: "configuration", label: "Configuração" },
  { value: "setConnection", label: "Configurar Conexão" },
  { value: "setOdometer", label: "Definir Odômetro" },
  { value: "modePowerSaving", label: "Modo Economia" },
  { value: "modeDeepSleep", label: "Modo Sleep" },
  { value: "alarmArm", label: "Armar Alarme" },
  { value: "alarmDisarm", label: "Desarmar Alarme" },
  { value: "requestPhoto", label: "Solicitar Foto" },
];

const getCommandTypeLabel = (type: string) => {
  return COMMAND_TYPES.find((t) => t.value === type)?.label || getBaseCommandLabel(type);
};

export default function SavedCommandsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<TraccarCommand | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    type: "custom",
    textChannel: false,
    attributes: {} as Record<string, any>,
  });

  const { data: commands = [], isLoading } = useQuery({
    queryKey: ["saved-commands"],
    queryFn: () => getSavedCommands(),
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: () => getDevices(),
  });

  const createMutation = useMutation({
    mutationFn: createSavedCommand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-commands"] });
      toast.success("Comando salvo com sucesso!");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar comando"),
  });

  const updateMutation = useMutation({
    mutationFn: updateSavedCommand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-commands"] });
      toast.success("Comando atualizado!");
      closeDialog();
    },
    onError: () => toast.error("Erro ao atualizar comando"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSavedCommand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-commands"] });
      toast.success("Comando excluído!");
    },
    onError: () => toast.error("Erro ao excluir comando"),
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCommand(null);
    setFormData({ description: "", type: "custom", textChannel: false, attributes: {} });
  };

  const handleEdit = (cmd: TraccarCommand) => {
    setEditingCommand(cmd);
    setFormData({
      description: cmd.description || "",
      type: cmd.type,
      textChannel: cmd.textChannel || false,
      attributes: cmd.attributes || {},
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.type) {
      toast.error("Selecione um tipo de comando");
      return;
    }

    if (editingCommand) {
      updateMutation.mutate({
        ...editingCommand,
        description: formData.description,
        type: formData.type,
        textChannel: formData.textChannel,
        attributes: formData.attributes,
      });
    } else {
      createSavedCommand({
        deviceId: 0,
        type: formData.type,
        description: formData.description,
        textChannel: formData.textChannel,
        attributes: formData.attributes,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["saved-commands"] });
        toast.success("Comando salvo com sucesso!");
        closeDialog();
      }).catch(() => toast.error("Erro ao salvar comando"));
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Excluir este comando salvo?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredCommands = commands.filter((cmd) => {
    const desc = cmd.description?.toLowerCase() || "";
    const type = getCommandTypeLabel(cmd.type).toLowerCase();
    const q = searchQuery.toLowerCase();
    return desc.includes(q) || type.includes(q);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileCog}
        title="Comandos Salvos"
        description="Passo 3: salve modelos de comandos personalizados para reutilizar na tela de Comandos com a empresa já definida na Configuração SMS."
      />

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Hierarquia das telas</p>
            <p className="text-xs text-muted-foreground">
              1. Configuração SMS define qual empresa fará o envio.
            </p>
            <p className="text-xs text-muted-foreground">
              2. Comandos executa o disparo usando essa empresa.
            </p>
            <p className="text-xs text-muted-foreground">
              3. Comandos Salvos armazena modelos personalizados para você reaproveitar no envio.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar comando..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Comando
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Comandos</CardTitle>
            <FileCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{commands.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personalizados</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {commands.filter((c) => c.type === "custom").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Via SMS</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {commands.filter((c) => c.textChannel).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <DataTableCard
        isLoading={isLoading}
        isEmpty={filteredCommands.length === 0}
        contentClassName="p-0"
        loadingRows={3}
        loadingClassName="p-6 space-y-3"
        emptyState={
          <div className="p-12 text-center text-muted-foreground">
            <FileCog className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum comando salvo encontrado</p>
            <p className="text-sm">Crie comandos salvos para reutilizar o mesmo padrão de envio nos seus veículos</p>
          </div>
        }
      >
        <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Dados</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommands.map((cmd) => (
                  <TableRow key={cmd.id}>
                    <TableCell className="font-medium">
                      {cmd.description || "Sem descrição"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getCommandTypeLabel(cmd.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cmd.textChannel ? "default" : "outline"}>
                        {cmd.textChannel ? "SMS" : "GPRS"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {cmd.attributes?.data || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ActionIconButton
                          size="icon"
                          onClick={() => handleEdit(cmd)}
                          label="Editar comando salvo"
                        >
                          <Edit className="h-4 w-4" />
                        </ActionIconButton>
                        <ActionIconButton
                          size="icon"
                          onClick={() => handleDelete(cmd.id)}
                          label="Excluir comando salvo"
                          destructive
                        >
                          <Trash2 className="h-4 w-4" />
                        </ActionIconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      </DataTableCard>

      {/* Dialog Criar/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCommand ? "Editar comando salvo" : "Novo comando salvo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Bloquear motor - GT06"
              />
            </div>

            <div>
              <Label>Tipo de comando</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {COMMAND_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Enviar via SMS</Label>
                <p className="text-xs text-muted-foreground">Quando usado, este modelo seguirá a empresa definida na tela Configuração SMS</p>
              </div>
              <Switch
                checked={formData.textChannel}
                onCheckedChange={(v) => setFormData({ ...formData, textChannel: v })}
              />
            </div>

            {formData.type === "custom" && (
              <div>
                <Label>Comando (texto)</Label>
                <Input
                  value={formData.attributes.data || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attributes: { ...formData.attributes, data: e.target.value },
                    })
                  }
                  placeholder="Ex: relay,1#"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Texto que será enviado exatamente como digitado na hora do disparo
                </p>
              </div>
            )}

            {formData.type === "setOdometer" && (
              <div>
                <Label>Odômetro (metros)</Label>
                <Input
                  type="number"
                  value={formData.attributes.data || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attributes: { ...formData.attributes, data: e.target.value },
                    })
                  }
                  placeholder="0"
                />
              </div>
            )}

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingCommand ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
