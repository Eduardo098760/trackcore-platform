"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const GEOFENCE_ASSIGNMENTS_CHANGED = "geofenceAssignmentsChanged";
export const GEOFENCE_COLLECTION_CHANGED = "geofenceCollectionChanged";

export interface GeofenceSyncDetail {
  geofenceId?: number;
  deviceId?: number;
  source?: string;
}

function dispatchGeofenceSyncEvent(
  eventName: string,
  detail: GeofenceSyncDetail = {},
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function emitGeofenceAssignmentsChanged(
  detail: GeofenceSyncDetail = {},
) {
  dispatchGeofenceSyncEvent(GEOFENCE_ASSIGNMENTS_CHANGED, detail);
}

export function emitGeofenceCollectionChanged(
  detail: GeofenceSyncDetail = {},
) {
  dispatchGeofenceSyncEvent(GEOFENCE_COLLECTION_CHANGED, detail);
}

export function useGeofenceSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const invalidateGeofenceQueries = () => {
      queryClient.invalidateQueries({ queryKey: ["geofences"] });
      queryClient.invalidateQueries({ queryKey: ["geofence-device-counts"] });
      queryClient.invalidateQueries({ queryKey: ["device-geofences"] });
    };

    const handleAssignmentsChanged = () => {
      invalidateGeofenceQueries();
    };

    const handleCollectionChanged = () => {
      invalidateGeofenceQueries();
    };

    window.addEventListener(
      GEOFENCE_ASSIGNMENTS_CHANGED,
      handleAssignmentsChanged,
    );
    window.addEventListener(GEOFENCE_COLLECTION_CHANGED, handleCollectionChanged);

    return () => {
      window.removeEventListener(
        GEOFENCE_ASSIGNMENTS_CHANGED,
        handleAssignmentsChanged,
      );
      window.removeEventListener(
        GEOFENCE_COLLECTION_CHANGED,
        handleCollectionChanged,
      );
    };
  }, [queryClient]);
}