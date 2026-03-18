"use client";

import { Device, VehicleCategory } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { getGroups } from "@/lib/api/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { MapEditForm } from "@/lib/hooks/useMapState";

interface EditVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingDevice: Device | null;
  editForm: MapEditForm;
  onEditFormChange: (form: MapEditForm) => void;
  onSave: () => void;
  isPending: boolean;
}

export function EditVehicleDialog({
  open,
  onOpenChange,
  editingDevice,
  editForm,
  onEditFormChange,
  onSave,
  isPending,
}: EditVehicleDialogProps) {
  const updateField = <K extends keyof MapEditForm>(
    key: K,
    value: MapEditForm[K],
  ) => {
    onEditFormChange({ ...editForm, [key]: value });
  };

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: getGroups,
    staleTime: 60_000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Veículo</DialogTitle>
          {editingDevice && (
            <DialogDescription className="text-xs">
              {editingDevice.plate} — {editingDevice.name}
            </DialogDescription>
          )}
        </DialogHeader>
        {editingDevice && (
          <div className="space-y-5">
            {/* ── Identificação ── */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificação</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Nome do Veículo *</Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Ex: Caminhão Branco"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uniqueId" className="text-xs">Identificador (IMEI) *</Label>
                  <Input
                    id="uniqueId"
                    value={editForm.uniqueId}
                    onChange={(e) => updateField("uniqueId", e.target.value)}
                    placeholder="864943044660344"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plate" className="text-xs">Placa *</Label>
                  <Input
                    id="plate"
                    value={editForm.plate}
                    onChange={(e) => updateField("plate", e.target.value.toUpperCase())}
                    placeholder="ABC-1234"
                    maxLength={8}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Detalhes do Veículo ── */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalhes</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs">Categoria *</Label>
                  <Select
                    value={editForm.category}
                    onValueChange={(v) => updateField("category", v as VehicleCategory)}
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
                <div className="space-y-1.5">
                  <Label htmlFor="groupId" className="text-xs">Grupo</Label>
                  <Select
                    value={editForm.groupId ? editForm.groupId.toString() : "0"}
                    onValueChange={(v) => updateField("groupId", parseInt(v) || 0)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sem grupo</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="model" className="text-xs">Modelo</Label>
                  <Input
                    id="model"
                    value={editForm.model}
                    onChange={(e) => updateField("model", e.target.value)}
                    placeholder="Ex: Hilux SW4"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="year" className="text-xs">Ano</Label>
                  <Input
                    id="year"
                    type="number"
                    value={editForm.year}
                    onChange={(e) => updateField("year", parseInt(e.target.value) || 2024)}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="color" className="text-xs">Cor</Label>
                  <Input
                    id="color"
                    value={editForm.color}
                    onChange={(e) => updateField("color", e.target.value)}
                    placeholder="Ex: Branco"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="speedLimit" className="text-xs">Limite de Velocidade</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="speedLimit"
                      type="number"
                      value={editForm.speedLimit}
                      onChange={(e) => updateField("speedLimit", parseInt(e.target.value) || 80)}
                      min="10"
                      max="200"
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground">km/h</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Comunicação ── */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comunicação</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs">Telefone (SIM Card)</Label>
                  <Input
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="5562999958024"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact" className="text-xs">Contato / ICCID</Label>
                  <Input
                    id="contact"
                    value={editForm.contact}
                    onChange={(e) => updateField("contact", e.target.value)}
                    placeholder="ICCID do chip"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="expiryDate" className="text-xs">Validade do Rastreador</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={editForm.expiryDate}
                    onChange={(e) => updateField("expiryDate", e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Data de vencimento do contrato</p>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={onSave}
                className="flex-1"
                disabled={isPending}
              >
                {isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
