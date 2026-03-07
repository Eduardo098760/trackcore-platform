"use client";

import { Device, VehicleCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Edit,
  Gauge,
  Car,
  Calendar,
  Palette,
  Phone,
  Circle,
} from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-purple-500" />
            Editar Veículo
          </DialogTitle>
        </DialogHeader>
        {editingDevice && (
          <div className="space-y-4 py-2">
            {/* Info atual */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium">
                Editando: {editingDevice.plate} - {editingDevice.name}
              </p>
            </div>

            {/* Grid de Campos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome do Veículo */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-blue-500" />
                  Nome do Veículo *
                </Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Ex: Caminhão Branco"
                  required
                />
              </div>

              {/* Identificador (IMEI) */}
              <div className="space-y-2">
                <Label htmlFor="uniqueId" className="flex items-center gap-2">
                  <Circle className="w-4 h-4 text-cyan-500" />
                  Identificador (IMEI) *
                </Label>
                <Input
                  id="uniqueId"
                  value={editForm.uniqueId}
                  onChange={(e) => updateField("uniqueId", e.target.value)}
                  placeholder="Ex: 864943044660344"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  IMEI, número de serial ou outro ID único
                </p>
              </div>

              {/* Placa */}
              <div className="space-y-2">
                <Label htmlFor="plate" className="flex items-center gap-2">
                  <Circle className="w-4 h-4 text-green-500" />
                  Placa *
                </Label>
                <Input
                  id="plate"
                  value={editForm.plate}
                  onChange={(e) =>
                    updateField("plate", e.target.value.toUpperCase())
                  }
                  placeholder="ABC-1234"
                  maxLength={8}
                  required
                />
              </div>

              {/* Telefone (SIM) */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-500" />
                  Telefone (SIM Card)
                </Label>
                <Input
                  id="phone"
                  value={editForm.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="Ex: 5562999958024"
                />
                <p className="text-xs text-muted-foreground">
                  Número do chip instalado no rastreador
                </p>
              </div>

              {/* Categoria */}
              <div className="space-y-2">
                <Label htmlFor="category" className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-purple-500" />
                  Categoria *
                </Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) =>
                    updateField("category", value as VehicleCategory)
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

              {/* Modelo */}
              <div className="space-y-2">
                <Label htmlFor="model" className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-indigo-500" />
                  Modelo
                </Label>
                <Input
                  id="model"
                  value={editForm.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  placeholder="Ex: KYX-5E62"
                />
              </div>

              {/* Ano */}
              <div className="space-y-2">
                <Label htmlFor="year" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  Ano
                </Label>
                <Input
                  id="year"
                  type="number"
                  value={editForm.year}
                  onChange={(e) =>
                    updateField("year", parseInt(e.target.value) || 2024)
                  }
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              </div>

              {/* Cor */}
              <div className="space-y-2">
                <Label htmlFor="color" className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-pink-500" />
                  Cor
                </Label>
                <Input
                  id="color"
                  value={editForm.color}
                  onChange={(e) => updateField("color", e.target.value)}
                  placeholder="Ex: Branco"
                />
              </div>

              {/* Contato (ICCID) */}
              <div className="space-y-2">
                <Label htmlFor="contact" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-cyan-500" />
                  Contato / ICCID
                </Label>
                <Input
                  id="contact"
                  value={editForm.contact}
                  onChange={(e) => updateField("contact", e.target.value)}
                  placeholder="Ex: ICCID 8955320210007029201Z"
                />
                <p className="text-xs text-muted-foreground">
                  Nome do responsável ou ICCID do chip
                </p>
              </div>

              {/* Limite de Velocidade */}
              <div className="space-y-2">
                <Label
                  htmlFor="speedLimit"
                  className="flex items-center gap-2"
                >
                  <Gauge className="w-4 h-4 text-yellow-500" />
                  Limite de Velocidade
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="speedLimit"
                    type="number"
                    value={editForm.speedLimit}
                    onChange={(e) =>
                      updateField(
                        "speedLimit",
                        parseInt(e.target.value) || 80,
                      )
                    }
                    min="10"
                    max="200"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">km/h</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alerta quando exceder {editForm.speedLimit} km/h
                </p>
              </div>

              {/* Validade */}
              <div className="space-y-2 md:col-span-2">
                <Label
                  htmlFor="expiryDate"
                  className="flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-red-500" />
                  Validade do Rastreador
                </Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={editForm.expiryDate}
                  onChange={(e) => updateField("expiryDate", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Data de vencimento do contrato ou licença do dispositivo
                </p>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={onSave}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
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
