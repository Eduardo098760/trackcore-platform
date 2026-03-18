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
  Settings2,
} from "lucide-react";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";

type StatusFilter = "all" | "moving" | "stopped" | "offline";
type PanelSize = "sm" | "md" | "lg";

const SIZE_CONFIG = {
  sm: {
    width: 300,
    label: "P",
    icon: { outer: "w-8 h-8", inner: "w-4 h-4", dot: "w-2.5 h-2.5" },
    name: "text-xs",
    speed: "text-[10px] px-1.5",
    plate: "text-[9px]",
    meta: { icon: "w-3 h-3", text: "text-[9px]", gap: "gap-2 mt-0.5" },
    battery: { icon: "w-3 h-3", text: "text-[9px]" },
    lastSeen: { icon: "w-2.5 h-2.5", text: "text-[9px]", mt: "mt-0.5" },
    address: "text-[9px] mt-0.5",
    cardPx: "px-2",
    cardPy: "py-2",
    cardGap: "gap-2",
    cardRound: "rounded-lg",
    listGap: "space-y-1",
    header: "text-sm",
    headerIcon: "w-4 h-4",
    badge: "text-[10px] px-1.5",
    input: "h-8 pl-8 pr-8 text-xs",
    searchIcon: "w-3 h-3",
    filter: "text-[10px] px-2 py-0.5 gap-1",
    filterDot: "w-1.5 h-1.5",
    filterCount: "text-[9px]",
  },
  md: {
    width: 340,
    label: "M",
    icon: { outer: "w-9 h-9", inner: "w-4.5 h-4.5", dot: "w-2.5 h-2.5" },
    name: "text-[13px]",
    speed: "text-[11px] px-1.5",
    plate: "text-[10px]",
    meta: { icon: "w-3 h-3", text: "text-[10px]", gap: "gap-2 mt-0.5" },
    battery: { icon: "w-3 h-3", text: "text-[10px]" },
    lastSeen: { icon: "w-2.5 h-2.5", text: "text-[10px]", mt: "mt-0.5" },
    address: "text-[10px] mt-0.5",
    cardPx: "px-2.5",
    cardPy: "py-2.5",
    cardGap: "gap-2.5",
    cardRound: "rounded-lg",
    listGap: "space-y-1",
    header: "text-base",
    headerIcon: "w-5 h-5",
    badge: "text-[11px] px-1.5",
    input: "h-8 pl-9 pr-8 text-sm",
    searchIcon: "w-3.5 h-3.5",
    filter: "text-[11px] px-2 py-0.5 gap-1",
    filterDot: "w-1.5 h-1.5",
    filterCount: "text-[10px]",
  },
  lg: {
    width: 380,
    label: "G",
    icon: { outer: "w-10 h-10", inner: "w-5 h-5", dot: "w-3 h-3" },
    name: "text-sm",
    speed: "text-xs px-2",
    plate: "text-[11px]",
    meta: { icon: "w-3.5 h-3.5", text: "text-[11px]", gap: "gap-2.5 mt-1" },
    battery: { icon: "w-3.5 h-3.5", text: "text-[11px]" },
    lastSeen: { icon: "w-3 h-3", text: "text-[11px]", mt: "mt-1" },
    address: "text-[11px] mt-1",
    cardPx: "px-3",
    cardPy: "py-3",
    cardGap: "gap-3",
    cardRound: "rounded-xl",
    listGap: "space-y-1.5",
    header: "text-base",
    headerIcon: "w-5 h-5",
    badge: "text-xs px-2",
    input: "h-9 pl-9 pr-8 text-sm",
    searchIcon: "w-3.5 h-3.5",
    filter: "text-xs px-2.5 py-1 gap-1.5",
    filterDot: "w-2 h-2",
    filterCount: "text-[10px]",
  },
} as const;

