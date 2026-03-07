"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import L from "leaflet";
import { getDevices } from "@/lib/api";
import { getRoutePositions } from "@/lib/api/reports";
import { RoutePosition, Device } from "@/types";
import type { StopEventData, SpeedViolationData } from "./replay-map";

const ReplayMap = dynamic(() => import("./replay-map"), { ssr: false });
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Route,
  Search,
  Loader2,
  AlertCircle,
  MapPin,
  Timer,
  Gauge,
  TrendingUp,
  Clock,
  ChevronLeft,
  BarChart3,
  Navigation,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

// â”€â”€â”€ dynamic map imports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false },
);
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
  ssr: false,
});

// â”€â”€â”€ local types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface StopEvent {
  index: number;
  endIndex: number;
  startTime: string;
  endTime: string;
  durationSec: number;
  latitude: number;
  longitude: number;
}

interface SpeedViolation {
  index: number;
  endIndex: number;
  startTime: string;
  endTime: string;
  maxSpeed: number;
  durationSec: number;
  distanceKm: number;
  latitude: number;
  longitude: number;
}

interface RouteSummary {
  totalDistanceKm: number;
  totalDurationSec: number;
  movingDurationSec: number;
  stoppedDurationSec: number;
  maxSpeed: number;
  avgSpeed: number;
  stopsCount: number;
  positionsCount: number;
  violationsCount: number;
  maxViolationSpeed: number;
  violationDistanceKm: number;
}

// â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildISO(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Detecta paradas: velocidade ≤ maxSpeedKmh por pelo menos minStopSec segundos
function detectStops(
  positions: RoutePosition[],
  minStopSec = 90,
  maxSpeedKmh = 2,
): StopEvent[] {
  const stops: StopEvent[] = [];
  let i = 0;
  while (i < positions.length) {
    if ((positions[i].speed ?? 0) <= maxSpeedKmh) {
      const start = i;
      while (
        i < positions.length &&
        (positions[i].speed ?? 0) <= maxSpeedKmh
      )
        i++;
      const end = i - 1;
      const startT = new Date(
        positions[start].fixTime || positions[start].serverTime,
      ).getTime();
      const endT = new Date(
        positions[end].fixTime || positions[end].serverTime,
      ).getTime();
      const durationSec = Math.round((endT - startT) / 1000);
      if (durationSec >= minStopSec) {
        const chunk = positions.slice(start, end + 1);
        stops.push({
          index: start,
          endIndex: end,
          startTime: positions[start].fixTime || positions[start].serverTime,
          endTime: positions[end].fixTime || positions[end].serverTime,
          durationSec,
          latitude: chunk.reduce((a, p) => a + p.latitude, 0) / chunk.length,
          longitude: chunk.reduce((a, p) => a + p.longitude, 0) / chunk.length,
        });
      }
    } else {
      i++;
    }
  }
  return stops;
}

// Calcula mÃ©tricas de resumo com precisÃ£o
function calcSummary(
  positions: RoutePosition[],
  stops: StopEvent[],
): RouteSummary {
  if (positions.length === 0) {
    return {
      totalDistanceKm: 0,
      totalDurationSec: 0,
      movingDurationSec: 0,
      stoppedDurationSec: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      stopsCount: 0,
      positionsCount: 0,
      violationsCount: 0,
      maxViolationSpeed: 0,
      violationDistanceKm: 0,
    };
  }
  const first = positions[0];
  const last = positions[positions.length - 1];

  const totalDurationSec = Math.round(
    (new Date(last.fixTime || last.serverTime).getTime() -
      new Date(first.fixTime || first.serverTime).getTime()) /
      1000,
  );

  // DistÃ¢ncia: prioridade = totalDistance cumulativo â†’ soma incremental â†’ Haversine
  let distM = 0;
  const firstTotal = first.attributes?.totalDistance ?? 0;
  const lastTotal = last.attributes?.totalDistance ?? 0;
  if (lastTotal > firstTotal) {
    distM = lastTotal - firstTotal;
  } else {
    for (const p of positions) distM += p.attributes?.distance ?? 0;
    if (distM < 1) {
      for (let i = 1; i < positions.length; i++) {
        distM += haversineM(
          positions[i - 1].latitude,
          positions[i - 1].longitude,
          positions[i].latitude,
          positions[i].longitude,
        );
      }
    }
  }

  const stoppedDurationSec = stops.reduce((s, st) => s + st.durationSec, 0);
  const movingDurationSec = Math.max(0, totalDurationSec - stoppedDurationSec);

  const movingPos = positions.filter((p) => (p.speed ?? 0) > 2);
  const maxSpeed =
    movingPos.length > 0
      ? Math.max(...movingPos.map((p) => (p.speed ?? 0)))
      : 0;
  const avgSpeed =
    movingPos.length > 0
      ? Math.round(
          movingPos.reduce((s, p) => s + (p.speed ?? 0), 0) /
            movingPos.length,
        )
      : 0;

  return {
    totalDistanceKm: distM / 1000,
    totalDurationSec,
    movingDurationSec,
    stoppedDurationSec,
    maxSpeed: Math.round(maxSpeed),
    avgSpeed,
    stopsCount: stops.length,
    positionsCount: positions.length,
    violationsCount: 0,
    maxViolationSpeed: 0,
    violationDistanceKm: 0,
  };
}

