"use client";

import { useEffect, useRef } from "react";
import type { Device, Position } from "@/types";
import "leaflet.markercluster/dist/MarkerCluster.css";

let L: any;
if (typeof window !== "undefined") {
  L = require("leaflet");
  require("leaflet.markercluster");
}

interface MarkerClusterGroupProps {
  devices: Device[];
  positionsMap: Map<number, Position>;
  deviceTrails: Map<number, { lat: number; lng: number; ts: number }[]>;
  showVehicleLabels: boolean;
  getDeviceIcon: (
    device: Device,
    position: Position,
    bearing?: number,
    showLabel?: boolean,
  ) => any;
  onDeviceClick: (device: Device) => void;
  map: any;
}

export function MarkerClusterGroup({
  devices,
  positionsMap,
  deviceTrails,
  showVehicleLabels,
  getDeviceIcon,
  onDeviceClick,
  map,
}: MarkerClusterGroupProps) {
  const clusterGroupRef = useRef<any>(null);
  const markerMapRef = useRef<Map<number, any>>(new Map());

  // Initialize the cluster group once
  useEffect(() => {
    if (!map || !L) return;

    const group = (L as any).markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 16,
      animate: true,
      animateAddingMarkers: false,
      chunkedLoading: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let size: number;
        let className: string;
        if (count < 10) {
          size = 40;
          className = "marker-cluster-small";
        } else if (count < 50) {
          size = 48;
          className = "marker-cluster-medium";
        } else {
          size = 56;
          className = "marker-cluster-large";
        }
        return L.divIcon({
          html: `<div class="cluster-inner"><span>${count}</span></div>`,
          className: `marker-cluster ${className}`,
          iconSize: L.point(size, size),
        });
      },
    });

    map.addLayer(group);
    clusterGroupRef.current = group;

    return () => {
      if (map && group) {
        map.removeLayer(group);
      }
      markerMapRef.current.clear();
    };
  }, [map]);

  // Update markers when data changes
  useEffect(() => {
    const group = clusterGroupRef.current;
    if (!group || !L) return;

    const existingMarkers = markerMapRef.current;
    const currentDeviceIds = new Set<number>();

    for (const device of devices) {
      const position = positionsMap.get(device.id);
      if (!position) continue;

      currentDeviceIds.add(device.id);

      // Compute bearing
      let bearing: number | undefined;
      if (typeof position.course === "number") {
        bearing = position.course;
      } else {
        const trail = deviceTrails.get(device.id) || [];
        if (trail.length >= 2) {
          try {
            const { bearingDeg } = require("@/lib/utils");
            const a = trail[trail.length - 2];
            const b = trail[trail.length - 1];
            bearing = bearingDeg(a.lat, a.lng, b.lat, b.lng);
          } catch {
            bearing = undefined;
          }
        }
      }

      const icon = getDeviceIcon(device, position, bearing, showVehicleLabels);
      if (!icon) continue;

      const existingMarker = existingMarkers.get(device.id);
      if (existingMarker) {
        // Update existing marker position and icon
        const latlng = L.latLng(position.latitude, position.longitude);
        existingMarker.setLatLng(latlng);
        existingMarker.setIcon(icon);
      } else {
        // Create new marker
        const marker = L.marker([position.latitude, position.longitude], {
          icon,
        });
        const dev = device; // capture for closure
        marker.on("click", () => onDeviceClick(dev));
        existingMarkers.set(device.id, marker);
        group.addLayer(marker);
      }
    }

    // Remove markers for devices no longer present
    for (const [deviceId, marker] of existingMarkers) {
      if (!currentDeviceIds.has(deviceId)) {
        group.removeLayer(marker);
        existingMarkers.delete(deviceId);
      }
    }
  }, [devices, positionsMap, deviceTrails, showVehicleLabels, getDeviceIcon, onDeviceClick]);

  return null;
}
