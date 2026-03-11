"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Device, Position } from "@/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getMarkerColor } from "@/components/map/map-constants";
import { getVehicleIcon } from "@/lib/vehicle-icons";
import { deriveDeviceStatus } from "@/lib/utils";
import {
  Zap,
  ZapOff,
  Navigation2,
  Battery,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Radio,
  List,
  Lock,
} from "lucide-react";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";

type StatusFilter = "all" | "moving" | "stopped" | "offline";

interface VehicleListPanelProps {
  devices: Device[];
  positionsMap: Map<number, Position>;
  selectedDeviceId: number | null;
  onDeviceClick: (device: Device) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const STATUS_FILTERS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all", label: "Todos", color: "bg-white/10" },
  { key: "moving", label: "Movendo", color: "bg-blue-500" },
  { key: "stopped", label: "Parado", color: "bg-green-500" },
  { key: "offline", label: "Offline", color: "bg-gray-500" },
];

function getStatusCounts(devices: Device[], positionsMap: Map<number, Position>) {
  const counts: Record<StatusFilter, number> = {
    all: devices.length,
    moving: 0,
    stopped: 0,
    offline: 0,
  };
  devices.forEach((d) => {
    const pos = positionsMap.get(d.id);
    const s = deriveDeviceStatus(d.status, pos, d.lastUpdate);
    if (s === "moving") counts.moving++;
    else if (s === "offline") counts.offline++;
    else counts.stopped++; // online, stopped, blocked → Parado
  });
  return counts;
}

function BatteryIndicator({ level }: { level: number }) {
  const color =
    level > 60
      ? "text-green-400"
      : level > 20
        ? "text-yellow-400"
        : "text-red-400";
  return (
    <div className={`flex items-center gap-0.5 ${color}`}>
      <Battery className="w-3 h-3" />
      <span className="text-[9px] font-medium">{level}%</span>
    </div>
  );
}

function LastSeenLabel({ lastUpdate }: { lastUpdate?: string | null }) {
  const relTime = useRelativeTime(lastUpdate);
  if (!relTime) return null;
  return (
    <div className="flex items-center gap-1 mt-0.5 text-[9px] text-gray-500">
      <Radio className="w-2.5 h-2.5" />
      <span>{relTime}</span>
    </div>
  );
}

