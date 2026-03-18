"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  ReportType,
  ReportFilter,
  TripReport,
  StopReport,
  RoutePosition,
} from "@/types";
import {
  generateTripReport,
  generateStopReport,
  generateEventReport,
  generateSummaryReport,
  exportReportPDF,
  exportReportExcel,
  getRoutePositions,
} from "@/lib/api/reports";
import { getDevices } from "@/lib/api/devices";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  Download,
  Calendar as CalendarIcon,
  Loader2,
  Gauge,
  TrendingUp,
  Route,
  BarChart3,
  Layers,
  Car,
  MapPinOff,
  Activity,
  FileSpreadsheet,
  Search,
  X,
  MapPin,
  Zap,
  Fuel,
} from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTenantColors } from "@/lib/hooks/useTenantColors";
import { VehicleCombobox } from "@/components/vehicles/vehicle-combobox";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

// Leaflet (client-only)
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false },
);
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});

let L: any;
if (typeof window !== "undefined") L = require("leaflet");

/** Auto-fit map bounds to polyline on report load */
function FitBoundsToPolyline({ polyline }: { polyline: [number, number][] }) {
  if (typeof window === "undefined") return null;
  const { useMap } = require("react-leaflet");
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || !map || polyline.length < 2) return;
    fitted.current = true;
    const bounds = L.latLngBounds(polyline);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  }, [map, polyline]);

  // Reset when polyline changes (new report)
  useEffect(() => {
    fitted.current = false;
  }, [polyline.length]);

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Presets de período (padrão Traccar)
// ────────────────────────────────────────────────────────────────────────────
type PeriodPreset =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "previousWeek"
  | "thisMonth"
  | "previousMonth"
  | "custom";

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  thisWeek: "Esta Semana",
  previousWeek: "Semana Anterior",
  thisMonth: "Este Mês",
  previousMonth: "Mês Anterior",
  custom: "Personalizado",
};