// Detecta trechos com excesso de velocidade
function detectSpeedViolations(
  positions: RoutePosition[],
  limitKmh: number,
): SpeedViolation[] {
  if (limitKmh <= 0) return [];
  const violations: SpeedViolation[] = [];
  let i = 0;
  while (i < positions.length) {
    const speedKmh = (positions[i].speed ?? 0);
    if (speedKmh > limitKmh) {
      const start = i;
      while (
        i < positions.length &&
        (positions[i].speed ?? 0) > limitKmh
      )
        i++;
      const end = i - 1;
      const chunk = positions.slice(start, end + 1);
      const startT = new Date(
        positions[start].fixTime || positions[start].serverTime,
      ).getTime();
      const endT = new Date(
        positions[end].fixTime || positions[end].serverTime,
      ).getTime();
      const durationSec = Math.round((endT - startT) / 1000);
      let distM = 0;
      for (let j = 1; j < chunk.length; j++) {
        distM += haversineM(
          chunk[j - 1].latitude,
          chunk[j - 1].longitude,
          chunk[j].latitude,
          chunk[j].longitude,
        );
      }
      const peakPos = chunk.reduce(
        (a, p) => ((p.speed ?? 0) > (a.speed ?? 0) ? p : a),
        chunk[0],
      );
      const maxSpeed = Math.round((peakPos.speed ?? 0));
      violations.push({
        index: start,
        endIndex: end,
        startTime: positions[start].fixTime || positions[start].serverTime,
        endTime: positions[end].fixTime || positions[end].serverTime,
        maxSpeed,
        durationSec,
        distanceKm: distM / 1000,
        latitude: peakPos.latitude,
        longitude: peakPos.longitude,
      });
    } else {
      i++;
    }
  }
  return violations;
}