export function VehicleListPanel({
  devices,
  positionsMap,
  selectedDeviceId,
  onDeviceClick,
  isOpen,
  onToggle,
}: VehicleListPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [localSearch, setLocalSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [firstOpen, setFirstOpen] = useState(() => {
    try {
      return !localStorage.getItem("vehicleListSeen");
    } catch {
      return false;
    }
  });

  // Clear first-open pulse after a few seconds
  useEffect(() => {
    if (isOpen && firstOpen) {
      const t = setTimeout(() => {
        setFirstOpen(false);
        try { localStorage.setItem("vehicleListSeen", "1"); } catch {}
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [isOpen, firstOpen]);

  // Focus search when panel opens
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Derive effective status for each device once
  const devicesWithStatus = useMemo(() => {
    return devices.map((d) => {
      const pos = positionsMap.get(d.id);
      const effective = deriveDeviceStatus(d.status, pos, d.lastUpdate);
      // Normalize: online/stopped/blocked → "stopped" (Parado)
      const normalized = effective === "moving" || effective === "offline" ? effective : "stopped";
      return { device: d, effectiveStatus: normalized as StatusFilter };
    });
  }, [devices, positionsMap]);

  const statusCounts = useMemo(() => getStatusCounts(devices, positionsMap), [devices, positionsMap]);

  // Filter by local search term
  const searchFiltered = useMemo(() => {
    if (!localSearch) return devicesWithStatus;
    const term = localSearch.toLowerCase();
    return devicesWithStatus.filter(
      ({ device: d }) =>
        d.name?.toLowerCase().includes(term) ||
        d.plate?.toLowerCase().includes(term) ||
        d.uniqueId?.toLowerCase().includes(term),
    );
  }, [devicesWithStatus, localSearch]);

  // Filter by status
  const filteredDevices = useMemo(() => {
    if (statusFilter === "all") return searchFiltered;
    return searchFiltered.filter(({ effectiveStatus }) => effectiveStatus === statusFilter);
  }, [searchFiltered, statusFilter]);

  // Sort: moving first, then stopped, then offline
  const sortedDevices = useMemo(() => {
    const order: Record<string, number> = {
      moving: 0,
      stopped: 1,
      offline: 2,
    };
    return [...filteredDevices].sort(
      (a, b) => (order[a.effectiveStatus] ?? 3) - (order[b.effectiveStatus] ?? 3),
    );
  }, [filteredDevices]);

  return (
    <>
      {/* Side tab handle — visible when panel is closed */}
      {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-[1001] group"
          title="Abrir lista de veículos"
        >
          <div className="flex items-center bg-black/70 backdrop-blur-xl border border-white/10 border-l-0 rounded-r-xl px-1.5 py-4 shadow-2xl transition-all hover:bg-black/80 hover:px-2.5 group-hover:border-blue-500/30">
            <ChevronRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <div className="flex flex-col items-center ml-0.5">
              <List className="w-3.5 h-3.5 text-blue-400 mb-1" />
              <span className="text-[10px] font-bold text-blue-300 tracking-widest [writing-mode:vertical-lr] rotate-180">
                VEÍCULOS
              </span>
              <span className="mt-1 text-[9px] font-mono text-blue-400 bg-blue-500/15 px-1 py-0.5 rounded">
                {devices.length}
              </span>
            </div>
          </div>
        </button>
      )}

      {/* Slide-out panel */}
      <div
        className={`absolute top-0 left-0 h-full z-[1000] transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: 320 }}
      >
        <Card className={`h-full rounded-none rounded-r-2xl backdrop-blur-2xl bg-black/70 dark:bg-black/80 border-y-0 border-l-0 border-r border-white/10 shadow-2xl flex flex-col overflow-hidden ${firstOpen ? 'ring-2 ring-blue-500/60 ring-offset-0 animate-pulse' : ''}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="font-semibold text-sm text-gray-100 flex items-center gap-2">
              <Navigation2 className="w-4 h-4 text-blue-400" />
              Veículos
              <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                {filteredDevices.length !== devices.length
                  ? `${filteredDevices.length}/${devices.length}`
                  : devices.length}
              </span>
            </h3>
            <button
              type="button"
              onClick={onToggle}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Fechar lista"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <Input
                ref={searchInputRef}
                type="search"
                placeholder="Buscar veículo, placa..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="h-8 pl-8 pr-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:bg-white/10 focus:border-blue-500/50"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => setLocalSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex gap-1 flex-wrap px-4 pb-3">
            {STATUS_FILTERS.map((f) => {
              const count = statusCounts[f.key];
              const isActive = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                    isActive
                      ? "bg-white/15 text-white ring-1 ring-white/20"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {f.key !== "all" && (
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${f.color} ${
                        f.key === "moving" && isActive ? "animate-pulse" : ""
                      }`}
                    />
                  )}
                  {f.label}
                  <span className="text-[9px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Vehicle list — scrollable */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scrollbar-thin scrollbar-thumb-blue-600/30 scrollbar-track-transparent">
            {sortedDevices.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                <Search className="w-6 h-6 mb-2 opacity-30" />
                <span className="text-xs">Nenhum veículo encontrado</span>
                {localSearch && (
                  <button
                    type="button"
                    onClick={() => setLocalSearch("")}
                    className="text-[10px] text-blue-400 hover:underline mt-1"
                  >
                    Limpar busca
                  </button>
                )}
              </div>
            )}

            {sortedDevices.map(({ device, effectiveStatus }) => {
              const position = positionsMap.get(device.id);
              const isSelected = selectedDeviceId === device.id;
              const isIgnitionOn = position?.attributes?.ignition;
              const batteryLevel = position?.attributes?.batteryLevel;
              const IconComponent = getVehicleIcon(device.category);

              return (
                <button
                  key={device.id}
                  onClick={() => onDeviceClick(device)}
                  className={`w-full px-2.5 py-2 rounded-lg text-left transition-all group ${
                    isSelected
                      ? "bg-blue-600/30 ring-1 ring-blue-500/50 text-white"
                      : "bg-white/[0.03] hover:bg-white/[0.08] text-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Status dot + Vehicle icon */}
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10"
                        style={{
                          background: `${getMarkerColor(effectiveStatus)}22`,
                        }}
                      >
                        <IconComponent
                          className="w-4 h-4"
                          style={{ color: getMarkerColor(effectiveStatus) }}
                        />
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black/80 ${
                          effectiveStatus === "moving"
                            ? "bg-blue-500 animate-pulse"
                            : effectiveStatus === "stopped"
                              ? "bg-green-500"
                              : "bg-gray-500"
                        }`}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold truncate text-xs leading-tight">
                          {device.name || device.plate}
                        </span>
                        {position && position.speed > 0 && (
                          <span
                            className={`text-[10px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded ${
                              device.speedLimit &&
                              position.speed > device.speedLimit
                                ? "bg-red-500/20 text-red-400"
                                : "bg-blue-500/15 text-blue-300"
                            }`}
                          >
                            {Math.round(position.speed)} km/h
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        {device.plate && (
                          <span className="text-[9px] text-gray-500 font-mono tracking-wide">
                            {device.plate}
                          </span>
                        )}

                        {/* Ignition indicator */}
                        <div
                          className={`flex items-center ${
                            isIgnitionOn ? "text-yellow-400" : "text-gray-600"
                          }`}
                          title={
                            isIgnitionOn
                              ? "Ignição ligada"
                              : "Ignição desligada"
                          }
                        >
                          {isIgnitionOn ? (
                            <Zap className="w-2.5 h-2.5" />
                          ) : (
                            <ZapOff className="w-2.5 h-2.5" />
                          )}
                        </div>

                        {/* Battery */}
                        {typeof batteryLevel === "number" &&
                          batteryLevel > 0 && (
                            <BatteryIndicator level={batteryLevel} />
                          )}

                        {/* Blocked */}
                        {device.attributes?.blocked && (
                          <div
                            className="flex items-center text-red-400"
                            title="Veículo bloqueado"
                          >
                            <Lock className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>

                      {/* Last seen */}
                      <LastSeenLabel lastUpdate={device.lastUpdate} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
