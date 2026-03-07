"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, ChevronDown } from "lucide-react";
import { Event, Device, Client } from "@/types";
import { EventCard } from "./event-card";
import { EVENTS_PER_PAGE } from "./event-constants";

interface EventListProps {
  events: Event[];
  devices: Device[];
  clients: Client[];
  isLoading: boolean;
  isResolvePending: boolean;
  loadingMapEventId: number | null;
  searchQuery: string;
  statusFilter: string;
  typeFilter: string;
  deviceFilter: string;
  periodDays: string;
  onResolve: (eventId: number) => void;
  onViewOnMap: (event: Event, device: Device | undefined) => void;
}

export const EventList = React.memo(function EventList({
  events,
  devices,
  clients,
  isLoading,
  isResolvePending,
  loadingMapEventId,
  searchQuery,
  statusFilter,
  typeFilter,
  deviceFilter,
  periodDays,
  onResolve,
  onViewOnMap,
}: EventListProps) {
  const [visibleCount, setVisibleCount] = useState(EVENTS_PER_PAGE);

  // Reset visible count when filters change
  const filterKey = `${searchQuery}|${statusFilter}|${typeFilter}|${deviceFilter}|${periodDays}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setVisibleCount(EVENTS_PER_PAGE);
  }

  // Build device/client lookup maps once
  const deviceMap = useMemo(
    () => new Map(devices.map((d) => [d.id, d])),
    [devices],
  );
  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  const getClientName = (device: Device | undefined) => {
    if (!device) return null;
    const clientId =
      device.clientId ?? (device as { groupId?: number }).groupId;
    if (clientId == null) return null;
    return clientMap.get(clientId)?.name ?? null;
  };

  // Paginate
  const visibleEvents = useMemo(
    () => events.slice(0, visibleCount),
    [events, visibleCount],
  );
  const hasMore = events.length > visibleCount;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    const hasFilters =
      searchQuery ||
      statusFilter !== "all" ||
      typeFilter !== "all" ||
      deviceFilter !== "all";
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Bell className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Nenhum evento encontrado
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {hasFilters
                ? "Tente ajustar os filtros para ver mais resultados."
                : `Não há eventos nos últimos ${periodDays} dias para os veículos visíveis.`}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {visibleEvents.map((event) => {
        const device = deviceMap.get(event.deviceId);
        return (
          <EventCard
            key={event.id}
            event={event}
            device={device}
            clientName={getClientName(device)}
            isResolvePending={isResolvePending}
            isLoadingMap={loadingMapEventId === event.id}
            onResolve={onResolve}
            onViewOnMap={onViewOnMap}
          />
        );
      })}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((c) => c + EVENTS_PER_PAGE)}
            className="gap-2"
          >
            <ChevronDown className="w-4 h-4" />
            Carregar mais ({events.length - visibleCount} restantes)
          </Button>
        </div>
      )}
    </div>
  );
});