// â”€â”€â”€ component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function RouteReplayPage() {
  // Icon generators for markers
  const stopIcon = (num: number) => {
    return L.divIcon({
      className: "",
      html: `<div style="width:24px;height:24px;background:#8b5cf6;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;">${num}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  const violationIcon = (speed: number) => {
    const bgColor =
      speed > 100 ? "#dc2626" : speed > 80 ? "#ea580c" : "#f97316";
    return L.divIcon({
      className: "",
      html: `<div style="width:20px;height:20px;background:${bgColor};border-radius:50%;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;">⚠</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  const createVehicleIcon = (pos: any, device: any) => {
    return L.divIcon({
      className: "",
      html: `<div style="width:32px;height:32px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;">🚗</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const vehicleIdFromUrl = searchParams.get("vehicle");
  const today = new Date().toISOString().split("T")[0];

  // â”€â”€ filtros â”€â”€
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState<string>(today);
  const [dateTo, setDateTo] = useState<string>(today);
  const [fromTime, setFromTime] = useState<string>("00:00");
  const [toTime, setToTime] = useState<string>("23:59");

  // â”€â”€ dados â”€â”€
  const [route, setRoute] = useState<RoutePosition[]>([]);
  const [snappedRoute, setSnappedRoute] = useState<[number, number][]>([]);
  const [stops, setStops] = useState<StopEvent[]>([]);
  const [violations, setViolations] = useState<SpeedViolation[]>([]);
  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [speedLimit, setSpeedLimit] = useState<number>(80);

  // â”€â”€ playback â”€â”€
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // â”€â”€ UI â”€â”€
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: getDevices,
  });
  useEffect(() => {
    setIsClient(true);
  }, []);

  // pré-seleciona veículo da URL
  useEffect(() => {
    if (vehicleIdFromUrl && devices.length > 0 && !selectedDevice) {
      const id = parseInt(vehicleIdFromUrl);
      if (devices.some((d) => d.id === id)) setSelectedDevice(id);
    }
  }, [vehicleIdFromUrl, devices, selectedDevice]);

  // sincroniza speedLimit com o device selecionado (lê do cadastro do veículo)
  useEffect(() => {
    const dev = devices.find((d) => d.id === selectedDevice);
    setSpeedLimit(dev?.speedLimit ?? 0);
  }, [selectedDevice, devices]);

  // snap to roads (OSRM)
  const snapRouteToRoads = useCallback(async (positions: RoutePosition[]) => {
    if (positions.length < 2) return [];
    try {
      const chunkSize = 100;
      const all: [number, number][] = [];
      for (let i = 0; i < positions.length; i += chunkSize - 1) {
        const chunk = positions.slice(
          i,
          Math.min(i + chunkSize, positions.length),
        );
        const coords = chunk
          .map((p) => `${p.longitude},${p.latitude}`)
          .join(";");
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.routes?.[0]) {
            all.push(
              ...data.routes[0].geometry.coordinates.map(
                (c: number[]) => [c[1], c[0]] as [number, number],
              ),
            );
          }
        }
        if (i + chunkSize < positions.length)
          await new Promise((r) => setTimeout(r, 80));
      }
      return all;
    } catch {
      return positions.map(
        (p) => [p.latitude, p.longitude] as [number, number],
      );
    }
  }, []);

  // busca rota real
  const handleLoadRoute = useCallback(async () => {
    if (!selectedDevice) {
      toast.error("Selecione um veículo");
      return;
    }

    const fromISO = buildISO(dateFrom, fromTime);
    const toISO = buildISO(dateTo, toTime);
    if (new Date(toISO) <= new Date(fromISO)) {
      toast.error("A data/hora final deve ser posterior à inicial");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setLoadError(null);
    setRoute([]);
    setSnappedRoute([]);
    setStops([]);
    setViolations([]);
    setSummary(null);
    setCurrentIndex(0);
    setIsPlaying(false);

    try {
      const positions = await getRoutePositions(
        selectedDevice,
        fromISO,
        toISO,
        abortRef.current.signal,
      );

      if (!positions || positions.length === 0) {
        setLoadError("Nenhuma posição encontrada para o período selecionado.");
        setIsLoading(false);
        return;
      }

      const detectedStops = detectStops(positions);
      const detectedViolations = detectSpeedViolations(positions, speedLimit);
      const routeSummary = calcSummary(positions, detectedStops);
      // enriquece summary com dados de violações
      routeSummary.violationsCount = detectedViolations.length;
      routeSummary.maxViolationSpeed =
        detectedViolations.length > 0
          ? Math.max(...detectedViolations.map((v) => v.maxSpeed))
          : 0;
      routeSummary.violationDistanceKm = detectedViolations.reduce(
        (s, v) => s + v.distanceKm,
        0,
      );

      setRoute(positions);
      setStops(detectedStops);
      setViolations(detectedViolations);
      setSummary(routeSummary);
      setShowSummary(true);

      const violationPart =
        detectedViolations.length > 0
          ? ` • ⚠️ ${detectedViolations.length} excesso(s)`
          : "";
      toast.success(
        `${positions.length} posições • ${detectedStops.length} parada(s) • ${Math.round(routeSummary.totalDistanceKm)} km${violationPart}`,
      );

      // snap assÃ­ncrono
      snapRouteToRoads(positions).then((snapped) => {
        if (snapped.length > 0) setSnappedRoute(snapped);
      });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      const msg = err?.message || "Erro desconhecido";
      setLoadError(msg);
      toast.error("Erro ao carregar rota: " + msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedDevice,
    dateFrom,
    dateTo,
    fromTime,
    toTime,
    speedLimit,
    snapRouteToRoads,
  ]);

  // playback interval
  useEffect(() => {
    if (isPlaying && route.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= route.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 100 / playbackSpeed);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playbackSpeed, route.length]);

  const handlePlayPause = () => {
    if (currentIndex >= route.length - 1) setCurrentIndex(0);
    setIsPlaying((p) => !p);
  };
  const handleStop = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };
  const handleSeek = (idx: number) =>
    setCurrentIndex(Math.max(0, Math.min(idx, route.length - 1)));
  const resetFilter = () => {
    setSelectedDevice(null);
    setRoute([]);
    setSnappedRoute([]);
    setStops([]);
    setViolations([]);
    setSummary(null);
    setLoadError(null);
  };

  // parada corrente
  const currentStop = useMemo(
    () =>
      stops.find((s) => currentIndex >= s.index && currentIndex <= s.endIndex),
    [stops, currentIndex],
  );

  // violação corrente
  const currentViolation = useMemo(
    () =>
      violations.find(
        (v) => currentIndex >= v.index && currentIndex <= v.endIndex,
      ),
    [violations, currentIndex],
  );

  // derived
  const currentPos = route[currentIndex];
  const device = devices.find((d) => d.id === selectedDevice);
  const progress =
    route.length > 1 ? (currentIndex / (route.length - 1)) * 100 : 0;

  const getMarkerPos = (): [number, number] => {
    if (!currentPos) return [-23.5505, -46.6333];
    if (snappedRoute.length > 0) {
      const si = Math.floor(
        (currentIndex / route.length) * snappedRoute.length,
      );
      return snappedRoute[Math.max(0, Math.min(si, snappedRoute.length - 1))];
    }
    return [currentPos.latitude, currentPos.longitude];
  };

  const snappedCompleted = useMemo(
    () =>
      snappedRoute.length > 0
        ? snappedRoute.slice(
            0,
            Math.floor(
              (currentIndex / Math.max(route.length, 1)) * snappedRoute.length,
            ),
          )
        : null,
    [snappedRoute, currentIndex, route.length],
  );
  const snappedRemaining = useMemo(
    () =>
      snappedRoute.length > 0
        ? snappedRoute.slice(
            Math.floor(
              (currentIndex / Math.max(route.length, 1)) * snappedRoute.length,
            ),
          )
        : null,
    [snappedRoute, currentIndex, route.length],
  );
  const rawCompleted = useMemo(
    () =>
      route
        .slice(0, currentIndex + 1)
        .map((p) => [p.latitude, p.longitude] as [number, number]),
    [route, currentIndex],
  );
  const rawRemaining = useMemo(
    () =>
      route
        .slice(currentIndex)
        .map((p) => [p.latitude, p.longitude] as [number, number]),
    [route, currentIndex],
  );

  // filtros inline
  const filterRow = (dark?: boolean, showLimit = true) => {
    const base = dark
      ? "h-9 rounded-md border px-2 text-sm bg-white/5 border-white/10 text-white"
      : "h-9 rounded-md border px-2 text-sm bg-background";
    return (
      <div className="flex flex-wrap gap-2 items-center">
        {/* vehicle */}
        <Select
          value={selectedDevice?.toString() ?? ""}
          onValueChange={(v) => {
            setSelectedDevice(parseInt(v));
            resetFilter();
          }}
        >
          <SelectTrigger
            className={`h-9 w-48 ${dark ? "bg-white/5 border-white/10 text-white" : ""}`}
          >
            <SelectValue placeholder="Selecione o veículo" />
          </SelectTrigger>
          <SelectContent>
            {devices.map((d) => (
              <SelectItem key={d.id} value={d.id.toString()}>
                {d.plate || d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* from */}
        <input
          type="date"
          value={dateFrom}
          max={today}
          onChange={(e) => setDateFrom(e.target.value)}
          className={base}
        />
        <input
          type="time"
          value={fromTime}
          onChange={(e) => setFromTime(e.target.value)}
          className={`${base} w-24`}
        />

        <ArrowRight
          className={`h-4 w-4 flex-shrink-0 ${dark ? "text-white/40" : "text-muted-foreground"}`}
        />

        {/* to */}
        <input
          type="date"
          value={dateTo}
          max={today}
          onChange={(e) => setDateTo(e.target.value)}
          className={base}
        />
        <input
          type="time"
          value={toTime}
          onChange={(e) => setToTime(e.target.value)}
          className={`${base} w-24`}
        />

        <Button
          className="h-9 bg-blue-600 hover:bg-blue-700 text-white gap-1 flex-shrink-0"
          onClick={handleLoadRoute}
          disabled={isLoading || !selectedDevice}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Buscar
        </Button>

        {/* limite de velocidade do device (read-only) */}
        {showLimit && selectedDevice && (
          <div
            className={`flex items-center gap-1.5 flex-shrink-0 rounded-md border px-2.5 h-9 ${
              speedLimit > 0
                ? dark
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-red-50 border-red-200"
                : dark
                  ? "bg-white/5 border-white/10"
                  : "bg-muted border-border"
            }`}
          >
            <span
              className={`text-sm ${
                speedLimit > 0
                  ? dark
                    ? "text-red-400"
                    : "text-red-500"
                  : dark
                    ? "text-white/30"
                    : "text-muted-foreground"
              }`}
            >
              ⚠
            </span>
            <span
              className={`text-xs font-medium whitespace-nowrap ${
                speedLimit > 0
                  ? dark
                    ? "text-red-200"
                    : "text-red-700"
                  : dark
                    ? "text-white/40"
                    : "text-muted-foreground"
              }`}
            >
              {speedLimit > 0
                ? `Limite: ${speedLimit} km/h`
                : "Sem limite definido"}
            </span>
          </div>
        )}
      </div>
    );
  };

  // â”€â”€â”€ render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!isClient) {
    return (
      <div className="h-[calc(100vh-7rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <PageHeader
        title="Reprodução de Rotas"
        description="Reveja trajetos históricos com controles de timeline"
        icon={Route}
      />

      <div className="flex-1 relative mt-4 overflow-hidden rounded-lg">
        {/* â”€â”€ Loading â”€â”€ */}
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-muted">
            <div className="text-center space-y-3">
              <Loader2 className="w-14 h-14 text-blue-500 mx-auto animate-spin" />
              <p className="font-medium">Carregando histórico de posições…</p>
              <p className="text-muted-foreground text-sm">
                Buscando dados do servidor
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  abortRef.current?.abort();
                  setIsLoading(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* â”€â”€ Empty / error â”€â”€ */}
        {!isLoading && route.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted gap-6 p-4">
            {loadError ? (
              <div className="text-center space-y-2">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
                <p className="text-red-400 font-medium">{loadError}</p>
                <p className="text-muted-foreground text-sm">
                  Ajuste os filtros e tente novamente
                </p>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <Route className="w-16 h-16 text-muted-foreground mx-auto" />
                <p className="text-lg font-medium text-muted-foreground">
                  Selecione veículo e período
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure o intervalo de datas para carregar o histórico real
                  do Traccar
                </p>
              </div>
            )}
            <Card className="w-full max-w-4xl">
              <CardContent className="p-4">
                {filterRow(false, false)}
              </CardContent>
            </Card>
          </div>
        )}

        {/* â”€â”€ Map â”€â”€ */}
        {!isLoading && route.length > 0 && currentPos && device && (
          <>
            <MapContainer
              center={getMarkerPos()}
              zoom={14}
              style={{ width: "100%", height: "100%", background: "#0a0f1a" }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              />

              {/* Rota percorrida */}
              <Polyline
                positions={snappedCompleted ?? rawCompleted}
                pathOptions={{
                  color: "#3b82f6",
                  weight: 5,
                  opacity: 0.9,
                  lineJoin: "round",
                  lineCap: "round",
                }}
              />

              {/* Rota restante */}
              <Polyline
                positions={snappedRemaining ?? rawRemaining}
                pathOptions={{
                  color: "#6b7280",
                  weight: 3,
                  opacity: 0.4,
                  dashArray: "8, 12",
                }}
              />

              {/* Marcadores de parada */}
              {stops.map((stop, idx) => (
                <Marker
                  key={idx}
                  position={[stop.latitude, stop.longitude]}
                  icon={stopIcon(idx + 1)}
                  eventHandlers={{ click: () => handleSeek(stop.index) }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold text-orange-600 mb-1">
                        ⏸ Parada #{idx + 1}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Início:</span>{" "}
                        {fmtDateTime(stop.startTime)}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Fim:</span>{" "}
                        {fmtDateTime(stop.endTime)}
                      </p>
                      <p className="text-orange-700 font-bold mt-1">
                        ⏱ Duração: {fmtDuration(stop.durationSec)}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        {stop.latitude.toFixed(6)}, {stop.longitude.toFixed(6)}
                      </p>
                      <p className="text-blue-500 text-xs mt-0.5 cursor-pointer">
                        Clique para ir a este ponto ↗
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Marcadores de excesso de velocidade */}
              {violations.map((v, idx) => (
                <Marker
                  key={`v${idx}`}
                  position={[v.latitude, v.longitude]}
                  icon={violationIcon(v.maxSpeed)}
                  eventHandlers={{ click: () => handleSeek(v.index) }}
                >
                  <Popup>
                    <div className="text-sm min-w-[180px]">
                      <p className="font-bold text-red-600 mb-1">
                        ⚠️ Excesso #{idx + 1}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Limite:</span>{" "}
                        {speedLimit} km/h
                      </p>
                      <p className="text-red-700 font-bold">
                        Pico: {v.maxSpeed} km/h{" "}
                        <span className="text-red-500">
                          (+{v.maxSpeed - speedLimit})
                        </span>
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Início:</span>{" "}
                        {fmtDateTime(v.startTime)}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Fim:</span>{" "}
                        {fmtDateTime(v.endTime)}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {fmtDuration(v.durationSec)} •{" "}
                        {Math.round(v.distanceKm)} km em excesso
                      </p>
                      <p className="text-blue-500 text-xs mt-0.5 cursor-pointer">
                        Clique para ir ↗
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Inicio */}
              <Marker
                position={[route[0].latitude, route[0].longitude]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="width:26px;height:26px;background:#22c55e;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">S</div>`,
                  iconSize: [26, 26],
                  iconAnchor: [13, 13],
                })}
              />

              {/* Fim */}
              <Marker
                position={[
                  route[route.length - 1].latitude,
                  route[route.length - 1].longitude,
                ]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="width:26px;height:26px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">F</div>`,
                  iconSize: [26, 26],
                  iconAnchor: [13, 13],
                })}
              />

              {/* VeÃ­culo */}
              <Marker
                position={getMarkerPos()}
                icon={createVehicleIcon(currentPos, device)}
              />
            </MapContainer>

            {/* â”€â”€ Painel de Resumo (lateral) â”€â”€ */}
            {showSummary && summary && (
              <Card
                className="absolute top-3 left-3 bottom-24 w-72 z-[1001] flex flex-col overflow-hidden border border-white/15"
                style={{
                  backgroundColor: "rgba(8, 8, 20, 0.96)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <CardHeader className="py-3 px-4 border-b border-white/10 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-400" />
                      Resumo da Rota
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-white/50 hover:text-white"
                      onClick={() => setShowSummary(false)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-white/50">
                    {device?.plate || device?.name}
                  </p>
                  <p className="text-xs text-white/35 mt-0.5">
                    {fmtDateTime(route[0].fixTime || route[0].serverTime)}
                    {" → "}
                    {fmtDateTime(
                      route[route.length - 1].fixTime ||
                        route[route.length - 1].serverTime,
                    )}
                  </p>
                </CardHeader>

                <ScrollArea className="flex-1">
                  <CardContent className="p-3 space-y-3">
                    {/* KM principal */}
                    <div className="rounded-xl p-4 text-center border border-blue-500/30 bg-blue-500/10">
                      <div className="text-3xl font-bold text-blue-300 tabular-nums">
                        {Math.round(summary.totalDistanceKm)}
                      </div>
                      <div className="text-xs text-blue-400/70 uppercase tracking-widest mt-0.5">
                        quilômetros percorridos
                      </div>
                    </div>

                    {/* Grid de mÃ©tricas */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                        <div className="flex items-center gap-1 text-xs text-white/40 mb-1">
                          <Timer className="h-3 w-3" /> Duração total
                        </div>
                        <div className="text-sm font-semibold text-white tabular-nums">
                          {fmtDuration(summary.totalDurationSec)}
                        </div>
                      </div>

                      <div className="bg-green-500/10 rounded-lg p-2.5 border border-green-500/20">
                        <div className="flex items-center gap-1 text-xs text-green-400/70 mb-1">
                          <Navigation className="h-3 w-3" /> Em movimento
                        </div>
                        <div className="text-sm font-semibold text-green-300 tabular-nums">
                          {fmtDuration(summary.movingDurationSec)}
                        </div>
                      </div>

                      <div className="bg-orange-500/10 rounded-lg p-2.5 border border-orange-500/20">
                        <div className="flex items-center gap-1 text-xs text-orange-400/70 mb-1">
                          <Clock className="h-3 w-3" /> Tempo parado
                        </div>
                        <div className="text-sm font-semibold text-orange-300 tabular-nums">
                          {fmtDuration(summary.stoppedDurationSec)}
                        </div>
                      </div>

                      <div className="bg-orange-500/10 rounded-lg p-2.5 border border-orange-500/20">
                        <div className="flex items-center gap-1 text-xs text-orange-400/70 mb-1">
                          <MapPin className="h-3 w-3" /> Nº paradas
                        </div>
                        <div className="text-sm font-semibold text-orange-300">
                          {summary.stopsCount}
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                        <div className="flex items-center gap-1 text-xs text-white/40 mb-1">
                          <Gauge className="h-3 w-3" /> Vel. máxima
                        </div>
                        <div className="text-sm font-semibold text-red-400">
                          {summary.maxSpeed} km/h
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                        <div className="flex items-center gap-1 text-xs text-white/40 mb-1">
                          <TrendingUp className="h-3 w-3" /> Vel. média
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {summary.avgSpeed} km/h
                        </div>
                      </div>
                    </div>

                    {/* Seção de excessos de velocidade — sempre visível */}
                    <Separator className="bg-white/10" />
                    {speedLimit <= 0 ? (
                      <div className="rounded-xl p-3 border border-white/10 bg-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🚫</span>
                          <div>
                            <p className="text-xs font-bold text-white/50 uppercase tracking-widest">
                              Limite de Velocidade
                            </p>
                            <p className="text-xs text-white/30 mt-0.5">
                              Não configurado no cadastro do veículo
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : violations.length === 0 ? (
                      <div className="rounded-xl p-3 border border-green-500/30 bg-green-500/8">
                        <div className="flex items-center gap-2">
                          <span className="text-base">✅</span>
                          <div>
                            <p className="text-xs font-bold text-green-300 uppercase tracking-widest">
                              Velocidade Respeitada
                            </p>
                            <p className="text-xs text-green-400/60 mt-0.5">
                              Nenhum excesso acima de {speedLimit} km/h
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* card de alerta */}
                        <div className="rounded-xl p-3 border border-red-500/40 bg-red-500/10">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-base">⚠️</span>
                            <span className="text-xs font-bold text-red-300 uppercase tracking-widest">
                              Excessos de Velocidade
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="bg-red-500/15 rounded-lg p-2 border border-red-500/25">
                              <div className="text-xs text-red-400/70 mb-0.5">
                                Ocorrências
                              </div>
                              <div className="text-lg font-bold text-red-300">
                                {summary!.violationsCount}
                              </div>
                            </div>
                            <div className="bg-red-500/15 rounded-lg p-2 border border-red-500/25">
                              <div className="text-xs text-red-400/70 mb-0.5">
                                Pico máximo
                              </div>
                              <div className="text-lg font-bold text-red-300">
                                {summary!.maxViolationSpeed}{" "}
                                <span className="text-xs font-normal">
                                  km/h
                                </span>
                              </div>
                            </div>
                            <div className="bg-red-500/15 rounded-lg p-2 border border-red-500/25 col-span-2">
                              <div className="text-xs text-red-400/70 mb-0.5">
                                Distância em excesso
                              </div>
                              <div className="text-sm font-bold text-red-300">
                                {Math.round(summary!.violationDistanceKm)} km •
                                Limite: {speedLimit} km/h
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-widest mb-2">
                            Trechos de excesso ({violations.length})
                          </p>
                          <div className="space-y-2">
                            {violations.map((v, idx) => {
                              const isActive =
                                currentIndex >= v.index &&
                                currentIndex <= v.endIndex;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleSeek(v.index)}
                                  className={`w-full text-left rounded-lg p-2.5 border transition-all ${
                                    isActive
                                      ? "bg-red-500/25 border-red-400/50 ring-1 ring-red-400/30"
                                      : "bg-red-500/8 hover:bg-red-500/15 border-red-500/20"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-red-300">
                                      ⚠ Excesso #{idx + 1}
                                      {isActive && (
                                        <span className="ml-1 text-red-400">
                                          ● atual
                                        </span>
                                      )}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-red-300 border-red-500/40 text-xs px-1.5 tabular-nums"
                                    >
                                      {v.maxSpeed} km/h
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-white/40 tabular-nums">
                                    {fmtTime(v.startTime)}
                                    <span className="mx-1 text-white/20">
                                      →
                                    </span>
                                    {fmtTime(v.endTime)}
                                  </div>
                                  <div className="text-xs text-red-400/60 mt-0.5">
                                    +{v.maxSpeed - speedLimit} km/h acima •{" "}
                                    {Math.round(v.distanceKm)} km
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Lista de paradas */}
                    {stops.length > 0 && (
                      <>
                        <Separator className="bg-white/10" />
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-widest mb-2">
                            Paradas detectadas ({stops.length})
                          </p>
                          <div className="space-y-2">
                            {stops.map((stop, idx) => {
                              const isActive =
                                currentIndex >= stop.index &&
                                currentIndex <= stop.endIndex;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleSeek(stop.index)}
                                  className={`w-full text-left rounded-lg p-2.5 border transition-all ${
                                    isActive
                                      ? "bg-orange-500/25 border-orange-400/50 ring-1 ring-orange-400/30"
                                      : "bg-orange-500/8 hover:bg-orange-500/15 border-orange-500/20"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-orange-300">
                                      ⏸ Parada #{idx + 1}
                                      {isActive && (
                                        <span className="ml-1 text-orange-400">
                                          ● atual
                                        </span>
                                      )}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-orange-300 border-orange-500/40 text-xs px-1.5 tabular-nums"
                                    >
                                      {fmtDuration(stop.durationSec)}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-white/40 tabular-nums">
                                    {fmtTime(stop.startTime)}
                                    <span className="mx-1 text-white/20">
                                      →
                                    </span>
                                    {fmtTime(stop.endTime)}
                                  </div>
                                  <div className="text-xs text-white/25 mt-0.5">
                                    {stop.latitude.toFixed(5)},{" "}
                                    {stop.longitude.toFixed(5)}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </ScrollArea>
              </Card>
            )}

            {/* â”€â”€ BotÃ£o abrir resumo (quando fechado) â”€â”€ */}
            {!showSummary && summary && (
              <Button
                className="absolute top-3 left-3 z-[1001] bg-black/70 hover:bg-black/90 text-white border-white/15 gap-2"
                variant="outline"
                onClick={() => setShowSummary(true)}
              >
                <BarChart3 className="h-4 w-4 text-blue-400" />
                Resumo
                <Badge className="bg-blue-600 text-white text-xs">
                  {Math.round(summary.totalDistanceKm)} km
                </Badge>
                {summary.stopsCount > 0 && (
                  <Badge className="bg-orange-600 text-white text-xs">
                    {summary.stopsCount} parada
                    {summary.stopsCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </Button>
            )}

            {/* â”€â”€ Filtros overlay (topo) â”€â”€ */}
            <Card
              className={`absolute top-3 z-[1000] border-white/15 transition-all duration-200 ${
                showSummary ? "left-[19.5rem] right-3" : "left-3 right-3"
              }`}
              style={{
                backgroundColor: "rgba(8, 8, 20, 0.94)",
                backdropFilter: "blur(16px)",
              }}
            >
              <CardContent className="p-3 space-y-2">
                {filterRow(true)}
                <div className="flex gap-3 text-xs text-white/45 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {route.length} pontos
                  </span>
                  {summary && (
                    <span className="text-blue-300 font-semibold">
                      📍 {Math.round(summary.totalDistanceKm)} km
                    </span>
                  )}
                  {summary && (
                    <span>⏱ {fmtDuration(summary.totalDurationSec)}</span>
                  )}
                  {summary && summary.violationsCount > 0 && (
                    <span className="text-red-400 font-semibold">
                      ⚠ {summary.violationsCount} excesso(s) • pico{" "}
                      {summary.maxViolationSpeed} km/h
                    </span>
                  )}
                  {summary && summary.stopsCount > 0 && (
                    <span className="text-orange-400">
                      ⏸ {summary.stopsCount} parada(s) •{" "}
                      {fmtDuration(summary.stoppedDurationSec)} parado
                    </span>
                  )}
                  {snappedRoute.length > 0 && (
                    <span className="text-green-400">✓ snap to roads</span>
                  )}
                  <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                    Vel. reprodução:
                    <Select
                      value={playbackSpeed.toString()}
                      onValueChange={(v) => setPlaybackSpeed(parseFloat(v))}
                    >
                      <SelectTrigger className="inline-flex h-6 w-16 ml-1 bg-blue-500/20 border-blue-500/30 text-white text-xs px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0.25, 0.5, 1, 2, 5, 10].map((s) => (
                          <SelectItem key={s} value={s.toString()}>
                            {s}x
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* â”€â”€ Timeline Controls (rodapÃ©) â”€â”€ */}
            <Card
              className={`absolute bottom-3 z-[1000] border-white/15 transition-all duration-200 ${
                showSummary ? "left-[19.5rem] right-3" : "left-3 right-3"
              }`}
              style={{
                backgroundColor: "rgba(8, 8, 20, 0.94)",
                backdropFilter: "blur(16px)",
              }}
            >
              <CardContent className="p-3 space-y-2">
                {/* Scrubber visual com zonas de parada */}
                <div className="relative h-3 cursor-pointer select-none">
                  {/* fundo */}
                  <div className="absolute inset-0 rounded-full bg-gray-700" />
                  {/* zonas de parada (laranja) */}
                  {stops.map((stop, idx) => {
                    const l =
                      (stop.index / Math.max(route.length - 1, 1)) * 100;
                    const r =
                      100 -
                      (stop.endIndex / Math.max(route.length - 1, 1)) * 100;
                    return (
                      <div
                        key={idx}
                        className="absolute top-0 bottom-0 bg-orange-500/65 rounded-sm"
                        style={{ left: `${l}%`, right: `${r}%` }}
                        title={`Parada #${idx + 1}: ${fmtDuration(stop.durationSec)}`}
                      />
                    );
                  })}
                  {/* zonas de excesso de velocidade (vermelho) */}
                  {violations.map((v, idx) => {
                    const l = (v.index / Math.max(route.length - 1, 1)) * 100;
                    const r =
                      100 - (v.endIndex / Math.max(route.length - 1, 1)) * 100;
                    return (
                      <div
                        key={`vz${idx}`}
                        className="absolute top-0 h-1/2 bg-red-500/80 rounded-sm"
                        style={{ left: `${l}%`, right: `${r}%` }}
                        title={`Excesso #${idx + 1}: pico ${v.maxSpeed} km/h`}
                      />
                    );
                  })}
                  {/* progresso azul */}
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-blue-500 rounded-full pointer-events-none"
                    style={{ width: `${progress}%` }}
                  />
                  {/* input invisível captura eventos */}
                  <input
                    type="range"
                    min={0}
                    max={route.length - 1}
                    value={currentIndex}
                    onChange={(e) => handleSeek(parseInt(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                  />
                </div>

                {/* Legenda da scrubber */}
                {(stops.length > 0 || violations.length > 0) && (
                  <div className="flex gap-3 text-xs text-white/40">
                    {violations.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block w-3 h-1.5 rounded-sm"
                          style={{ background: "#dc2626" }}
                        ></span>
                        Excesso ({violations.length})
                      </span>
                    )}
                    {stops.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block w-3 h-2 rounded-sm"
                          style={{ background: "rgba(249,115,22,0.65)" }}
                        ></span>
                        Parada ({stops.length})
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-2 rounded-sm bg-blue-500"></span>
                      Percorrido
                    </span>
                  </div>
                )}

                {/* Botões de controle */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400 tabular-nums">
                    {route[0] &&
                      fmtTime(route[0].fixTime || route[0].serverTime)}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-white/5 border-white/10"
                      onClick={handleStop}
                      disabled={currentIndex === 0}
                    >
                      <Square className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-white/5 border-white/10"
                      onClick={() => handleSeek(currentIndex - 10)}
                      disabled={currentIndex === 0}
                    >
                      <SkipBack className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-10 w-10 bg-blue-600 hover:bg-blue-700"
                      onClick={handlePlayPause}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-white/5 border-white/10"
                      onClick={() => handleSeek(currentIndex + 10)}
                      disabled={currentIndex >= route.length - 1}
                    >
                      <SkipForward className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-gray-400 tabular-nums">
                    {route[route.length - 1] &&
                      fmtTime(
                        route[route.length - 1].fixTime ||
                          route[route.length - 1].serverTime,
                      )}
                  </div>
                </div>

                {/* Velocidades rÃ¡pidas + telemetria */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {[0.5, 1, 2, 5, 10].map((s) => (
                      <Button
                        key={s}
                        variant={playbackSpeed === s ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setPlaybackSpeed(s)}
                        className={`h-6 px-2 text-xs ${
                          playbackSpeed === s
                            ? "bg-blue-600"
                            : "bg-white/5 text-white/55"
                        }`}
                      >
                        {s}x
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-300 tabular-nums">
                    {currentStop ? (
                      <span className="text-orange-400 font-semibold">
                        ⏸ PARADO há{" "}
                        {fmtDuration(
                          Math.round(
                            (new Date(
                              currentPos.fixTime || currentPos.serverTime,
                            ).getTime() -
                              new Date(currentStop.startTime).getTime()) /
                              1000,
                          ),
                        )}
                      </span>
                    ) : currentViolation ? (
                      <span className="text-red-400 font-bold animate-pulse">
                        ⚠ EXCESSO:{" "}
                        <strong>
                          {Math.round(currentPos.speed)}
                        </strong>{" "}
                        km/h (+
                        {Math.round(currentPos.speed) - speedLimit})
                      </span>
                    ) : (
                      <span>
                        ⚡{" "}
                        <strong>
                          {Math.round(currentPos.speed)}
                        </strong>{" "}
                        km/h
                      </span>
                    )}
                    <span>
                      📍 {currentIndex + 1}
                      <span className="text-gray-600">/{route.length}</span>
                    </span>
                    <span>
                      🕐 {fmtTime(currentPos.fixTime || currentPos.serverTime)}
                    </span>
                    {currentPos.attributes?.ignition !== undefined && (
                      <span
                        className={
                          currentPos.attributes.ignition
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {currentPos.attributes.ignition
                          ? "🔑 Ligado"
                          : "🔑 Deslig."}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
