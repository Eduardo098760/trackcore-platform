'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvents, markEventAsResolved, getDevices, getClients } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getEventTypeLabel, getEventTypeColor, formatDate } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle,
  Bell,
  Search,
  Zap,
  Shield,
  Battery,
  Radio,
  MapPin,
  RefreshCw,
  Car,
  User,
  Calendar,
  Filter,
} from 'lucide-react';
import { Event, Device, Client } from '@/types';
import type { UserRole } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'speedLimit', label: 'Excesso de velocidade' },
  { value: 'geofence', label: 'Cerca eletrônica' },
  { value: 'ignitionOn', label: 'Ignição ligada' },
  { value: 'ignitionOff', label: 'Ignição desligada' },
  { value: 'lowBattery', label: 'Bateria fraca' },
  { value: 'connectionLost', label: 'Conexão perdida' },
  { value: 'connectionRestored', label: 'Conexão restabelecida' },
  { value: 'deviceBlocked', label: 'Veículo bloqueado' },
  { value: 'deviceUnblocked', label: 'Veículo desbloqueado' },
];

const PERIOD_OPTIONS: { value: string; label: string; days: number }[] = [
  { value: '7', label: 'Últimos 7 dias', days: 7 },
  { value: '30', label: 'Últimos 30 dias', days: 30 },
  { value: '90', label: 'Últimos 90 dias', days: 90 },
];

function getDeviceIdsForUser(
  deviceList: { id: number; clientId?: number }[],
  user: { role?: UserRole; clientId?: number } | null
): number[] {
  if (!deviceList.length) return [];
  if (!user?.role || user.role === 'admin' || user.role === 'operator') return deviceList.map((d) => d.id);
  if (user.role === 'client') {
    if (user.clientId == null) return deviceList.map((d) => d.id);
    return deviceList.filter((d) => d.clientId === user.clientId).map((d) => d.id);
  }
  return [];
}

