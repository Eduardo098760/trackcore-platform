'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, getDevices, getEvents, getClients } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { DeviceStatusChart } from '@/components/dashboard/device-status-chart';
import { RecentEvents } from '@/components/dashboard/recent-events';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserRole } from '@/types';

/** Admin/operador: todos os dispositivos. Cliente: apenas dispositivos do seu clientId. */
function getDeviceIdsForUser(deviceList: { id: number; clientId?: number }[], user: { role?: UserRole; clientId?: number } | null): number[] {
  if (!deviceList.length) return [];
  if (!user?.role || user.role === 'admin' || user.role === 'operator') {
    return deviceList.map((d) => d.id);
  }
  if (user.role === 'client') {
    if (user.clientId == null) return deviceList.map((d) => d.id);
    return deviceList.filter((d) => d.clientId === user.clientId).map((d) => d.id);
  }
  return [];
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    refetchInterval: 30000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const deviceIds = useMemo(
    () => getDeviceIdsForUser(devices ?? [], user),
    [devices, user]
  );
  const deviceIdsKey = useMemo(() => [...deviceIds].sort((a, b) => a - b).join(','), [deviceIds]);
  const filteredDevices = useMemo(
    () => (devices ?? []).filter((d) => deviceIds.includes(d.id)),
    [devices, deviceIds]
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', deviceIdsKey],
    queryFn: () => getDashboardStats({ deviceIds }),
    enabled: devices !== undefined,
    refetchInterval: 30000,
  });

  const { data: events, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ['recent-events', deviceIdsKey],
    queryFn: () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return getEvents({
        from: thirtyDaysAgo.toISOString(),
        to: now.toISOString(),
        deviceIds,
      });
    },
    enabled: devices !== undefined,
    refetchInterval: 30000,
  });

  // Log de erro para depuração em cliente
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    if ((stats as any)?.message) console.error('Stats query error:', (stats as any));
    // eslint-disable-next-line no-console
    if (eventsError) console.error('Events query error:', eventsError);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Visão geral do sistema de rastreamento
        </p>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        stats ? <StatsCards stats={stats} /> : (
          <div className="text-sm text-red-500">Falha ao carregar estatísticas</div>
        )
      )}

      {/* Charts and Recent Events */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Device Status Chart */}
        {devicesLoading ? (
          <Skeleton className="h-80" />
        ) : (
          <DeviceStatusChart devices={filteredDevices} />
        )}

        {/* Recent Events */}
        {eventsLoading ? (
          <Skeleton className="h-80" />
        ) : (
          events ? (
            <RecentEvents
              events={events.slice(0, 10)}
              devices={filteredDevices}
              clients={clients}
            />
          ) : (
            <div className="text-sm text-red-500">Falha ao carregar eventos</div>
          )
        )}
      </div>
    </div>
  );
}
