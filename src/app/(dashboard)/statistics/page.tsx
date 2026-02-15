'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { BarChart3, TrendingUp, TrendingDown, Activity, Fuel, Clock } from 'lucide-react';

export default function StatisticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');

  // Mock statistics data
  const stats = {
    totalDistance: 2450,
    totalTrips: 45,
    averageSpeed: 58,
    maxSpeed: 120,
    totalFuel: 185,
    fuelEfficiency: 13.2,
    idleTime: 2.5,
    engineHours: 38.5,
    distanceChange: 12.5,
    tripsChange: 8.3,
    fuelChange: -5.2
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estatísticas Avançadas"
        description="Análise detalhada de performance e uso"
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
          </div>
        </CardContent>
      </Card>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distância Total</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDistance} km</div>
            <div className="flex items-center text-xs mt-1">
              {stats.distanceChange > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={stats.distanceChange > 0 ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(stats.distanceChange)}%
              </span>
              <span className="text-muted-foreground ml-1">vs período anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Viagens</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTrips}</div>
            <div className="flex items-center text-xs mt-1">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-500">{stats.tripsChange}%</span>
              <span className="text-muted-foreground ml-1">vs período anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Combustível Gasto</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFuel}L</div>
            <div className="flex items-center text-xs mt-1">
              <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-500">{Math.abs(stats.fuelChange)}%</span>
              <span className="text-muted-foreground ml-1">economia</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas de Motor</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.engineHours}h</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.idleTime}h em ralenti ({Math.round((stats.idleTime / stats.engineHours) * 100)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distância por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consumo de Combustível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <Fuel className="h-12 w-12 opacity-20" />
            </div>
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
              <p className="text-sm text-muted-foreground">Velocidade Média</p>
              <p className="text-2xl font-bold">{stats.averageSpeed} km/h</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Velocidade Máxima</p>
              <p className="text-2xl font-bold">{stats.maxSpeed} km/h</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Eficiência</p>
              <p className="text-2xl font-bold">{stats.fuelEfficiency} km/L</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