function getEventIcon(type: string) {
  switch (type) {
    case 'speedLimit':
      return <Zap className="w-5 h-5" />;
    case 'deviceBlocked':
    case 'deviceUnblocked':
      return <Shield className="w-5 h-5" />;
    case 'lowBattery':
      return <Battery className="w-5 h-5" />;
    case 'connectionLost':
    case 'connectionRestored':
      return <Radio className="w-5 h-5" />;
    case 'geofence':
      return <MapPin className="w-5 h-5" />;
    default:
      return <Bell className="w-5 h-5" />;
  }
}

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [periodDays, setPeriodDays] = useState<string>('30');
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const deviceIds = useMemo(() => getDeviceIdsForUser(devices, user), [devices, user]);
  const deviceIdsKey = useMemo(() => [...deviceIds].sort((a, b) => a - b).join(','), [deviceIds]);
  const filteredDevices = useMemo(() => devices.filter((d) => deviceIds.includes(d.id)), [devices, deviceIds]);

  const period = PERIOD_OPTIONS.find((p) => p.value === periodDays) ?? PERIOD_OPTIONS[1];
  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['events', deviceIdsKey, period.days],
    queryFn: () => {
      const now = new Date();
      const from = new Date(now.getTime() - period.days * 24 * 60 * 60 * 1000);
      return getEvents({ from: from.toISOString(), to: now.toISOString(), deviceIds });
    },
    enabled: devices !== undefined && deviceIds.length >= 0,
    refetchInterval: 30000,
  });

  const markAsResolvedMutation = useMutation({
    mutationFn: markEventAsResolved,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento marcado como resolvido');
    },
    onError: () => {
      toast.error('Não foi possível marcar como resolvido');
    },
  });

  const getClientName = (device: Device | undefined) => {
    if (!device) return null;
    const clientId = device.clientId ?? (device as { groupId?: number }).groupId;
    if (clientId == null) return null;
    return clients.find((c) => c.id === clientId)?.name ?? null;
  };

  const filteredEvents = useMemo(() => {
    let list = [...events];
    const deviceIdFilter = deviceFilter === 'all' ? null : parseInt(deviceFilter, 10);

    list = list.filter((event) => {
      const device = devices.find((d) => d.id === event.deviceId);
      const matchesSearch =
        !searchQuery.trim() ||
        (device &&
          (device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            device.plate?.toLowerCase().includes(searchQuery.toLowerCase())));
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !event.resolved) ||
        (statusFilter === 'resolved' && event.resolved);
      const matchesType = typeFilter === 'all' || event.type === typeFilter;
      const matchesDevice = !deviceIdFilter || event.deviceId === deviceIdFilter;
      return matchesSearch && matchesStatus && matchesType && matchesDevice;
    });

    list.sort((a, b) => new Date(b.serverTime).getTime() - new Date(a.serverTime).getTime());
    return list;
  }, [events, devices, searchQuery, statusFilter, typeFilter, deviceFilter]);

  const activeCount = events.filter((e) => !e.resolved).length;
  const resolvedCount = events.filter((e) => e.resolved).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={AlertTriangle}
        title="Eventos e Alertas"
        description="Monitore e gerencie todos os alertas dos veículos"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchEvents()}
            disabled={eventsLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${eventsLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
        stats={[
          { label: 'Ativos', value: activeCount, variant: 'danger' },
          { label: 'Resolvidos', value: resolvedCount, variant: 'success' },
          { label: 'Total no período', value: events.length, variant: 'default' },
        ]}
      />

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filtros</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por veículo ou placa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os veículos</SelectItem>
                {filteredDevices.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name} {d.plate ? `(${d.plate})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={periodDays} onValueChange={setPeriodDays}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de eventos */}
      {devicesLoading || eventsLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const device = devices.find((d) => d.id === event.deviceId);
            const clientName = getClientName(device);
            const vehicleLabel = device ? `${device.name}${device.plate ? ` · ${device.plate}` : ''}` : `Veículo #${event.deviceId}`;

            return (
              <Card
                key={event.id}
                className={`overflow-hidden transition-all hover:shadow-md ${
                  event.resolved
                    ? 'bg-card border-border'
                    : 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-500/20'
                }`}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4">
                    <div className="flex flex-1 gap-4 min-w-0">
                      <div className={`shrink-0 p-3 rounded-xl ${getEventTypeColor(event.type)}`}>
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-foreground">
                            {getEventTypeLabel(event.type)}
                          </h3>
                          <Badge
                            variant="secondary"
                            className={
                              event.resolved
                                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            }
                          >
                            {event.resolved ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" /> Resolvido
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3 h-3 mr-1" /> Ativo
                              </>
                            )}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5" title={vehicleLabel}>
                            <Car className="w-3.5 h-3.5" />
                            <span className="truncate font-medium text-foreground">{vehicleLabel}</span>
                          </span>
                          {clientName && (
                            <span className="flex items-center gap-1.5" title={clientName}>
                              <User className="w-3.5 h-3.5" />
                              <span className="truncate">{clientName}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(event.serverTime)}
                          </span>
                        </div>
                        {/* Detalhes por tipo */}
                        <div className="mt-2 text-sm">
                          {event.type === 'speedLimit' && (event.attributes?.speed != null || event.attributes?.limit != null) && (
                            <p className="text-amber-600 dark:text-amber-400 font-medium">
                              Velocidade: {event.attributes.speed ?? '—'} km/h
                              {event.attributes.limit != null && ` (Limite: ${event.attributes.limit} km/h)`}
                            </p>
                          )}
                          {event.type === 'lowBattery' && event.attributes?.batteryLevel != null && (
                            <p className="text-amber-600 dark:text-amber-400 font-medium">
                              Bateria: {event.attributes.batteryLevel}%
                            </p>
                          )}
                          {event.type === 'geofence' && event.attributes?.geofenceName && (
                            <p className="text-muted-foreground">Cerca: {event.attributes.geofenceName}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!event.resolved && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => markAsResolvedMutation.mutate(event.id)}
                          disabled={markAsResolvedMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Resolver
                        </Button>
                      )}
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/map?deviceId=${event.deviceId}`}>
                          <MapPin className="w-4 h-4 mr-1" />
                          Ver no mapa
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredEvents.length === 0 && (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Bell className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum evento encontrado</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || deviceFilter !== 'all'
                      ? 'Tente ajustar os filtros para ver mais resultados.'
                      : `Não há eventos nos últimos ${period.days} dias para os veículos visíveis.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
