"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Device, Position, VehicleCategory, SpeedAlert, EventAlert } from "@/types";
import type { TileLayerKey } from "@/components/map/map-constants";

export interface MapEditForm {
  name: string;
  uniqueId: string;
  plate: string;
  phone: string;
  category: VehicleCategory;
  model: string;
  year: number;
  color: string;
  contact: string;
  speedLimit: number;
  groupId: number;
  expiryDate: string;
}

const defaultEditForm: MapEditForm = {
  name: "",
  uniqueId: "",
  plate: "",
  phone: "",
  category: "car",
  model: "",
  year: new Date().getFullYear(),
  color: "",
  contact: "",
  speedLimit: 80,
  groupId: 0,
  expiryDate: "",
};

export function useMapState() {
  const searchParams = useSearchParams();

  // Core state
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const hasAppliedUrlDevice = useRef<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isHighDpi, setIsHighDpi] = useState(false);
  const [followVehicle, setFollowVehicle] = useState(true);

  // Trails & distance
  const [deviceTrails, setDeviceTrails] = useState<
    Map<number, { lat: number; lng: number; ts: number }[]>
  >(new Map());
  const [deviceRecentDistance, setDeviceRecentDistance] = useState<
    Map<number, number>
  >(new Map());

  // Connection
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState<MapEditForm>(defaultEditForm);

  // Geofence dialog
  const [geofenceDialogDevice, setGeofenceDialogDevice] =
    useState<Device | null>(null);
  const [assigningGeofenceId, setAssigningGeofenceId] = useState<number | null>(
    null,
  );

  // Map display toggles
  const [showGeofences, setShowGeofences] = useState(true);
  const [showSpeedAlerts, setShowSpeedAlerts] = useState(true);
  const [showVehicleLabels, setShowVehicleLabels] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("mapShowVehicleLabels") !== "false";
    } catch {
      return true;
    }
  });

  // Speed alerts
  const [speedAlerts, setSpeedAlerts] = useState<SpeedAlert[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("speedAlerts");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Event alerts (unified — all event types)
  const [eventAlerts, setEventAlerts] = useState<EventAlert[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("eventAlerts");
      if (!stored) return [];
      const alerts: EventAlert[] = JSON.parse(stored);

      // Filtrar alertas de eventos já resolvidos
      let resolvedIds: number[] = [];
      try {
        const res = localStorage.getItem("resolvedEvents");
        if (res) resolvedIds = JSON.parse(res);
      } catch { /* ignore */ }

      if (resolvedIds.length === 0) return alerts;
      const cleaned = alerts.filter((a) => {
        const numId = Number(a.id.replace("event-", ""));
        return !resolvedIds.includes(numId);
      });
      // Persistir a lista limpa
      if (cleaned.length !== alerts.length) {
        localStorage.setItem("eventAlerts", JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  });

  // Map style — persist across sessions
  const [mapStyle, setMapStyleState] = useState<TileLayerKey>(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const stored = localStorage.getItem("mapStyle");
      if (stored && ["dark", "light", "streets", "satellite", "googleRoads", "googleSatellite", "googleHybrid"].includes(stored)) {
        return stored as TileLayerKey;
      }
    } catch {}
    return "dark";
  });

  const setMapStyle = useCallback((style: TileLayerKey) => {
    setMapStyleState(style);
    try { localStorage.setItem("mapStyle", style); } catch {}
  }, []);

  // Planned route
  const routeIdFromUrl = searchParams?.get("routeId") || null;
  const [plannedRouteGeometry, setPlannedRouteGeometry] = useState<
    [number, number][]
  >([]);
  const [plannedRouteName, setPlannedRouteName] = useState<string | null>(null);
  const [showPlannedRouteLabel, setShowPlannedRouteLabel] = useState(true);

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
    try {
      setIsHighDpi(
        typeof window !== "undefined" && (window.devicePixelRatio || 1) > 1,
      );
    } catch {
      setIsHighDpi(false);
    }
  }, []);

  // Speed alert event listeners
  useEffect(() => {
    const addHandler = (e: Event) => {
      const alert = (e as CustomEvent<SpeedAlert>).detail;
      setSpeedAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev].slice(0, 100);
      });
    };

    const clearHandler = () => {
      setSpeedAlerts([]);
    };

    const removeHandler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      setSpeedAlerts((prev) => prev.filter((a) => a.id !== id));
    };

    window.addEventListener("speedAlertAdded", addHandler);
    window.addEventListener("speedAlertsCleared", clearHandler);
    window.addEventListener("speedAlertRemoved", removeHandler);

    try {
      const stored = localStorage.getItem("speedAlerts");
      if (stored) {
        const parsed: SpeedAlert[] = JSON.parse(stored);
        if (parsed.length > 0) {
          setSpeedAlerts(parsed);
        }
      }
    } catch {
      /* ignore */
    }

    return () => {
      window.removeEventListener("speedAlertAdded", addHandler);
      window.removeEventListener("speedAlertsCleared", clearHandler);
      window.removeEventListener("speedAlertRemoved", removeHandler);
    };
  }, []);

  // Event alert event listeners
  useEffect(() => {
    const addHandler = (e: Event) => {
      const alert = (e as CustomEvent<EventAlert>).detail;
      setEventAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev].slice(0, 50);
      });
    };

    const clearHandler = () => {
      setEventAlerts([]);
    };

    const removeHandler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      setEventAlerts((prev) => prev.filter((a) => a.id !== id));
    };

    window.addEventListener("eventAlertAdded", addHandler);
    window.addEventListener("eventAlertsCleared", clearHandler);
    window.addEventListener("eventAlertRemoved", removeHandler);

    try {
      const stored = localStorage.getItem("eventAlerts");
      if (stored) {
        const parsed: EventAlert[] = JSON.parse(stored);
        if (parsed.length > 0) {
          setEventAlerts(parsed);
        }
      }
    } catch { /* ignore */ }

    return () => {
      window.removeEventListener("eventAlertAdded", addHandler);
      window.removeEventListener("eventAlertsCleared", clearHandler);
      window.removeEventListener("eventAlertRemoved", removeHandler);
    };
  }, []);

  const handleEditDevice = useCallback((device: Device) => {
    setEditingDevice(device);
    setEditForm({
      name: device.name,
      uniqueId: device.uniqueId,
      plate: device.plate,
      phone: device.phone || "",
      category: device.category,
      model: device.model || "",
      year: device.year || new Date().getFullYear(),
      color: device.color || "",
      contact: device.contact || "",
      speedLimit: Math.round(device.speedLimit || 80),
      groupId: 0,
      expiryDate: "",
    });
    setIsEditDialogOpen(true);
  }, []);

  const toggleVehicleLabels = useCallback(() => {
    setShowVehicleLabels((v) => {
      const next = !v;
      try {
        localStorage.setItem("mapShowVehicleLabels", next ? "true" : "false");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return {
    // Search params
    searchParams,
    routeIdFromUrl,

    // Core state
    selectedDevice,
    setSelectedDevice,
    hasAppliedUrlDevice,
    isClient,
    isHighDpi,
    followVehicle,
    setFollowVehicle,

    // Trails / distance
    deviceTrails,
    setDeviceTrails,
    deviceRecentDistance,
    setDeviceRecentDistance,

    // Connection
    isWsConnected,
    setIsWsConnected,

    // Edit dialog
    isEditDialogOpen,
    setIsEditDialogOpen,
    editingDevice,
    setEditingDevice,
    editForm,
    setEditForm,
    handleEditDevice,

    // Geofence dialog
    geofenceDialogDevice,
    setGeofenceDialogDevice,
    assigningGeofenceId,
    setAssigningGeofenceId,

    // Display toggles
    showGeofences,
    setShowGeofences,
    showSpeedAlerts,
    setShowSpeedAlerts,
    showVehicleLabels,
    toggleVehicleLabels,

    // Speed alerts
    speedAlerts,
    setSpeedAlerts,

    // Event alerts
    eventAlerts,
    setEventAlerts,

    // Map style
    mapStyle,
    setMapStyle,

    // Planned route
    plannedRouteGeometry,
    setPlannedRouteGeometry,
    plannedRouteName,
    setPlannedRouteName,
    showPlannedRouteLabel,
    setShowPlannedRouteLabel,
  };
}
