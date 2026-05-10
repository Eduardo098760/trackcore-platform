"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Geofence, GeofenceType, Device, Position } from "@/types";
import { getPositions } from "@/lib/api";
import {
  getGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  assignGeofenceToDevice,
  removeGeofenceFromDevice,
  getDevicesForGeofence,
} from "@/lib/api/geofences";
import { getDevices } from "@/lib/api/devices";
import { parseWKT } from "@/lib/parse-wkt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import {
  emitGeofenceAssignmentsChanged,
  emitGeofenceCollectionChanged,
  useGeofenceSync,
} from "@/lib/hooks/useGeofenceSync";
import {
  Trash2,
  Edit,
  Plus,
  ShieldCheck,
  Car,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPinned,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { ParsedGeofenceItem } from "./geofence-draw-map";

interface VehiclePreview {
  id: number;
  name: string;
  uniqueId: string;
  latitude: number;
  longitude: number;
  speed: number;
}

interface MapViewportTarget {
  type: "polygon" | "circle";
  coordinates?: [number, number][];
  center?: [number, number];
  radius?: number;
  requestKey?: number;
}

const GeofenceDrawMap = dynamic(() => import("./geofence-draw-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
      Carregando mapa...
    </div>
  ),
});

export default function GeofencesPage() {
  useGeofenceSync();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<number | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [circleCenter, setCircleCenter] = useState<[number, number] | null>(
    null,
  );
  const [circleRadius, setCircleRadius] = useState<number>(0);

  // Selecao de veiculos
  const [assignToAll, setAssignToAll] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [snapshotDevices, setSnapshotDevices] = useState<Device[]>([]);
  const [snapshotPositions, setSnapshotPositions] = useState<Position[]>([]);
  const [initialViewportTarget, setInitialViewportTarget] =
    useState<MapViewportTarget | null>(null);

  // Guard contra race conditions em handleEdit (async)
  const editSessionRef = useRef(0);
  const focusRequestRef = useRef(0);
  const ignoreNextCanvasClickRef = useRef(false);
  const handledRouteActionRef = useRef<string | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    type: GeofenceType;
    area: string;
    color: string;
    active: boolean;
  }>({
    name: "",
    description: "",
    type: "polygon",
    area: "",
    color: "#3b82f6",
    active: true,
  });

  const { data: geofences = [], isLoading } = useQuery<Geofence[]>({
    queryKey: ["geofences"],
    queryFn: getGeofences,
  });

  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ["devices"],
    queryFn: () => getDevices(),
  });

  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ["positions"],
    queryFn: () => getPositions(),
  });

  const { data: geofenceDeviceCounts = {} } = useQuery<Record<number, number>>({
    queryKey: ["geofence-device-counts", geofences.map((geofence) => geofence.id).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        geofences.map(async (geofence) => {
          const deviceIds = await getDevicesForGeofence(geofence.id);
          return [geofence.id, deviceIds.length] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
    enabled: geofences.length > 0,
    staleTime: 30_000,
  });

  const previewVehicles = (selectedDeviceIds.length > 0
    ? selectedDeviceIds
        .map((deviceId) => {
          const device = snapshotDevices.find((item) => item.id === deviceId);
          const position = snapshotPositions.find(
            (item) => item.deviceId === deviceId,
          );
          if (!device || !position) return null;
          return {
            id: device.id,
            name: device.name,
            uniqueId: device.uniqueId,
            latitude: position.latitude,
            longitude: position.longitude,
            speed: position.speed,
          };
        })
        .filter((vehicle): vehicle is VehiclePreview => vehicle !== null)
    : snapshotDevices
        .map((device) => {
          const position = snapshotPositions.find(
            (item) => item.deviceId === device.id,
          );
          if (!position) return null;
          return {
            id: device.id,
            name: device.name,
            uniqueId: device.uniqueId,
            latitude: position.latitude,
            longitude: position.longitude,
            speed: position.speed,
          };
        })
        .filter((vehicle): vehicle is VehiclePreview => vehicle !== null)
  ).filter(
    (vehicle) =>
      Number.isFinite(vehicle.latitude) &&
      Number.isFinite(vehicle.longitude) &&
      Math.abs(vehicle.latitude) > 0.01,
  );

  const captureMapSnapshot = () => {
    setSnapshotDevices(devices);
    setSnapshotPositions(positions);
  };

  const normalizePolygonCoordinates = (coordinates: [number, number][]) =>
    coordinates.length > 1 &&
    coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
    coordinates[0][1] === coordinates[coordinates.length - 1][1]
      ? coordinates.slice(0, -1)
      : coordinates;

  const buildViewportTargetFromArea = (
    area: string,
  ): MapViewportTarget | null => {
    const parsed = parseWKT(area);
    if (!parsed) return null;

    if (parsed.type === "circle" && parsed.center && parsed.radius) {
      return {
        type: "circle",
        center: parsed.center,
        radius: parsed.radius,
        requestKey: ++focusRequestRef.current,
      };
    }

    const coordinates = normalizePolygonCoordinates(parsed.coordinates ?? []);
    if (coordinates.length === 0) return null;

    return {
      type: "polygon",
      coordinates,
      requestKey: ++focusRequestRef.current,
    };
  };

  // Calcula contagem real de vínculos por cerca a partir do Traccar
  const getGeofenceVehicleCount = (geofence: Geofence): number => {
    return geofenceDeviceCounts[geofence.id] ?? 0;
  };

  const getGeofenceTypeLabel = (type: GeofenceType) => {
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

  const resetForm = () => {
    editSessionRef.current++; // cancela qualquer async pendente
    setFormData({
      name: "",
      description: "",
      type: "polygon",
      area: "",
      color: "#3b82f6",
      active: true,
    });
    setEditingGeofence(null);
    setDrawingPoints([]);
    setCircleCenter(null);
    setCircleRadius(0);
    setAssignToAll(false);
    setSelectedDeviceIds([]);
    setShowDeviceList(false);
    setSnapshotDevices([]);
    setSnapshotPositions([]);
    setInitialViewportTarget(null);
  };

  const focusGeofence = (geofence: Geofence) => {
    setSelectedGeofenceId(geofence.id);
    setInitialViewportTarget(buildViewportTargetFromArea(geofence.area));
  };

  const openCreateEditor = (initialPoint?: [number, number]) => {
    resetForm();
    captureMapSnapshot();
    setIsEditorOpen(true);
    setSelectedGeofenceId(null);

    if (initialPoint) {
      setDrawingPoints([initialPoint]);
      setInitialViewportTarget({
        type: "polygon",
        coordinates: [initialPoint],
        requestKey: ++focusRequestRef.current,
      });
    }
  };

  const handleCreate = () => {
    openCreateEditor();
  };

  const loadGeofenceGeometryForEdit = (geofence: Geofence) => {
    const parsed = parseWKT(geofence.area);
    if (!parsed) {
      setDrawingPoints([]);
      setCircleCenter(null);
      setCircleRadius(0);
      setInitialViewportTarget(null);
      return;
    }

    if (parsed.type === "circle" && parsed.center && parsed.radius) {
      setDrawingPoints([]);
      setCircleCenter(parsed.center);
      setCircleRadius(parsed.radius);
      setInitialViewportTarget({
        type: "circle",
        center: parsed.center,
        radius: parsed.radius,
      });
      return;
    }

    const coordinates = parsed.coordinates ?? [];
    const normalizedCoordinates = normalizePolygonCoordinates(coordinates);

    setDrawingPoints(normalizedCoordinates);
    setCircleCenter(null);
    setCircleRadius(0);
    setInitialViewportTarget({
      type: "polygon",
      coordinates: normalizedCoordinates,
      requestKey: ++focusRequestRef.current,
    });
  };

  const syncDevicePermissions = async (
    geofenceId: number,
    newDeviceIds: number[],
  ) => {
    let currentIds: number[] = [];
    try {
      currentIds = await getDevicesForGeofence(geofenceId);
    } catch {
      currentIds = [];
    }
    const toAdd = newDeviceIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !newDeviceIds.includes(id));
    await Promise.all([
      ...toAdd.map((did) => assignGeofenceToDevice(did, geofenceId)),
      ...toRemove.map((did) => removeGeofenceFromDevice(did, geofenceId)),
    ]);
    emitGeofenceAssignmentsChanged({ geofenceId, source: "geofences-page" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      toast.error("Informe um nome para a cerca");
      return;
    }

    const hasDuplicateName = geofences.some(
      (geofence) =>
        geofence.id !== editingGeofence?.id &&
        geofence.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (hasDuplicateName) {
      toast.error("Ja existe uma cerca com esse nome");
      return;
    }

    if (!formData.area && drawingPoints.length === 0 && !circleCenter) {
      toast.error("Desenhe uma area no mapa primeiro");
      return;
    }
    if (formData.type === "polygon" && drawingPoints.length > 0 && !formData.area) {
      toast.error("Adicione pelo menos 3 pontos para formar o poligono");
      return;
    }
    if (formData.type === "circle" && circleCenter && !formData.area) {
      toast.error("Clique novamente no mapa para definir o raio");
      return;
    }
    if (formData.type === "rectangle" && drawingPoints.length === 1) {
      toast.error("Clique no canto oposto para finalizar o retangulo");
      return;
    }

    const targetDeviceIds = assignToAll
      ? devices.map((d) => d.id)
      : selectedDeviceIds;

    setIsSaving(true);
    try {
      let savedGeofence: Geofence;
      // Salva o intent de atribuição nos attributes para recuperar corretamente no edit
      const geofencePayload = {
        ...formData,
        name: trimmedName,
        clientId: 1,
        assignToAll,
        linkedDeviceIds: assignToAll ? [] : selectedDeviceIds,
        createdAt: editingGeofence?.createdAt || new Date().toISOString(),
      };
      if (editingGeofence) {
        savedGeofence = await updateGeofence(
          editingGeofence.id,
          geofencePayload,
        );
        toast.success("Cerca atualizada com sucesso!");
      } else {
        savedGeofence = await createGeofence(geofencePayload);
        toast.success("Cerca criada com sucesso!");
      }
      // Sincroniza permissões device-geofence no Traccar
      await syncDevicePermissions(savedGeofence.id, targetDeviceIds);
      if (targetDeviceIds.length > 0) {
        toast.success(
          assignToAll
            ? `Cerca aplicada a todos os ${devices.length} veiculos`
            : `Cerca aplicada a ${targetDeviceIds.length} veiculo(s)`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["geofences"] });
      queryClient.invalidateQueries({ queryKey: ["geofence-device-counts"] });
      emitGeofenceCollectionChanged({
        geofenceId: savedGeofence.id,
        source: "geofences-page",
      });
      resetForm();
      setIsEditorOpen(false);
      focusGeofence(savedGeofence);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar cerca");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (geofence: Geofence) => {
    const session = ++editSessionRef.current;
    captureMapSnapshot();
    focusGeofence(geofence);

    // 1. Reseta estado imediatamente (síncrono) — evita race condition
    setAssignToAll(false);
    setSelectedDeviceIds([]);
    setShowDeviceList(false);
    setEditingGeofence(geofence);
    setFormData({
      name: geofence.name,
      description: geofence.description || "",
      type: geofence.type,
      area: geofence.area,
      color: geofence.color || "#3b82f6",
      active: geofence.active,
    });
    loadGeofenceGeometryForEdit(geofence);

    // 2. Carrega intent de atribuição salvo nos attributes (sem async)
    const storedAssignToAll = geofence.attributes?.assignToAll === true;
    const storedLinkedIds = Array.isArray(geofence.attributes?.linkedDeviceIds)
      ? (geofence.attributes!.linkedDeviceIds as number[])
      : null;

    if (storedLinkedIds !== null) {
      // Tem dados salvos — usa direto, sem precisar de chamada à API
      setAssignToAll(storedAssignToAll);
      setSelectedDeviceIds(storedAssignToAll ? [] : storedLinkedIds);
      if (storedAssignToAll || storedLinkedIds.length > 0)
        setShowDeviceList(true);
      setIsEditorOpen(true);
    } else {
      // Geofence antiga (sem attributes) — abre a edicao lateral e tenta buscar via API
      setIsEditorOpen(true);
      try {
        const linked = await getDevicesForGeofence(geofence.id);
        if (editSessionRef.current !== session) return; // descarta resultado obsoleto
        // Só marca "todos" se linked === devices E ambos > 0
        const isAll =
          linked.length > 0 &&
          devices.length > 0 &&
          linked.length >= devices.length;
        setAssignToAll(isAll);
        setSelectedDeviceIds(isAll ? [] : linked);
        if (linked.length > 0) setShowDeviceList(true);
      } catch {
        if (editSessionRef.current !== session) return;
        setSelectedDeviceIds([]);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover esta cerca?")) return;
    try {
      await deleteGeofence(id);
      if (selectedGeofenceId === id) {
        setSelectedGeofenceId(null);
      }
      if (editingGeofence?.id === id) {
        resetForm();
        setIsEditorOpen(false);
      }
      queryClient.invalidateQueries({ queryKey: ["geofences"] });
      queryClient.invalidateQueries({ queryKey: ["geofence-device-counts"] });
      emitGeofenceCollectionChanged({ geofenceId: id, source: "geofences-page" });
      toast.success("Cerca removida com sucesso!");
    } catch {
      toast.error("Erro ao remover cerca");
    }
  };

  const handleDrawingMapClick = (lat: number, lng: number) => {
    if (formData.type === "polygon") {
      const nextPoints: [number, number][] = [...drawingPoints, [lat, lng]];
      updatePolygonArea(nextPoints);
    } else if (formData.type === "circle") {
      if (!circleCenter) {
        setCircleCenter([lat, lng]);
        toast.info("Clique novamente para definir o raio");
      } else {
        const R = 6371e3;
        const p1 = (circleCenter[0] * Math.PI) / 180,
          p2 = (lat * Math.PI) / 180;
        const dp = ((lat - circleCenter[0]) * Math.PI) / 180,
          dl = ((lng - circleCenter[1]) * Math.PI) / 180;
        const a =
          Math.sin(dp / 2) ** 2 +
          Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
        const radius = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        setCircleRadius(radius);
        setFormData((prev) => ({
          ...prev,
          area: `CIRCLE((${circleCenter[1]} ${circleCenter[0]}),${radius.toFixed(2)})`,
        }));
        toast.success(`Circulo criado com raio de ${radius.toFixed(0)}m`);
      }
    } else if (formData.type === "rectangle") {
      if (drawingPoints.length === 0) {
        setDrawingPoints([[lat, lng]]);
        toast.info("Clique no canto oposto do retangulo");
      } else {
        const p1 = drawingPoints[0],
          p2: [number, number] = [lat, lng];
        const rect: [number, number][] = [
          [p1[0], p1[1]],
          [p1[0], p2[1]],
          [p2[0], p2[1]],
          [p2[0], p1[1]],
        ];
        setDrawingPoints(rect);
        const wktPoints = rect.map((p) => `${p[1]} ${p[0]}`).join(", ");
        setFormData((prev) => ({
          ...prev,
          area: `POLYGON((${wktPoints}, ${rect[0][1]} ${rect[0][0]}))`,
        }));
        toast.success("Retangulo criado");
      }
    }
  };

  const handleCanvasMapClick = (lat: number, lng: number) => {
    if (ignoreNextCanvasClickRef.current) {
      ignoreNextCanvasClickRef.current = false;
      return;
    }

    if (!isEditorOpen) {
      return;
    }

    if (editingGeofence && formData.type !== "circle") {
      toast.info(
        "Para editar esta cerca, arraste os pontos existentes. Clique em Nova Cerca para começar outra.",
      );
      return;
    }

    handleDrawingMapClick(lat, lng);
  };

  const updatePolygonArea = (points: [number, number][]) => {
    setDrawingPoints(points);
    if (points.length < 3) return;

    const wktPoints = points.map((p) => `${p[1]} ${p[0]}`).join(", ");
    setFormData((prev) => ({
      ...prev,
      area: `POLYGON((${wktPoints}, ${points[0][1]} ${points[0][0]}))`,
    }));
  };

  const updateRectangleArea = (
    cornerIndex: number,
    point: [number, number],
  ) => {
    if (drawingPoints.length !== 4) return;

    const oppositeCorner = drawingPoints[(cornerIndex + 2) % 4];
    const rect: [number, number][] = [
      [point[0], point[1]],
      [point[0], oppositeCorner[1]],
      [oppositeCorner[0], oppositeCorner[1]],
      [oppositeCorner[0], point[1]],
    ];
    setDrawingPoints(rect);

    const wktPoints = rect.map((p) => `${p[1]} ${p[0]}`).join(", ");
    setFormData((prev) => ({
      ...prev,
      area: `POLYGON((${wktPoints}, ${rect[0][1]} ${rect[0][0]}))`,
    }));
  };

  const handlePointDrag = (index: number, point: [number, number]) => {
    if (formData.type === "rectangle") {
      updateRectangleArea(index, point);
      return;
    }

    const nextPoints = drawingPoints.map((currentPoint, currentIndex) =>
      currentIndex === index ? point : currentPoint,
    );

    updatePolygonArea(nextPoints);
  };

  const handleCircleCenterDrag = (point: [number, number]) => {
    setCircleCenter(point);
    if (!circleRadius) return;

    setFormData((prev) => ({
      ...prev,
      area: `CIRCLE((${point[1]} ${point[0]}),${circleRadius.toFixed(2)})`,
    }));
  };

  const handleCircleRadiusDrag = (point: [number, number]) => {
    if (!circleCenter) return;

    const R = 6371e3;
    const p1 = (circleCenter[0] * Math.PI) / 180;
    const p2 = (point[0] * Math.PI) / 180;
    const dp = ((point[0] - circleCenter[0]) * Math.PI) / 180;
    const dl = ((point[1] - circleCenter[1]) * Math.PI) / 180;
    const a =
      Math.sin(dp / 2) ** 2 +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    const radius = Math.max(
      R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
      5,
    );

    setCircleRadius(radius);
    setFormData((prev) => ({
      ...prev,
      area: `CIRCLE((${circleCenter[1]} ${circleCenter[0]}),${radius.toFixed(2)})`,
    }));
  };

  const handleClearDrawing = () => {
    setDrawingPoints([]);
    setCircleCenter(null);
    setCircleRadius(0);
    setFormData((prev) => ({ ...prev, area: "" }));
  };

  const toggleDevice = (deviceId: number) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId],
    );
  };

  const parsedGeofences = geofences
    .map((g): ParsedGeofenceItem | null => {
      const parsed = parseWKT(g.area);
      if (!parsed) return null;

      return {
        id: g.id,
        name: g.name,
        color: g.color || "#3b82f6",
        ...parsed,
      };
    })
    .filter((item): item is ParsedGeofenceItem => item !== null);

  const visibleMapGeofences = editingGeofence
    ? parsedGeofences.filter((item) => item.id !== editingGeofence.id)
    : parsedGeofences;

  const selectedGeofence =
    geofences.find((geofence) => geofence.id === selectedGeofenceId) ?? null;

  useEffect(() => {
      if (!searchParams) return;

    const geofenceIdParam = searchParams.get("geofenceId");
    if (!geofenceIdParam || geofences.length === 0) return;

    const geofenceId = Number(geofenceIdParam);
    if (!Number.isFinite(geofenceId)) return;

    const mode = searchParams.get("mode") ?? "view";
    const actionKey = `${mode}:${geofenceId}`;
    if (handledRouteActionRef.current === actionKey) return;

    const geofence = geofences.find((item) => item.id === geofenceId);
    if (!geofence) return;

    handledRouteActionRef.current = actionKey;

    if (mode === "edit") {
      void handleEdit(geofence);
    } else {
      focusGeofence(geofence);
    }

    router.replace("/geofences");
  }, [geofences, handleEdit, router, searchParams]);

  // parseWKT vem do utilitario compartilhado @/lib/parse-wkt
  // com deteccao automatica da ordem das coordenadas (lng lat vs lat lng)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        icon={ShieldCheck}
        title="Cercas Geográficas"
        description="Gerencie zonas de alerta e controle"
      />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div
          className={`border-r bg-card flex flex-col overflow-hidden transition-all duration-200 ${isEditorOpen ? "w-0 opacity-0 pointer-events-none" : "w-80 opacity-100"}`}
        >
          <div className="p-3 border-b flex-shrink-0 space-y-2">
            <Button className="w-full" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Cerca
            </Button>
            <p className="text-xs text-muted-foreground px-1">
              Clique em uma cerca para focar no mapa. Para criar, use o botão acima.
            </p>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto flex-1">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-2">
                Carregando...
              </p>
            ) : geofences.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">
                Nenhuma cerca criada ainda
              </p>
            ) : (
              geofences.map((geofence) => {
                const vehicleCount = getGeofenceVehicleCount(geofence);
                const isAll = devices.length > 0 && vehicleCount >= devices.length;
                const isSelected = selectedGeofenceId === geofence.id;

                return (
                  <Card
                    key={geofence.id}
                    className={`p-3 cursor-pointer transition-colors ${isSelected ? "border-blue-500/60 bg-blue-500/10" : "hover:bg-muted/40"}`}
                    onClick={() => focusGeofence(geofence)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: geofence.color || "#3b82f6",
                            }}
                          />
                          <h3 className="font-semibold text-sm truncate">
                            {geofence.name}
                          </h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          ID {geofence.id}
                        </p>
                        {geofence.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {geofence.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-xs bg-secondary px-2 py-0.5 rounded capitalize">
                            {getGeofenceTypeLabel(geofence.type)}
                          </span>
                          {geofence.active ? (
                            <span className="text-xs text-green-500">
                              Ativa
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">
                              Inativa
                            </span>
                          )}
                          <span className={`text-xs flex items-center gap-1 font-medium ${isAll || vehicleCount > 0 ? "text-blue-400" : "text-muted-foreground"}`}>
                            <Car className="w-3 h-3" />
                            <span>Vínculos</span>
                            <span>
                              {isAll ? `${devices.length} / ${devices.length}` : `${vehicleCount} / ${devices.length}`}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleEdit(geofence);
                          }}
                          title="Editar"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDelete(geofence.id);
                          }}
                          title="Remover"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="border-b px-4 py-3 flex items-center justify-between gap-3 bg-card/60">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <MapPinned className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <h2 className="text-sm font-semibold truncate">
                  {isEditorOpen
                    ? editingGeofence
                      ? `Editando: ${editingGeofence.name}`
                      : "Nova cerca em edição"
                    : selectedGeofence
                      ? selectedGeofence.name
                      : "Todas as cercas no mapa"}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {isEditorOpen
                  ? "Desenho direto no mapa. Polígono salva sem botão de finalizar."
                  : selectedGeofence
                    ? `ID ${selectedGeofence.id} · ${getGeofenceTypeLabel(selectedGeofence.type)}`
                    : `${geofences.length} cerca(s) visíveis. Selecione na lista ou clique em uma área no mapa.`}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {!isEditorOpen && selectedGeofence && (
                <Button
                  variant="outline"
                  onClick={() => void handleEdit(selectedGeofence)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar selecionada
                </Button>
              )}
              {isEditorOpen ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setIsEditorOpen(false);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Fechar edição
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex-1 relative min-h-0">
            <GeofenceDrawMap
              color={formData.color}
              type={formData.type}
              drawingPoints={drawingPoints}
              circleCenter={circleCenter}
              circleRadius={circleRadius}
              vehicles={previewVehicles}
              geofences={visibleMapGeofences}
              selectedGeofenceId={editingGeofence?.id ?? selectedGeofenceId}
              initialShowVehicles={false}
              initialViewportTarget={initialViewportTarget}
              prioritizeSelectedVehicles={selectedDeviceIds.length > 0}
              onPointDrag={handlePointDrag}
              onCircleCenterDrag={handleCircleCenterDrag}
              onCircleRadiusDrag={handleCircleRadiusDrag}
              onMapClick={handleCanvasMapClick}
              onGeofenceSelect={(geofenceId) => {
                const geofence = geofences.find((item) => item.id === geofenceId);
                if (!geofence) return;
                ignoreNextCanvasClickRef.current = true;
                focusGeofence(geofence);
              }}
            />

            <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000] max-w-md">
              {!isEditorOpen &&
                "Clique em uma cerca no mapa para selecionar e aproximar. Para criar ou editar, use os botões da lateral."}
              {isEditorOpen &&
                formData.type === "polygon" &&
                (drawingPoints.length < 3
                  ? `Clique para adicionar pontos (${drawingPoints.length} ponto(s)).`
                  : `Polígono com ${drawingPoints.length} pontos. Pressione e arraste os marcadores para ajustar a área.`)}
              {isEditorOpen &&
                formData.type === "circle" &&
                !circleCenter &&
                "Clique para marcar o centro do círculo."}
              {isEditorOpen &&
                formData.type === "circle" &&
                circleCenter &&
                !circleRadius &&
                "Clique novamente para definir o raio."}
              {isEditorOpen &&
                formData.type === "circle" &&
                circleCenter &&
                circleRadius > 0 &&
                "Pressione e arraste o ponto central para mover o círculo ou a alça externa para ajustar o raio."}
              {isEditorOpen &&
                formData.type === "rectangle" &&
                drawingPoints.length === 0 &&
                "Clique no primeiro canto do retângulo."}
              {isEditorOpen &&
                formData.type === "rectangle" &&
                drawingPoints.length === 1 &&
                "Clique no canto oposto para fechar o retângulo."}
              {isEditorOpen &&
                formData.type === "rectangle" &&
                drawingPoints.length === 4 &&
                "Pressione e arraste os pontos para redimensionar o retângulo."}
            </div>

            {isEditorOpen && (drawingPoints.length > 0 || circleCenter) && (
              <div className="absolute top-20 left-4 flex gap-2 z-[1000]">
                <Button variant="destructive" onClick={handleClearDrawing}>
                  Limpar desenho
                </Button>
              </div>
            )}
          </div>
        </div>

        {isEditorOpen && (
          <div
            className="w-[380px] border-l bg-card flex flex-col"
            style={{ minHeight: 0 }}
          >
            <div className="p-4 border-b space-y-1">
              <h3 className="text-base font-semibold">
                {editingGeofence ? "Editar Cerca" : "Nova Cerca"}
              </h3>
              <p className="text-xs text-muted-foreground">
                A forma é atualizada enquanto você desenha. Para editar, pressione e arraste os pontos no mapa. O nome precisa ser único.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <form
                id="geofence-form"
                onSubmit={handleSubmit}
                className="p-4 space-y-4"
              >
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">
                    Nome *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    placeholder="Ex: Área de entrega"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm font-medium">
                    Descrição
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                    placeholder="Informações adicionais"
                    rows={2}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Tipo de Cerca</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: GeofenceType) => {
                      setDrawingPoints([]);
                      setCircleCenter(null);
                      setCircleRadius(0);
                      setFormData({
                        ...formData,
                        type: value,
                        area: "",
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="polygon">Polígono</SelectItem>
                      <SelectItem value="circle">Círculo</SelectItem>
                      <SelectItem value="rectangle">Retângulo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Cor da Cerca</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      placeholder="#3b82f6"
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(value) =>
                      setFormData({ ...formData, active: value })
                    }
                  />
                  <Label htmlFor="active" className="cursor-pointer text-sm">
                    Cerca ativa
                  </Label>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDeviceList((value) => !value)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-blue-500" />
                      Veículos vinculados
                      {(assignToAll || selectedDeviceIds.length > 0) && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                          {assignToAll
                            ? `Todos (${devices.length})`
                            : `${selectedDeviceIds.length} selecionado(s)`}
                        </span>
                      )}
                    </span>
                    <ChevronUp
                      className={`w-4 h-4 ${showDeviceList ? "" : "hidden"}`}
                    />
                    <ChevronDown
                      className={`w-4 h-4 ${showDeviceList ? "hidden" : ""}`}
                    />
                  </button>

                  {showDeviceList && (
                    <div className="p-3 space-y-2 border-t">
                      <div
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${assignToAll ? "bg-blue-500/10 border-blue-500/40" : "border-transparent hover:bg-muted/50"}`}
                        onClick={() => {
                          setAssignToAll(true);
                          setSelectedDeviceIds([]);
                        }}
                      >
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${assignToAll ? "bg-blue-500 border-blue-500" : "border-muted-foreground"}`}
                        >
                          {assignToAll && (
                            <span className="text-white text-[10px] font-bold leading-none">
                              ✓
                            </span>
                          )}
                        </div>
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">
                          Todos os veículos ({devices.length})
                        </span>
                      </div>

                      <div
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${!assignToAll && selectedDeviceIds.length === 0 ? "bg-muted/30 border-muted" : "border-transparent hover:bg-muted/50"}`}
                        onClick={() => {
                          setAssignToAll(false);
                          setSelectedDeviceIds([]);
                        }}
                      >
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${!assignToAll && selectedDeviceIds.length === 0 ? "bg-muted-foreground/40 border-muted-foreground/40" : "border-muted-foreground"}`}
                        >
                          {!assignToAll && selectedDeviceIds.length === 0 && (
                            <span className="text-white text-[10px] font-bold leading-none">
                              ✓
                            </span>
                          )}
                        </div>
                        <Car className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Nenhum veículo
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground px-1 font-medium border-t pt-2">
                        Ou selecione específicos:
                      </p>

                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {devices.length === 0 && (
                          <p className="text-xs text-muted-foreground p-2">
                            Nenhum veículo cadastrado
                          </p>
                        )}

                        {devices.map((device) => {
                          const checked =
                            !assignToAll && selectedDeviceIds.includes(device.id);

                          return (
                            <div
                              key={device.id}
                              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${checked ? "bg-blue-500/10 border-blue-500/40" : "border-transparent hover:bg-muted/50"}`}
                              onClick={() => {
                                setAssignToAll(false);
                                toggleDevice(device.id);
                              }}
                            >
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? "bg-blue-500 border-blue-500" : "border-muted-foreground"}`}
                              >
                                {checked && (
                                  <span className="text-white text-[10px] font-bold leading-none">
                                    ✓
                                  </span>
                                )}
                              </div>
                              <Car className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm truncate font-medium">
                                  {device.name}
                                </p>
                                {device.uniqueId && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {device.uniqueId}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t space-y-1">
                  {formData.area ? (
                    <p className="text-xs text-green-500">
                      Área pronta para salvar
                    </p>
                  ) : (
                    <p className="text-xs text-yellow-500">
                      Desenhe a área direto no mapa ao lado
                    </p>
                  )}
                  {selectedGeofence && !editingGeofence && (
                    <p className="text-xs text-muted-foreground">
                      Selecionada no mapa: {selectedGeofence.name}
                    </p>
                  )}
                </div>
              </form>
            </div>

            <div className="p-4 border-t space-y-2 flex-shrink-0">
              <Button
                type="submit"
                form="geofence-form"
                disabled={!formData.name.trim() || !formData.area || isSaving}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : editingGeofence ? (
                  "Atualizar Cerca"
                ) : (
                  "Criar Cerca"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsEditorOpen(false);
                }}
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
