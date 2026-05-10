"use client";

import { Device } from "@/types";
import type { Geofence } from "@/types";
import { parseWKT } from "@/lib/parse-wkt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

interface DevicePosition {
  latitude: number;
  longitude: number;
}

interface GeofenceManageDialogProps {
  device: Device | null;
  onOpenChange: (open: boolean) => void;
  allGeofences: Geofence[];
  deviceGeofenceIds: Set<number>;
  assigningGeofenceId: number | null;
  onToggleGeofence: (geofenceId: number) => void;
  onEditGeofence?: (geofenceId: number) => void;
  devicePosition?: DevicePosition | null;
}

function isPointInsideGeofence(
  position: DevicePosition,
  geofence: Geofence,
): boolean {
  const parsed = parseWKT(geofence.area);
  if (!parsed) return false;

  if (parsed.type === "circle" && parsed.center && parsed.radius) {
    const earthRadius = 6_371_000;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const lat1 = toRad(position.latitude);
    const lat2 = toRad(parsed.center[0]);
    const deltaLat = toRad(parsed.center[0] - position.latitude);
    const deltaLng = toRad(parsed.center[1] - position.longitude);
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    const distance = 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return distance <= parsed.radius;
  }

  if (parsed.type === "polygon" && parsed.coordinates && parsed.coordinates.length >= 3) {
    const x = position.longitude;
    const y = position.latitude;
    let inside = false;

    for (let i = 0, j = parsed.coordinates.length - 1; i < parsed.coordinates.length; j = i++) {
      const xi = parsed.coordinates[i][1];
      const yi = parsed.coordinates[i][0];
      const xj = parsed.coordinates[j][1];
      const yj = parsed.coordinates[j][0];
      const intersects =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
      if (intersects) inside = !inside;
    }

    return inside;
  }

  return false;
}

function isGeofenceLinkedToDevice(geofence: Geofence, deviceId: number, linkedIds: Set<number>): boolean {
  if (linkedIds.has(geofence.id)) return true;
  if (geofence.attributes?.assignToAll === true) return true;
  const storedIds = geofence.attributes?.linkedDeviceIds;
  return Array.isArray(storedIds) ? storedIds.includes(deviceId) : false;
}

export function GeofenceManageDialog({
  device,
  onOpenChange,
  allGeofences,
  deviceGeofenceIds,
  assigningGeofenceId,
  onToggleGeofence,
  onEditGeofence,
  devicePosition,
}: GeofenceManageDialogProps) {
  const getGeofenceTypeLabel = (type: Geofence["type"]) => {
    switch (type) {
      case "circle":
        return "Círculo";
      case "rectangle":
        return "Retângulo";
      case "polygon":
      default:
        return "Polígono";
    }
  };

  return (
    <Dialog
      open={!!device}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-400" />
            Cercas de {device?.name}
          </DialogTitle>
        </DialogHeader>

        {allGeofences.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
            Nenhuma cerca cadastrada. Crie cercas em{" "}
            <strong>/geofences</strong>.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {allGeofences.map((geofence) => {
              const isLinked = device
                ? isGeofenceLinkedToDevice(geofence, device.id, deviceGeofenceIds)
                : deviceGeofenceIds.has(geofence.id);
              const isLoading = assigningGeofenceId === geofence.id;
              const isInsideFence = devicePosition
                ? isPointInsideGeofence(devicePosition, geofence)
                : false;
              return (
                <div
                  key={geofence.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isLinked
                      ? "border-orange-500/50 bg-orange-500/10"
                      : "border-border bg-card/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: geofence.color || "#3b82f6",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {geofence.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {getGeofenceTypeLabel(geofence.type)}
                        </p>
                        {devicePosition && (
                          <Badge variant={isInsideFence ? "default" : "secondary"} className="text-[10px] px-2 py-0 h-5">
                            {isInsideFence ? "Dentro da área" : "Fora da área"}
                          </Badge>
                        )}
                        {isLinked && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-orange-500/40 text-orange-200">
                            Vínculo ativo
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {onEditGeofence && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditGeofence(geofence.id)}
                      >
                        Editar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={isLinked ? "destructive" : "default"}
                      disabled={isLoading}
                      onClick={() => onToggleGeofence(geofence.id)}
                    >
                      {isLoading ? (
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : isLinked ? (
                        "Desvincular"
                      ) : (
                        "Vincular"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
