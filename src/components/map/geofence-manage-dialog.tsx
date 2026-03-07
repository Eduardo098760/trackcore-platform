"use client";

import { Device } from "@/types";
import type { Geofence } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck } from "lucide-react";

interface GeofenceManageDialogProps {
  device: Device | null;
  onOpenChange: (open: boolean) => void;
  allGeofences: Geofence[];
  deviceGeofenceIds: Set<number>;
  assigningGeofenceId: number | null;
  onToggleGeofence: (geofenceId: number) => void;
}

export function GeofenceManageDialog({
  device,
  onOpenChange,
  allGeofences,
  deviceGeofenceIds,
  assigningGeofenceId,
  onToggleGeofence,
}: GeofenceManageDialogProps) {
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
              const isLinked = deviceGeofenceIds.has(geofence.id);
              const isLoading = assigningGeofenceId === geofence.id;
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
                      <p className="text-xs text-muted-foreground">
                        {geofence.type}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isLinked ? "destructive" : "default"}
                    disabled={isLoading}
                    onClick={() => onToggleGeofence(geofence.id)}
                    className="flex-shrink-0 ml-2"
                  >
                    {isLoading ? (
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : isLinked ? (
                      "Remover"
                    ) : (
                      "Aplicar"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
