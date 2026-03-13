'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { BarChart3, TrendingUp, TrendingDown, Activity, Fuel, Clock, Loader2, AlertCircle, Gauge } from 'lucide-react';
import { getDevices } from '@/lib/api';
import { generateSummaryReport } from '@/lib/api/reports';

type Period = 'day' | 'week' | 'month';

function getPeriodRange(period: Period): { from: string; to: string; prevFrom: string; prevTo: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;
  let prevFrom: Date;
  let prevTo: Date;

  switch (period) {
    case 'day': {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      prevTo = new Date(from);
      prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - 1);
      break;
    }
    case 'week': {
      from = new Date(now);
      from.setDate(from.getDate() - 7);
      prevTo = new Date(from);
      prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - 7);
      break;
    }
    case 'month': {
      from = new Date(now);
      from.setMonth(from.getMonth() - 1);
      prevTo = new Date(from);
      prevFrom = new Date(prevTo);
      prevFrom.setMonth(prevFrom.getMonth() - 1);
      break;
    }
  }

  return {
    from: from.toISOString(),
    to,
    prevFrom: prevFrom.toISOString(),
    prevTo: prevTo.toISOString(),
  };
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export default function StatisticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');

  const ranges = useMemo(() => getPeriodRange(selectedPeriod), [selectedPeriod]);

  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const deviceIds = useMemo(() => devices?.map(d => d.id) ?? [], [devices]);

  const { data: currentSummary, isLoading: loadingCurrent, isError: errorCurrent } = useQuery({
    queryKey: ['statistics-current', selectedPeriod, deviceIds],
    queryFn: () => generateSummaryReport({
      deviceIds,
      from: ranges.from,
      to: ranges.to,
      type: 'summary',
    }),
    enabled: deviceIds.length > 0,
  });

  const { data: prevSummary, isLoading: loadingPrev } = useQuery({
    queryKey: ['statistics-prev', selectedPeriod, deviceIds],
    queryFn: () => generateSummaryReport({
      deviceIds,
      from: ranges.prevFrom,
      to: ranges.prevTo,
      type: 'summary',
    }),
    enabled: deviceIds.length > 0,
  });

  const stats = useMemo(() => {
    if (!currentSummary || currentSummary.length === 0) {
      return null;
    }

    const totalDistanceM = currentSummary.reduce((s: number, r: any) => s + (r.distance || 0), 0);
    const totalDistanceKm = totalDistanceM / 1000;

    const speeds = currentSummary.filter((r: any) => r.averageSpeed > 0);
    const avgSpeedKnots = speeds.length > 0
      ? speeds.reduce((s: number, r: any) => s + r.averageSpeed, 0) / speeds.length
      : 0;
    const avgSpeedKmh = avgSpeedKnots * 1.852;

    const maxSpeedKnots = Math.max(...currentSummary.map((r: any) => r.maxSpeed || 0));
    const maxSpeedKmh = maxSpeedKnots * 1.852;

    const totalEngineMs = currentSummary.reduce((s: number, r: any) => s + (r.engineHours || 0), 0);
    const totalEngineHours = totalEngineMs / 3600000;

    const totalFuel = currentSummary.reduce((s: number, r: any) => s + (r.spentFuel || 0), 0);
    const fuelEfficiency = totalFuel > 0 ? totalDistanceKm / totalFuel : 0;

    const devicesWithData = currentSummary.filter((r: any) => r.distance > 0).length;

    // Previous period for trend comparison
    let distanceChange = 0;
    let fuelChange = 0;
    let engineChange = 0;

    if (prevSummary && prevSummary.length > 0) {
      const prevDistanceM = prevSummary.reduce((s: number, r: any) => s + (r.distance || 0), 0);
      distanceChange = calcChange(totalDistanceM, prevDistanceM);

      const prevFuel = prevSummary.reduce((s: number, r: any) => s + (r.spentFuel || 0), 0);
      fuelChange = calcChange(totalFuel, prevFuel);

      const prevEngineMs = prevSummary.reduce((s: number, r: any) => s + (r.engineHours || 0), 0);
      engineChange = calcChange(totalEngineMs, prevEngineMs);
    }

    return {
      totalDistanceKm,
      avgSpeedKmh,
      maxSpeedKmh,
      totalEngineHours,
      totalFuel,
      fuelEfficiency,
      devicesWithData,
      totalDevices: currentSummary.length,
      distanceChange,
      fuelChange,
      engineChange,
    };
  }, [currentSummary, prevSummary]);

  const isLoading = loadingCurrent || loadingPrev;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estatísticas Avançadas"
        description="Análise detalhada de performance e uso da frota"
        icon={BarChart3}
      />

      {/* Period Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Período:</label>
            <div className="flex gap-2">
              {(['day', 'week', 'month'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedPeriod === period
                      ? 'bg-blue-600 text-white'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {period === 'day' ? 'Hoje' : period === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {errorCurrent && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Erro ao carregar estatísticas. Verifique a conexão com o servidor.</span>
          </CardContent>
        </Card>
      )}

      {isLoading && !stats && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !stats && !errorCurrent && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Nenhum dado encontrado para o período selecionado.
          </CardContent>
        </Card>
      )}

      {stats && (
        <>
          {/* Main Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Distância Total</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDistanceKm.toFixed(1)} km</div>
                <TrendIndicator value={stats.distanceChange} label="vs período anterior" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Veículos com Dados</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.devicesWithData} / {stats.totalDevices}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  dispositivos com atividade no período
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Combustível Gasto</CardTitle>
                <Fuel className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalFuel.toFixed(1)} L</div>
                <TrendIndicator value={stats.fuelChange} label="vs período anterior" invertColor />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Horas de Motor</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEngineHours.toFixed(1)} h</div>
                <TrendIndicator value={stats.engineChange} label="vs período anterior" />
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Métricas Detalhadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Velocidade Média</p>
                  </div>
                  <p className="text-2xl font-bold">{stats.avgSpeedKmh.toFixed(1)} km/h</p>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Velocidade Máxima</p>
                  </div>
                  <p className="text-2xl font-bold">{stats.maxSpeedKmh.toFixed(1)} km/h</p>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Fuel className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Eficiência</p>
                  </div>
                  <p className="text-2xl font-bold">{stats.fuelEfficiency.toFixed(1)} km/L</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function TrendIndicator({ value, label, invertColor }: { value: number; label: string; invertColor?: boolean }) {
  if (value === 0) {
    return (
      <p className="text-xs text-muted-foreground mt-1">Sem dados do período anterior</p>
    );
  }

  const isPositive = value > 0;
  // For fuel, lower is better (invertColor), so positive change = red, negative = green
  const isGood = invertColor ? !isPositive : isPositive;

  return (
    <div className="flex items-center text-xs mt-1">
      {isPositive ? (
        <TrendingUp className={`h-3 w-3 mr-1 ${isGood ? 'text-green-500' : 'text-red-500'}`} />
      ) : (
        <TrendingDown className={`h-3 w-3 mr-1 ${isGood ? 'text-green-500' : 'text-red-500'}`} />
      )}
      <span className={isGood ? 'text-green-500' : 'text-red-500'}>
        {Math.abs(value).toFixed(1)}%
      </span>
      <span className="text-muted-foreground ml-1">{label}</span>
    </div>
  );
}
