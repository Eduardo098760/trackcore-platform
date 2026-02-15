'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Event, Device, Client } from '@/types';
import { getEventTypeLabel, getEventTypeColor, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin } from 'lucide-react';

interface RecentEventsProps {
  events: Event[];
  devices: Device[];
  clients?: Client[];
}

export function RecentEvents({ events, devices, clients = [] }: RecentEventsProps) {
  const getDeviceName = (deviceId: number) => devices.find((d) => d.id === deviceId)?.name ?? `Veículo #${deviceId}`;
  const getClientName = (deviceId: number) => {
    const device = devices.find((d) => d.id === deviceId);
    const clientId = device?.clientId ?? (device as { groupId?: number })?.groupId;
    if (clientId == null) return null;
    return clients.find((c) => c.id === clientId)?.name ?? null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eventos Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum evento registrado
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const vehicleName = getDeviceName(event.deviceId);
                const clientName = getClientName(event.deviceId);
                return (
                  <Link
                    key={event.id}
                    href={`/map?deviceId=${event.deviceId}`}
                    className="block"
                  >
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/60 dark:hover:bg-gray-900/50 transition-colors cursor-pointer group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary">
                            {getEventTypeLabel(event.type)}
                          </p>
                          <Badge
                            variant="secondary"
                            className={`shrink-0 ${getEventTypeColor(event.type)}`}
                          >
                            {event.resolved ? 'Resolvido' : 'Ativo'}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-foreground mt-1 truncate" title={vehicleName}>
                          {vehicleName}
                        </p>
                        {clientName && (
                          <p className="text-xs text-muted-foreground truncate" title={clientName}>
                            {clientName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          {formatDate(event.serverTime)}
                          <MapPin className="w-3 h-3 opacity-70" aria-hidden />
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
