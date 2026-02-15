'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { 
  Gauge, 
  Thermometer, 
  Fuel, 
  Activity, 
  AlertTriangle, 
  Clock,
  Zap,
  Wind
} from 'lucide-react';
import type { OBDData, Device } from '@/types';

// Mock devices
const mockDevices: Device[] = [
  { id: 1, name: 'Fiat Toro', plate: 'ABC-1234', status: 'online' as const, lastUpdate: new Date(), position: { lat: 0, lng: 0, speed: 65, course: 180 } },
  { id: 2, name: 'VW Gol', plate: 'XYZ-5678', status: 'online' as const, lastUpdate: new Date(), position: { lat: 0, lng: 0, speed: 45, course: 90 } }
];

export default function OBDPage() {
  const [selectedDevice, setSelectedDevice] = useState<number>(1);
  const [obdData, setObdData] = useState<OBDData>({
    deviceId: 1,
    timestamp: new Date().toISOString(),
    rpm: 2450,
    speed: 65,
    fuelLevel: 75,
    coolantTemp: 88,
    engineLoad: 42,
    throttlePosition: 35,
    intakeAirTemp: 32,
    mafRate: 15.8,
    batteryVoltage: 13.8,
    dtcCount: 0,
    dtcCodes: [],
    fuelRate: 8.2,
    engineRunTime: 3600 * 2.5 // 2.5 hours
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setObdData(prev => ({
        ...prev,
        rpm: Math.max(800, Math.min(6000, prev.rpm + (Math.random() - 0.5) * 200)),
        speed: Math.max(0, Math.min(120, prev.speed + (Math.random() - 0.5) * 5)),
        fuelLevel: Math.max(0, Math.min(100, prev.fuelLevel - Math.random() * 0.1)),
        coolantTemp: Math.max(70, Math.min(110, prev.coolantTemp + (Math.random() - 0.5) * 2)),
        engineLoad: Math.max(0, Math.min(100, prev.engineLoad + (Math.random() - 0.5) * 5)),
        throttlePosition: Math.max(0, Math.min(100, prev.throttlePosition + (Math.random() - 0.5) * 10)),
        timestamp: new Date().toISOString()
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getGaugeColor = (value: number, max: number, warningThreshold: number) => {
    const percentage = (value / max) * 100;
    if (percentage >= warningThreshold) return 'text-red-500';
    if (percentage >= warningThreshold * 0.8) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Computador de Bordo"
        description="Monitoramento OBD-II em tempo real"
        icon={Gauge}
      />

      {/* Device Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Selecionar Veículo:</label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(Number(e.target.value))}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {mockDevices.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name} - {device.plate}
                </option>
              ))}
            </select>
            {obdData.dtcCount > 0 && (
              <Badge variant="destructive" className="ml-auto">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {obdData.dtcCount} Códigos de Erro
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Gauges */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* RPM */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Rotação do Motor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className={`text-4xl font-bold ${getGaugeColor(obdData.rpm, 6000, 5000)}`}>
                {Math.round(obdData.rpm)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">RPM</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    obdData.rpm > 5000 ? 'bg-red-500' : 
                    obdData.rpm > 4000 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((obdData.rpm / 6000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Speed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Velocidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className={`text-4xl font-bold ${getGaugeColor(obdData.speed, 120, 100)}`}>
                {Math.round(obdData.speed)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">km/h</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    obdData.speed > 100 ? 'bg-red-500' : 
                    obdData.speed > 80 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min((obdData.speed / 120) * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fuel Level */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Fuel className="h-4 w-4" />
              Nível de Combustível
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className={`text-4xl font-bold ${
                obdData.fuelLevel < 20 ? 'text-red-500' : 
                obdData.fuelLevel < 40 ? 'text-yellow-500' : 'text-green-500'
              }`}>
                {Math.round(obdData.fuelLevel)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Tanque</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    obdData.fuelLevel < 20 ? 'bg-red-500' : 
                    obdData.fuelLevel < 40 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${obdData.fuelLevel}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coolant Temperature */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Temperatura do Motor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className={`text-4xl font-bold ${getGaugeColor(obdData.coolantTemp, 120, 100)}`}>
                {Math.round(obdData.coolantTemp)}°
              </div>
              <p className="text-xs text-muted-foreground mt-1">Celsius</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    obdData.coolantTemp > 100 ? 'bg-red-500' : 
                    obdData.coolantTemp > 90 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min((obdData.coolantTemp / 120) * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Carga do Motor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(obdData.engineLoad)}%</div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
              <div 
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${obdData.engineLoad}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Posição do Acelerador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(obdData.throttlePosition)}%</div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
              <div 
                className="h-1.5 rounded-full bg-green-500 transition-all"
                style={{ width: `${obdData.throttlePosition}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wind className="h-4 w-4" />
              Temp. do Ar de Admissão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{obdData.intakeAirTemp}°C</div>
            <p className="text-xs text-muted-foreground mt-1">Temperatura</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Fluxo de Ar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{obdData.mafRate} g/s</div>
            <p className="text-xs text-muted-foreground mt-1">MAF Rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Voltagem da Bateria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{obdData.batteryVoltage}V</div>
            <p className="text-xs text-muted-foreground mt-1">
              {obdData.batteryVoltage < 12 ? 'Baixa' : obdData.batteryVoltage > 14.5 ? 'Alta' : 'Normal'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo de Funcionamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(obdData.engineRunTime)}</div>
            <p className="text-xs text-muted-foreground mt-1">Motor ligado</p>
          </CardContent>
        </Card>
      </div>

      {/* Fuel Consumption */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Consumo de Combustível
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Taxa Instantânea</p>
              <p className="text-2xl font-bold">{obdData.fuelRate} L/h</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Consumo Médio</p>
              <p className="text-2xl font-bold">
                {(obdData.speed / (obdData.fuelRate || 1)).toFixed(1)} km/L
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estimativa de Alcance</p>
              <p className="text-2xl font-bold">
                {Math.round((obdData.fuelLevel / 100) * 50 * (obdData.speed / (obdData.fuelRate || 1)))} km
              </p>
              <p className="text-xs text-muted-foreground">Baseado em tanque de 50L</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DTC Codes */}
      {obdData.dtcCodes && obdData.dtcCodes.length > 0 && (
        <Card className="border-red-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Códigos de Diagnóstico (DTC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {obdData.dtcCodes.map((code, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                  <div>
                    <p className="font-mono font-bold text-red-500">{code}</p>
                    <p className="text-sm text-muted-foreground">Verificar manual do fabricante</p>
                  </div>
                  <Badge variant="destructive">Ativo</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