function getPeriodDates(preset: PeriodPreset): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "thisWeek":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "previousWeek": {
      const pw = subWeeks(now, 1);
      return {
        from: startOfWeek(pw, { weekStartsOn: 1 }),
        to: endOfWeek(pw, { weekStartsOn: 1 }),
      };
    }
    case "thisMonth":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "previousMonth": {
      const pm = subMonths(now, 1);
      return { from: startOfMonth(pm), to: endOfMonth(pm) };
    }
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Tipos de relatório (padrão Traccar)
// ────────────────────────────────────────────────────────────────────────────
const REPORT_TYPES: {
  value: ReportType;
  label: string;
  icon: React.ElementType;
  desc: string;
}[] = [
  { value: "route", label: "Rota", icon: Route, desc: "Histórico de posições" },
  { value: "events", label: "Eventos", icon: Activity, desc: "Eventos do dispositivo" },
  { value: "trips", label: "Viagens", icon: Car, desc: "Registro de viagens" },
  { value: "stops", label: "Paradas", icon: MapPinOff, desc: "Paradas registradas" },
  { value: "summary", label: "Resumo", icon: FileText, desc: "Resumo geral por veículo" },
  { value: "chart", label: "Gráfico", icon: BarChart3, desc: "Velocidade e altitude" },
  { value: "combined", label: "Combinado", icon: Layers, desc: "Todos os relatórios" },
  { value: "geofence", label: "Geocercas", icon: MapPin, desc: "Entradas e saídas de geocercas" },
  { value: "ignition", label: "Ignição", icon: Zap, desc: "Ligou/desligou ignição" },
  { value: "fuel", label: "Combustível", icon: Fuel, desc: "Quedas e abastecimentos" },
];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSpeed(speed: number): string {
  return `${Math.round(speed)} km/h`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function safeDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(v: unknown, fmt = "dd/MM/yyyy HH:mm:ss"): string {
  const d = safeDate(v);
  return d ? format(d, fmt, { locale: ptBR }) : "—";
}

function fmtShortDate(v: unknown): string {
  return fmtDate(v, "dd/MM HH:mm");
}

// ────────────────────────────────────────────────────────────────────────────
// Event type labels (Traccar standard)
// ────────────────────────────────────────────────────────────────────────────
const EVENT_TYPE_LABELS: Record<string, string> = {
  commandResult: "Resultado de Comando",
  deviceOnline: "Dispositivo Online",
  deviceUnknown: "Dispositivo Desconhecido",
  deviceOffline: "Dispositivo Offline",
  deviceInactive: "Dispositivo Inativo",
  deviceMoving: "Em Movimento",
  deviceStopped: "Parou",
  deviceOverspeed: "Excesso de Velocidade",
  speedLimit: "Limite de Velocidade",
  geofenceEnter: "Entrou na Geocerca",
  geofenceExit: "Saiu da Geocerca",
  alarm: "Alarme",
  ignitionOn: "Ignição Ligada",
  ignitionOff: "Ignição Desligada",
  maintenance: "Manutenção",
  textMessage: "Mensagem de Texto",
  driverChanged: "Motorista Alterado",
  fuelDrop: "Queda de Combustível",
  fuelIncrease: "Aumento de Combustível",
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function ReportsPage() {
  const colors = useTenantColors();
  const [reportType, setReportType] = useState<ReportType>("route");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("today");
  const [dateFrom, setDateFrom] = useState<Date>(startOfDay(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfDay(new Date()));
  const [selectedDevices, setSelectedDevices] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Report data
  const [routeData, setRouteData] = useState<RoutePosition[] | null>(null);
  const [tripData, setTripData] = useState<TripReport[] | null>(null);
  const [stopData, setStopData] = useState<StopReport[] | null>(null);
  const [eventData, setEventData] = useState<any[] | null>(null);
  const [summaryData, setSummaryData] = useState<any[] | null>(null);

  // Devices
  const { data: devices = [], isLoading: isLoadingDevices } = useQuery({
    queryKey: ["devices"],
    queryFn: () => getDevices(),
    retry: 3,
    staleTime: 60000,
  });

  // Period preset
  useEffect(() => {
    if (periodPreset !== "custom") {
      const { from, to } = getPeriodDates(periodPreset);
      setDateFrom(from);
      setDateTo(to);
    }
  }, [periodPreset]);

  const selectedDeviceNames = useMemo(() => {
    return selectedDevices
      .map((id) => devices.find((dev) => dev.id === id)?.name || `#${id}`)
      .join(", ");
  }, [selectedDevices, devices]);

  const clearReports = () => {
    setRouteData(null);
    setTripData(null);
    setStopData(null);
    setEventData(null);
    setSummaryData(null);
  };

  // ── Generate ──
  const handleGenerate = useCallback(async (type?: ReportType) => {
    const currentType = type ?? reportType;
    if (selectedDevices.length === 0) return;
    setIsGenerating(true);
    clearReports();

    const filter: ReportFilter = {
      deviceIds: selectedDevices,
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
      type: currentType,
    };

    try {
      const needsRoute =
        currentType === "route" ||
        currentType === "chart" ||
        currentType === "combined";
      const needsTrips = currentType === "trips" || currentType === "combined";
      const needsStops = currentType === "stops" || currentType === "combined";
      const needsEvents = currentType === "events" || currentType === "combined" ||
        currentType === "geofence" || currentType === "ignition" || currentType === "fuel";
      const needsSummary =
        currentType === "summary" || currentType === "combined";

      const promises: Promise<void>[] = [];

      if (needsRoute) {
        abortRef.current = new AbortController();
        promises.push(
          getRoutePositions(
            selectedDevices[0],
            dateFrom.toISOString(),
            dateTo.toISOString(),
            abortRef.current.signal,
          ).then((p) => setRouteData(p)),
        );
      }
      if (needsTrips)
        promises.push(generateTripReport(filter).then((d) => setTripData(d)));
      if (needsStops)
        promises.push(generateStopReport(filter).then((d) => setStopData(d)));
      if (needsEvents)
        promises.push(
          generateEventReport(filter).then((d) => setEventData(d)),
        );
      if (needsSummary)
        promises.push(
          generateSummaryReport(filter).then((d) => setSummaryData(d)),
        );

      await Promise.all(promises);
      toast.success("Relatório gerado com sucesso!");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error(
        "Erro ao gerar relatório: " + (err?.message || "Desconhecido"),
      );
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [reportType, selectedDevices, dateFrom, dateTo]);

  // Auto-submit when type, period, or devices change
  const autoSubmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (selectedDevices.length === 0) return;
    if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current);
    autoSubmitTimer.current = setTimeout(() => {
      handleGenerate();
    }, 400);
    return () => { if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current); };
  }, [reportType, periodPreset, dateFrom, dateTo, selectedDevices, handleGenerate]);

  // ── Export ──
  const handleExport = async (fmt: "pdf" | "excel") => {
    const mappedType =
      reportType === "chart"
        ? "route"
        : reportType;
    const filter: ReportFilter = {
      deviceIds: selectedDevices,
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
      type: mappedType as ReportType,
    };
    try {
      if (fmt === "pdf") {
        // PDF endpoint returns HTML — open in new tab for print/save
        const blob = await exportReportPDF(filter.type, filter);
        const url = window.URL.createObjectURL(
          new Blob([blob], { type: "text/html" }),
        );
        window.open(url, "_blank");
        toast.success("Relatório aberto — use Ctrl+P para salvar como PDF");
      } else {
        const blob = await exportReportExcel(filter.type, filter);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `relatorio-${reportType}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("Excel exportado!");
      }
    } catch {
      toast.error(`Erro ao exportar ${fmt === "pdf" ? "PDF" : "Excel"}`);
    }
  };

  const hasData =
    routeData || tripData || stopData || eventData || summaryData;

  // Chart data (sampled)
  const chartData = useMemo(() => {
    if (!routeData || routeData.length === 0) return [];
    const step = Math.max(1, Math.floor(routeData.length / 500));
    return routeData
      .filter((_, i) => i % step === 0)
      .map((p) => ({
        time: fmtDate(p.fixTime, "HH:mm"),
        fullTime: fmtDate(p.fixTime),
        speed: Math.round(p.speed),
        altitude: Math.round(p.altitude),
      }));
  }, [routeData]);

  // Route polyline
  const routePolyline = useMemo((): [number, number][] => {
    if (!routeData || routeData.length === 0) return [];
    return routeData.map((p) => [p.latitude, p.longitude]);
  }, [routeData]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatórios</h1>
            <p className="text-sm text-muted-foreground">
              Gere e exporte relatórios detalhados no padrão Traccar
            </p>
          </div>
          {hasData && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("excel")}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
              >
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <div className="w-72 border-r bg-card flex flex-col overflow-y-auto shrink-0">
          <div className="p-4 space-y-4">
            {/* Report Type — grid compacto */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tipo de Relatório
              </Label>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {REPORT_TYPES.map((rt) => {
                  const Icon = rt.icon;
                  const active = reportType === rt.value;
                  return (
                    <button
                      key={rt.value}
                      onClick={() => {
                        setReportType(rt.value);
                        clearReports();
                      }}
                      title={rt.desc}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors text-left",
                        active
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "hover:bg-accent text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{rt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Period */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Período
              </Label>
              <Select
                value={periodPreset}
                onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {periodPreset === "custom" && (
                <div className="mt-2 space-y-2">
                  <div>
                    <Label className="text-xs">De</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {format(dateFrom, "dd/MM/yyyy", { locale: ptBR })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={(d) => d && setDateFrom(startOfDay(d))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs">Até</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {format(dateTo, "dd/MM/yyyy", { locale: ptBR })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={(d) => d && setDateTo(endOfDay(d))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>

            {/* Generate button — always visible */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating || selectedDevices.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar Relatório
                </>
              )}
            </Button>

            {/* Devices */}
            <div className="flex-1 flex flex-col min-h-0">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Veículos
                {selectedDevices.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    {selectedDevices.length}
                  </Badge>
                )}
              </Label>
              <VehicleCombobox
                mode="multi"
                devices={devices}
                value={selectedDevices}
                onChange={setSelectedDevices}
                placeholder="Selecionar veículos..."
                disabled={isLoadingDevices}
              />
            </div>
          </div>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!hasData && !isGenerating ? (
            <EmptyState message='Selecione o tipo, período e veículos, depois clique em "Gerar Relatório"' />
          ) : isGenerating ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <p className="text-muted-foreground">Gerando relatório...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto flex flex-col">
              {/* Info bar */}
              <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                <span>
                  <strong>Período:</strong>{" "}
                  {format(dateFrom, "dd/MM/yyyy HH:mm", { locale: ptBR })} →{" "}
                  {format(dateTo, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
                <span className="truncate">
                  <strong>Veículos:</strong> {selectedDeviceNames}
                </span>
              </div>

              {/* Report content */}
              {reportType === "combined" ? (
                <CombinedReport
                  routeData={routeData}
                  tripData={tripData}
                  stopData={stopData}
                  eventData={eventData}
                  summaryData={summaryData}
                  routePolyline={routePolyline}
                  chartData={chartData}
                />
              ) : reportType === "route" ? (
                <RouteReport data={routeData} polyline={routePolyline} />
              ) : reportType === "trips" ? (
                <TripsReport data={tripData} />
              ) : reportType === "stops" ? (
                <StopsReport data={stopData} />
              ) : reportType === "events" ? (
                <EventsReport data={eventData} />
              ) : reportType === "geofence" ? (
                <EventsReport data={eventData?.filter((e: any) =>
                  e.type === "geofenceEnter" || e.type === "geofenceExit"
                ) ?? null} />
              ) : reportType === "ignition" ? (
                <EventsReport data={eventData?.filter((e: any) =>
                  e.type === "ignitionOn" || e.type === "ignitionOff"
                ) ?? null} />
              ) : reportType === "fuel" ? (
                <EventsReport data={eventData?.filter((e: any) =>
                  e.type === "fuelDrop" || e.type === "fuelIncrease"
                ) ?? null} />
              ) : reportType === "summary" ? (
                <SummaryReport data={summaryData} />
              ) : reportType === "chart" ? (
                <ChartReport data={chartData} routeData={routeData} />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROUTE REPORT
// ════════════════════════════════════════════════════════════════════════════
function RouteReport({
  data,
  polyline,
}: {
  data: RoutePosition[] | null;
  polyline: [number, number][];
}) {
  if (!data || data.length === 0)
    return <EmptyState message="Nenhuma posição encontrada no período" />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Map */}
      <div className="h-[300px] shrink-0 border-b">
        {typeof window !== "undefined" && polyline.length > 0 && (
          <MapContainer
            center={polyline[Math.floor(polyline.length / 2)]}
            zoom={13}
            style={{ width: "100%", height: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap &copy; CARTO"
              subdomains="abcd"
            />
            <FitBoundsToPolyline polyline={polyline} />
            <Polyline
              positions={polyline}
              pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.8 }}
            />
            {L && (
              <>
                <Marker
                  position={polyline[0]}
                  icon={L.divIcon({
                    className: "",
                    html: '<div style="background:#22c55e;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                  })}
                />
                <Marker
                  position={polyline[polyline.length - 1]}
                  icon={L.divIcon({
                    className: "",
                    html: '<div style="background:#ef4444;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                  })}
                />
              </>
            )}
          </MapContainer>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Latitude</TableHead>
              <TableHead>Longitude</TableHead>
              <TableHead>Altitude</TableHead>
              <TableHead>Velocidade</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Válida</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((pos, i) => (
              <TableRow key={pos.id || i} className="text-xs">
                <TableCell className="text-muted-foreground font-mono">
                  {i + 1}
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">
                  {fmtDate(pos.fixTime)}
                </TableCell>
                <TableCell className="font-mono">
                  {pos.latitude.toFixed(5)}
                </TableCell>
                <TableCell className="font-mono">
                  {pos.longitude.toFixed(5)}
                </TableCell>
                <TableCell>{Math.round(pos.altitude)} m</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "font-medium",
                      pos.speed > 100
                        ? "text-red-500"
                        : pos.speed > 60
                          ? "text-yellow-600"
                          : "text-green-600",
                    )}
                  >
                    {formatSpeed(pos.speed)}
                  </span>
                </TableCell>
                <TableCell>{Math.round(pos.course)}°</TableCell>
                <TableCell
                  className="max-w-[200px] truncate"
                  title={pos.address}
                >
                  {pos.address || "—"}
                </TableCell>
                <TableCell>
                  {pos.attributes?.valid !== false ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-green-600"
                    >
                      Sim
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-red-500"
                    >
                      Não
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TableFooter count={data.length} label="posições" />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TRIPS REPORT
// ════════════════════════════════════════════════════════════════════════════
function TripsReport({ data }: { data: TripReport[] | null }) {
  if (!data || data.length === 0)
    return <EmptyState message="Nenhuma viagem encontrada no período" />;

  const allTrips = data.flatMap((dr) =>
    (dr.trips || []).map((trip) => ({ ...trip, deviceName: dr.deviceName })),
  );

  if (allTrips.length === 0)
    return (
      <EmptyState message="Nenhuma viagem registrada no período selecionado" />
    );

  return (
    <div className="flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Veículo</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Endereço Início</TableHead>
            <TableHead>Fim</TableHead>
            <TableHead>Endereço Fim</TableHead>
            <TableHead className="text-right">Distância</TableHead>
            <TableHead className="text-right">Vel. Média</TableHead>
            <TableHead className="text-right">Vel. Máxima</TableHead>
            <TableHead className="text-right">Duração</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allTrips.map((trip, i) => (
            <TableRow key={trip.id || i} className="text-xs">
              <TableCell className="font-medium">{trip.deviceName}</TableCell>
              <TableCell className="whitespace-nowrap">
                {fmtDate(trip.startTime)}
              </TableCell>
              <TableCell
                className="max-w-[180px] truncate"
                title={
                  trip.startPosition?.address ||
                  (trip as any).startAddress ||
                  ""
                }
              >
                {trip.startPosition?.address ||
                  (trip as any).startAddress ||
                  "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {fmtDate(trip.endTime)}
              </TableCell>
              <TableCell
                className="max-w-[180px] truncate"
                title={
                  trip.endPosition?.address ||
                  (trip as any).endAddress ||
                  ""
                }
              >
                {trip.endPosition?.address ||
                  (trip as any).endAddress ||
                  "—"}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatDistance(trip.distance || 0)}
              </TableCell>
              <TableCell className="text-right">
                {formatSpeed(trip.averageSpeed || 0)}
              </TableCell>
              <TableCell className="text-right">
                <span className="text-red-500 font-medium">
                  {formatSpeed(trip.maxSpeed || 0)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                {formatDuration(Number(trip.duration) || 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="px-4 py-3 text-xs border-t bg-muted/30 flex items-center gap-6">
        <span>
          <strong>Total:</strong> {allTrips.length} viagem(ns)
        </span>
        <span>
          <strong>Distância:</strong>{" "}
          {formatDistance(
            data.reduce((acc, dr) => acc + (dr.totalDistance || 0), 0),
          )}
        </span>
        <span>
          <strong>Tempo:</strong>{" "}
          {formatDuration(
            data.reduce((acc, dr) => acc + (dr.totalDuration || 0), 0),
          )}
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STOPS REPORT
// ════════════════════════════════════════════════════════════════════════════
function StopsReport({ data }: { data: StopReport[] | null }) {
  if (!data || data.length === 0)
    return <EmptyState message="Nenhuma parada encontrada no período" />;

  const allStops = data.flatMap((dr) =>
    (dr.stops || []).map((stop) => ({ ...stop, deviceName: dr.deviceName })),
  );

  if (allStops.length === 0)
    return (
      <EmptyState message="Nenhuma parada registrada no período selecionado" />
    );

  return (
    <div className="flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Veículo</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Endereço</TableHead>
            <TableHead>Latitude</TableHead>
            <TableHead>Longitude</TableHead>
            <TableHead>Fim</TableHead>
            <TableHead className="text-right">Duração</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allStops.map((stop, i) => (
            <TableRow key={stop.id || i} className="text-xs">
              <TableCell className="font-medium">{stop.deviceName}</TableCell>
              <TableCell className="whitespace-nowrap">
                {fmtDate(stop.startTime)}
              </TableCell>
              <TableCell
                className="max-w-[250px] truncate"
                title={stop.address || ""}
              >
                {stop.address || stop.position?.address || "—"}
              </TableCell>
              <TableCell className="font-mono">
                {stop.position?.latitude?.toFixed(5) || "—"}
              </TableCell>
              <TableCell className="font-mono">
                {stop.position?.longitude?.toFixed(5) || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {fmtDate(stop.endTime)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatDuration(stop.duration || 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="px-4 py-3 text-xs border-t bg-muted/30 flex items-center gap-6">
        <span>
          <strong>Total:</strong> {allStops.length} parada(s)
        </span>
        <span>
          <strong>Tempo parado:</strong>{" "}
          {formatDuration(
            data.reduce((acc, dr) => acc + (dr.totalDuration || 0), 0),
          )}
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EVENTS REPORT
// ════════════════════════════════════════════════════════════════════════════
function EventsReport({ data }: { data: any[] | null }) {
  if (!data || data.length === 0)
    return <EmptyState message="Nenhum evento encontrado no período" />;

  return (
    <div className="flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Horário</TableHead>
            <TableHead>Dispositivo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Geocerca</TableHead>
            <TableHead>Manutenção</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((event: any, i: number) => (
            <TableRow key={event.id || i} className="text-xs">
              <TableCell className="whitespace-nowrap font-medium">
                {fmtDate(event.serverTime || event.eventTime)}
              </TableCell>
              <TableCell>
                {event.deviceName || `Device #${event.deviceId}`}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    event.type === "deviceOverspeed" || event.type === "alarm"
                      ? "text-red-500 border-red-200"
                      : event.type === "deviceOnline" ||
                          event.type === "deviceMoving"
                        ? "text-green-600 border-green-200"
                        : event.type === "deviceOffline" ||
                            event.type === "deviceStopped"
                          ? "text-yellow-600 border-yellow-200"
                          : "",
                  )}
                >
                  {EVENT_TYPE_LABELS[event.type] || event.type}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {event.geofenceName || event.geofenceId || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {event.maintenanceName || event.maintenanceId || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TableFooter count={data.length} label="evento(s)" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY REPORT
// ════════════════════════════════════════════════════════════════════════════
function SummaryReport({ data }: { data: any[] | null }) {
  if (!data || data.length === 0)
    return <EmptyState message="Nenhum dado de resumo encontrado" />;

  return (
    <div className="flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Veículo</TableHead>
            <TableHead className="text-right">Distância</TableHead>
            <TableHead className="text-right">Vel. Média</TableHead>
            <TableHead className="text-right">Vel. Máxima</TableHead>
            <TableHead className="text-right">Horas Motor</TableHead>
            <TableHead className="text-right">Combustível</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Fim</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item: any, i: number) => (
            <TableRow key={item.deviceId || i} className="text-xs">
              <TableCell className="font-medium">
                {item.deviceName || `Device #${item.deviceId}`}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatDistance(item.distance || 0)}
              </TableCell>
              <TableCell className="text-right">
                {formatSpeed(item.averageSpeed || 0)}
              </TableCell>
              <TableCell className="text-right">
                <span className="text-red-500 font-medium">
                  {formatSpeed(item.maxSpeed || 0)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                {((item.engineHours || 0) / 3600000).toFixed(1)}h
              </TableCell>
              <TableCell className="text-right">
                {(item.spentFuel || 0).toFixed(1)} L
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {fmtShortDate(item.startTime)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {fmtShortDate(item.endTime)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Summary cards */}
      <div className="p-4 border-t bg-muted/30">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Distância Total"
            value={formatDistance(
              data.reduce((acc, d) => acc + (d.distance || 0), 0),
            )}
            color="blue"
          />
          <StatCard
            label="Vel. Máxima"
            value={formatSpeed(Math.max(...data.map((d) => d.maxSpeed || 0)))}
            color="red"
          />
          <StatCard
            label="Horas Motor"
            value={`${(data.reduce((acc, d) => acc + (d.engineHours || 0), 0) / 3600000).toFixed(1)}h`}
            color="orange"
          />
          <StatCard
            label="Combustível"
            value={`${data.reduce((acc, d) => acc + (d.spentFuel || 0), 0).toFixed(1)} L`}
            color="green"
          />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CHART REPORT
// ════════════════════════════════════════════════════════════════════════════
function ChartReport({
  data,
  routeData,
}: {
  data: { time: string; fullTime: string; speed: number; altitude: number }[];
  routeData: RoutePosition[] | null;
}) {
  if (!data || data.length === 0)
    return <EmptyState message="Nenhum dado para gráfico no período" />;

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Speed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge className="h-4 w-4 text-blue-500" />
            Velocidade (km/h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient
                    id="speedGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} unit=" km/h" width={70} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} km/h`, "Velocidade"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullTime || ""
                  }
                />
                <Area
                  type="monotone"
                  dataKey="speed"
                  stroke="#3b82f6"
                  fill="url(#speedGrad)"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Altitude */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Altitude (m)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient
                    id="altGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} unit=" m" width={60} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} m`, "Altitude"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullTime || ""
                  }
                />
                <Area
                  type="monotone"
                  dataKey="altitude"
                  stroke="#22c55e"
                  fill="url(#altGrad)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {routeData && routeData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="Posições"
            value={routeData.length.toString()}
            color="blue"
          />
          <StatCard
            label="Vel. Máxima"
            value={`${Math.max(...routeData.map((p) => Math.round(p.speed)))} km/h`}
            color="red"
          />
          <StatCard
            label="Vel. Média"
            value={`${Math.round(routeData.reduce((a, p) => a + p.speed, 0) / routeData.length)} km/h`}
            color="green"
          />
          <StatCard
            label="Alt. Máxima"
            value={`${Math.max(...routeData.map((p) => Math.round(p.altitude)))} m`}
            color="orange"
          />
          <StatCard
            label="Alt. Mínima"
            value={`${Math.min(...routeData.map((p) => Math.round(p.altitude)))} m`}
            color="purple"
          />
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMBINED REPORT
// ════════════════════════════════════════════════════════════════════════════
function CombinedReport({
  routeData,
  tripData,
  stopData,
  eventData,
  summaryData,
  routePolyline,
  chartData,
}: {
  routeData: RoutePosition[] | null;
  tripData: TripReport[] | null;
  stopData: StopReport[] | null;
  eventData: any[] | null;
  summaryData: any[] | null;
  routePolyline: [number, number][];
  chartData: any[];
}) {
  return (
    <Tabs
      defaultValue="summary"
      className="flex-1 flex flex-col overflow-hidden"
    >
      <div className="px-4 pt-2 shrink-0 border-b">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="summary" className="text-xs">
            Resumo
          </TabsTrigger>
          <TabsTrigger value="route" className="text-xs">
            Rota
          </TabsTrigger>
          <TabsTrigger value="trips" className="text-xs">
            Viagens
          </TabsTrigger>
          <TabsTrigger value="stops" className="text-xs">
            Paradas
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs">
            Eventos
          </TabsTrigger>
          <TabsTrigger value="chart" className="text-xs">
            Gráfico
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="summary" className="flex-1 overflow-auto mt-0">
        <SummaryReport data={summaryData} />
      </TabsContent>
      <TabsContent value="route" className="flex-1 overflow-auto mt-0">
        <RouteReport data={routeData} polyline={routePolyline} />
      </TabsContent>
      <TabsContent value="trips" className="flex-1 overflow-auto mt-0">
        <TripsReport data={tripData} />
      </TabsContent>
      <TabsContent value="stops" className="flex-1 overflow-auto mt-0">
        <StopsReport data={stopData} />
      </TabsContent>
      <TabsContent value="events" className="flex-1 overflow-auto mt-0">
        <EventsReport data={eventData} />
      </TabsContent>
      <TabsContent value="chart" className="flex-1 overflow-auto mt-0">
        <ChartReport data={chartData} routeData={routeData} />
      </TabsContent>
    </Tabs>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════════════════════════════
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function TableFooter({ count, label }: { count: number; label: string }) {
  return (
    <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
      Total: {count} {label}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "text-blue-600",
    red: "text-red-500",
    green: "text-green-600",
    orange: "text-orange-600",
    purple: "text-purple-600",
  };
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className={cn("text-lg font-bold", colors[color] || "")}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
