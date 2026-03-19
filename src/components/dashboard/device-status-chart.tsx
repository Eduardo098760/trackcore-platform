'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Device } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';

const STATUS_CONFIG = [
  { key: 'online', label: 'Online', color: '#10b981' },
  { key: 'moving', label: 'Em movimento', color: '#3b82f6' },
  { key: 'stopped', label: 'Parado', color: '#f59e0b' },
  { key: 'offline', label: 'Offline', color: '#6b7280' },
  { key: 'blocked', label: 'Bloqueado', color: '#ef4444' },
] as const;

interface DeviceStatusChartProps {
  devices: Device[];
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string; percent: number } }> }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
        <span className="font-medium">{name}</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        {value} veículo{value !== 1 ? 's' : ''} · {(p.percent * 100).toFixed(1)}%
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius - 2}
      outerRadius={outerRadius + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      style={{ filter: 'brightness(1.2)', transition: 'all 0.2s ease' }}
    />
  );
}

export function DeviceStatusChart({ devices }: DeviceStatusChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const statusCounts = devices.reduce((acc, device) => {
    const s = device.status || 'offline';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const total = devices.length;

  const data = STATUS_CONFIG
    .map(({ key, label, color }) => ({
      name: label,
      value: statusCounts[key] || 0,
      color,
      percent: total > 0 ? (statusCounts[key] || 0) / total : 0,
    }))
    .filter(item => item.value > 0);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status dos Veículos</CardTitle>
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
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Status dos Veículos
          <span className="ml-2 text-sm font-normal text-muted-foreground">({total})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Donut chart with fill animation */}
          <div className="shrink-0">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={animated ? 50 : 85}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                  animationBegin={0}
                  animationDuration={800}
                  animationEasing="ease-out"
                  activeIndex={activeIndex}
                  activeShape={ActiveShape}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ zIndex: 10 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend list with staggered fade-in */}
          <div className="flex flex-col gap-2.5 min-w-0">
            {STATUS_CONFIG.map(({ key, label, color }, i) => {
              const count = statusCounts[key] || 0;
              const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 text-sm transition-all duration-500"
                  style={{
                    opacity: animated ? 1 : 0,
                    transform: animated ? 'translateX(0)' : 'translateX(10px)',
                    transitionDelay: `${i * 80}ms`,
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-muted-foreground whitespace-nowrap">{label}</span>
                  <span className="ml-auto font-semibold tabular-nums">
                    {count}
                  </span>
                  <span className="text-xs text-muted-foreground w-[34px] text-right tabular-nums">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
