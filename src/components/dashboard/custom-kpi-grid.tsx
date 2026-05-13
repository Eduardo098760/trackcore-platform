"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Calculator, Mail, Radar } from 'lucide-react';
import type { Device, Event, Position } from '@/types';
import type { KPI } from '@/types/kpi';
import { evaluateKpi } from '@/lib/kpi-engine';

interface CustomKpiGridProps {
  kpis: KPI[];
  devices: Device[];
  positions: Position[];
  events: Event[];
}

const KPI_COLORS = [
  { color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  { color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  { color: 'text-violet-500', bgColor: 'bg-violet-500/10' },
  { color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
];

export function CustomKpiGrid({ kpis, devices, positions, events }: CustomKpiGridProps) {
  const visibleKpis = useMemo(
    () => kpis.filter((kpi) => kpi.enabledOnDashboard !== false),
    [kpis],
  );

  const evaluatedKpis = useMemo(
    () => visibleKpis.map((kpi) => ({ kpi, result: evaluateKpi(kpi, { devices, positions, events }) })),
    [visibleKpis, devices, positions, events],
  );

  if (evaluatedKpis.length === 0) {
    return null;
  }

  return (
      <Card className="lg:col-span-full">
      <CardHeader className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base xl:text-lg">
            <Radar className="w-4 h-4 xl:w-5 xl:h-5" />
            KPIs Personalizados
          </CardTitle>
          <p className="mt-1 text-xs xl:text-sm text-muted-foreground max-w-2xl">
            Cada card exibe o per\u00edodo salvo no KPI e deixa vis\u00edvel a base usada no c\u00e1lculo atual.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {evaluatedKpis.length} ativo{evaluatedKpis.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 xl:gap-3">
          {evaluatedKpis.map(({ kpi, result }, index) => {
            const palette = KPI_COLORS[index % KPI_COLORS.length];

            return (
            <div
              key={kpi.id}
              className="flex items-start gap-2.5 rounded-xl border border-border p-2.5 transition-colors hover:bg-muted/40"
            >
              <div className={`shrink-0 rounded-lg p-1.5 ${palette.bgColor}`}>
                <BarChart3 className={`h-3.5 w-3.5 ${palette.color}`} />
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-base xl:text-lg font-bold ${palette.color}`}>{result.value}</p>
                <p className="truncate text-[11px] font-medium text-foreground leading-tight">{kpi.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{result.subtext}</p>

                <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="gap-1 text-[9px]">
                  <Calculator className="h-3 w-3" />
                  {kpi.sensorLabel || kpi.sensorKey}
                </Badge>
                <Badge variant="outline" className="text-[9px]">
                  {result.periodLabel}
                </Badge>
                {kpi.reportSchedule?.enabled && (
                  <Badge className="gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]">
                    <Mail className="h-3 w-3" />
                    Email ativo
                  </Badge>
                )}
                </div>

                <p className="mt-1.5 text-[9px] text-muted-foreground/80 leading-tight">{result.basis}</p>
              </div>
            </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}