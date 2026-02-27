'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Device } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { deriveDeviceStatus } from '@/lib/utils';

interface DeviceStatusChartProps {
  devices: Device[];
}

export function DeviceStatusChart({ devices }: DeviceStatusChartProps) {
  const statusCounts = devices.reduce((acc, device) => {
    const s = deriveDeviceStatus(device.status);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = [
    { name: 'Online', value: statusCounts.online || 0, color: '#10b981' },
    { name: 'Em movimento', value: statusCounts.moving || 0, color: '#3b82f6' },
    { name: 'Parado', value: statusCounts.stopped || 0, color: '#f59e0b' },
    { name: 'Offline', value: statusCounts.offline || 0, color: '#6b7280' },
    { name: 'Bloqueado', value: statusCounts.blocked || 0, color: '#ef4444' },
  ].filter(item => item.value > 0);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status dos Veículos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            Nenhum veículo encontrado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status dos Veículos</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
