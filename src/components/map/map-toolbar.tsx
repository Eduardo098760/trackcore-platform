"use client";

import { ShieldCheck, Zap, Tag } from "lucide-react";

interface MapToolbarProps {
  showGeofences: boolean;
  onToggleGeofences: () => void;
  geofenceCount: number;
  showSpeedAlerts: boolean;
  onToggleSpeedAlerts: () => void;
  speedAlertCount: number;
  showVehicleLabels: boolean;
  onToggleVehicleLabels: () => void;
}

export function MapToolbar({
  showGeofences,
  onToggleGeofences,
  geofenceCount,
  showSpeedAlerts,
  onToggleSpeedAlerts,
  speedAlertCount,
  showVehicleLabels,
  onToggleVehicleLabels,
}: MapToolbarProps) {
  return (
    <>
      {/* Toggle de cercas */}
      <button
        type="button"
        onClick={onToggleGeofences}
        title={showGeofences ? "Ocultar cercas" : "Mostrar cercas"}
        className={`flex items-center gap-1 xl:gap-1.5 px-2 xl:px-3 py-1.5 xl:py-2 rounded-lg text-[11px] xl:text-xs font-medium transition-colors shadow-lg backdrop-blur-xl border ${
          showGeofences
            ? "bg-orange-500/80 border-orange-400/50 text-white"
            : "bg-popover/60 border-border text-muted-foreground hover:bg-accent"
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        Cercas {geofenceCount > 0 && `(${geofenceCount})`}
      </button>

      {/* Toggle de alertas de velocidade */}
      <button
        type="button"
        onClick={onToggleSpeedAlerts}
        title={
          showSpeedAlerts
            ? "Ocultar alertas de velocidade"
            : "Mostrar alertas de velocidade"
        }
        className={`flex items-center gap-1 xl:gap-1.5 px-2 xl:px-3 py-1.5 xl:py-2 rounded-lg text-[11px] xl:text-xs font-medium transition-colors shadow-lg backdrop-blur-xl border ${
          showSpeedAlerts && speedAlertCount > 0
            ? "bg-amber-500/80 border-amber-400/50 text-white"
            : "bg-popover/60 border-border text-muted-foreground hover:bg-accent"
        }`}
      >
        <Zap className="w-3.5 h-3.5" />
        Excessos {speedAlertCount > 0 && `(${speedAlertCount})`}
      </button>

      {/* Toggle de placas nos marcadores */}
      <button
        type="button"
        onClick={onToggleVehicleLabels}
        title={
          showVehicleLabels
            ? "Ocultar placas nos marcadores"
            : "Mostrar placas nos marcadores"
        }
        className={`flex items-center gap-1 xl:gap-1.5 px-2 xl:px-3 py-1.5 xl:py-2 rounded-lg text-[11px] xl:text-xs font-medium transition-colors shadow-lg backdrop-blur-xl border ${
          showVehicleLabels
            ? "bg-sky-500/80 border-sky-400/50 text-white"
            : "bg-popover/60 border-border text-muted-foreground hover:bg-accent"
        }`}
      >
        <Tag className="w-3.5 h-3.5" />
        Placas
      </button>
    </>
  );
}