interface VehicleListPanelProps {
  devices: Device[];
  positionsMap: Map<number, Position>;
  selectedDeviceId: number | null;
  onDeviceClick: (device: Device) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const STATUS_FILTERS: { key: StatusFilter; label: string; dot: string; activeBg: string; activeText: string; activeRing: string }[] = [
  { key: "all", label: "Todos", dot: "", activeBg: "bg-foreground/15", activeText: "text-foreground", activeRing: "ring-foreground/20" },
  { key: "moving", label: "Movendo", dot: "bg-blue-500", activeBg: "bg-blue-500/15", activeText: "text-blue-300", activeRing: "ring-blue-500/30" },
  { key: "stopped", label: "Parado", dot: "bg-green-500", activeBg: "bg-green-500/15", activeText: "text-green-300", activeRing: "ring-green-500/30" },
  { key: "offline", label: "Offline", dot: "bg-gray-500", activeBg: "bg-gray-500/15", activeText: "text-gray-300", activeRing: "ring-gray-500/30" },
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

function BatteryIndicator({ level, sz }: { level: number; sz: typeof SIZE_CONFIG[PanelSize] }) {
  const color =
    level > 60
      ? "text-green-400"
      : level > 20
        ? "text-yellow-400"
        : "text-red-400";
  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Battery className={sz.battery.icon} />
      <span className={`${sz.battery.text} font-medium`}>{level}%</span>
    </div>
  );
}

function LastSeenLabel({ lastUpdate, sz }: { lastUpdate?: string | null; sz: typeof SIZE_CONFIG[PanelSize] }) {
  const relTime = useRelativeTime(lastUpdate);
  if (!relTime) return null;
  return (
    <div className={`flex items-center gap-1 ${sz.lastSeen.mt} ${sz.lastSeen.text} text-muted-foreground`}>
      <Radio className={sz.lastSeen.icon} />
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
  const [panelSize, setPanelSize] = useState<PanelSize>(() => {
    try {
      const saved = localStorage.getItem("vehicleListSize");
      if (saved === "sm" || saved === "md" || saved === "lg") return saved;
    } catch {}
    return "md";
  });
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

  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const sizeMenuRef = useRef<HTMLDivElement>(null);

  // Close size menu on outside click
  useEffect(() => {
    if (!sizeMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(e.target as Node)) {
        setSizeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sizeMenuOpen]);

  const sz = SIZE_CONFIG[panelSize];

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
          <div className="flex items-center bg-popover/80 backdrop-blur-xl border border-border border-l-0 rounded-r-xl px-1.5 py-4 shadow-2xl transition-all hover:bg-popover/90 hover:px-2.5 group-hover:border-blue-500/30">
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
        className={`absolute top-0 left-0 h-full z-[1000] transition-all duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: sz.width }}
      >
        <Card className={`h-full rounded-none rounded-r-2xl backdrop-blur-2xl bg-card/90 border-y-0 border-l-0 border-r border-border shadow-2xl flex flex-col overflow-hidden ${firstOpen ? 'ring-2 ring-blue-500/60 ring-offset-0 animate-pulse' : ''}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className={`font-semibold ${sz.header} text-foreground flex items-center gap-2`}>
              <Navigation2 className={`${sz.headerIcon} text-blue-400`} />
              Veículos
              <span className={`${sz.badge} font-mono text-blue-400 bg-blue-500/10 py-0.5 rounded`}>
                {filteredDevices.length !== devices.length
                  ? `${filteredDevices.length}/${devices.length}`
                  : devices.length}
              </span>
            </h3>
            <div className="flex items-center gap-1">
              <div className="relative" ref={sizeMenuRef}>
                <button
                  type="button"
                  onClick={() => setSizeMenuOpen((v) => !v)}
                  className={`p-1.5 rounded-lg transition-colors ${sizeMenuOpen ? "text-blue-400 bg-blue-500/15" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                  title="Tamanho da lista"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                {sizeMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-popover/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl p-1.5 flex gap-1 z-50">
                    {(["sm", "md", "lg"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setPanelSize(s);
                          try { localStorage.setItem("vehicleListSize", s); } catch {}
                          setSizeMenuOpen(false);
                        }}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                          panelSize === s
                            ? "bg-blue-500/25 text-blue-400 ring-1 ring-blue-500/40"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {s === "sm" ? "P" : s === "md" ? "M" : "G"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onToggle}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Fechar lista"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${sz.searchIcon} text-gray-500`} />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar veículo, placa..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className={`${sz.input} bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted focus:border-primary/50`}
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => setLocalSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Status filter pills */}
          <div className="grid grid-cols-4 gap-1 px-4 pb-3">
            {STATUS_FILTERS.map((f) => {
              const count = statusCounts[f.key];
              const isActive = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`flex flex-col items-center py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    isActive
                      ? `${f.activeBg} ${f.activeText} ring-1 ${f.activeRing}`
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {f.dot && (
                      <div
                        className={`w-2 h-2 rounded-full ${f.dot} ${
                          f.key === "moving" && isActive ? "animate-pulse" : ""
                        }`}
                      />
                    )}
                    <span>{f.label}</span>
                  </div>
                  <span className={`text-xs font-bold tabular-nums mt-0.5 ${isActive ? "opacity-100" : "opacity-50"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Vehicle list — scrollable */}
          <div className={`flex-1 overflow-y-auto px-3 pb-3 ${sz.listGap} scrollbar-thin scrollbar-thumb-blue-600/30 scrollbar-track-transparent`}>
            {sortedDevices.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
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
              const rawBattery = position?.attributes?.batteryLevel
                ?? position?.attributes?.battery
                ?? (position?.attributes?.power != null && position.attributes.power <= 100 ? position.attributes.power : undefined);
              const batteryLevel = rawBattery != null ? Math.min(Math.round(rawBattery), 100) : undefined;
              const IconComponent = getVehicleIcon(device.category);

              return (
                <button
                  key={device.id}
                  onClick={() => onDeviceClick(device)}
                  className={`w-full ${sz.cardPx} ${sz.cardPy} ${sz.cardRound} text-left transition-all group ${
                    isSelected
                      ? "bg-blue-600/30 ring-1 ring-blue-500/50 text-foreground"
                      : "bg-muted/20 hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div className={`flex items-center ${sz.cardGap}`}>
                    {/* Status dot + Vehicle icon */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`${sz.icon.outer} rounded-full flex items-center justify-center border border-border`}
                        style={{
                          background: `${getMarkerColor(effectiveStatus)}22`,
                        }}
                      >
                        <IconComponent
                          className={sz.icon.inner}
                          style={{ color: getMarkerColor(effectiveStatus) }}
                        />
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 ${sz.icon.dot} rounded-full border-2 border-card ${
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
                        <span className={`font-semibold truncate ${sz.name} leading-tight`}>
                          {device.name || device.plate}
                        </span>
                        {position && position.speed > 0 && (
                          <span
                            className={`${sz.speed} font-bold flex-shrink-0 py-0.5 rounded ${
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

                      <div className={`flex items-center ${sz.meta.gap}`}>
                        {device.plate && (
                          <span className={`${sz.plate} text-muted-foreground font-mono tracking-wide`}>
                            {device.plate}
                          </span>
                        )}

                        {/* Ignition indicator */}
                        <div
                          className={`flex items-center ${
                            isIgnitionOn ? "text-yellow-400" : "text-muted-foreground"
                          }`}
                          title={
                            isIgnitionOn
                              ? "Ignição ligada"
                              : "Ignição desligada"
                          }
                        >
                          {isIgnitionOn ? (
                            <Zap className={sz.meta.icon} />
                          ) : (
                            <ZapOff className={sz.meta.icon} />
                          )}
                        </div>

                        {/* Battery */}
                        {typeof batteryLevel === "number" &&
                          batteryLevel > 0 && (
                            <BatteryIndicator level={batteryLevel} sz={sz} />
                          )}

                        {/* Blocked */}
                        {device.attributes?.blocked && (
                          <div
                            className="flex items-center text-red-400"
                            title="Veículo bloqueado"
                          >
                            <Lock className={sz.meta.icon} />
                          </div>
                        )}
                      </div>

                      {/* Last seen */}
                      <LastSeenLabel lastUpdate={device.lastUpdate} sz={sz} />

                      {/* Address */}
                      {position?.address && (
                        <p className={`${sz.address} text-muted-foreground truncate leading-tight`} title={position.address}>
                          {position.address}
                        </p>
                      )}
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
