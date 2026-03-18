"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Gauge,
  Thermometer,
  Fuel,
  Activity,
  AlertTriangle,
  Clock,
  Zap,
  Loader2,
} from "lucide-react";
import { getDevices, getPositionByDevice } from "@/lib/api";

function extractOBD(attrs: Record<string, any>) {
  return {
    rpm: attrs.rpm ?? attrs.obdRpm ?? null,
    speed: attrs.obdSpeed ?? null,
    fuelLevel: attrs.fuelLevel ?? attrs.fuel ?? null,
    coolantTemp: attrs.coolantTemp ?? attrs.coolantTemperature ?? null,
    engineLoad: attrs.engineLoad ?? null,
    throttlePosition: attrs.throttlePosition ?? attrs.throttle ?? null,
    batteryVoltage: attrs.power ?? attrs.batteryVoltage ?? null,
    batteryLevel: attrs.batteryLevel ?? null,
    engineHours: attrs.hours ?? attrs.engineHours ?? null,
    dtcCodes: attrs.dtcs ? String(attrs.dtcs).split(",").filter(Boolean) : [],
    ignition: attrs.ignition ?? null,
    totalDistance: attrs.totalDistance ?? attrs.odometer ?? null,
    sat: attrs.sat ?? null,
  };
}

export default function OBDPage() {
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);

  const { data: devices, isLoading: loadingDevices } = useQuery({
    queryKey: ["devices"],
    queryFn: getDevices,
  });

  // Auto-select first device
  const activeDeviceId = selectedDevice ?? devices?.[0]?.id ?? null;

  const { data: position, isLoading: loadingPosition } = useQuery({
    queryKey: ["obd-position", activeDeviceId],
    queryFn: () => getPositionByDevice(activeDeviceId!),
    enabled: !!activeDeviceId,
    refetchInterval: 5000,
  });

  const obd = position ? extractOBD(position.attributes as Record<string, any>) : null;
  const speedKmh = position ? position.speed : null;

  const activeDevice = devices?.find((d) => d.id === activeDeviceId);

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const getGaugeColor = (value: number, max: number, warningThreshold: number) => {
    const percentage = (value / max) * 100;
    if (percentage >= warningThreshold) return "text-red-500";
    if (percentage >= warningThreshold * 0.8) return "text-yellow-500";
    return "text-green-500";
  };

  const hasAnyOBD = obd && (
    obd.rpm !== null || obd.fuelLevel !== null || obd.coolantTemp !== null ||
    obd.engineLoad !== null || obd.throttlePosition !== null
  );

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
            {loadingDevices ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <select
                value={activeDeviceId ?? ""}
                onChange={(e) => setSelectedDevice(Number(e.target.value))}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {devices?.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}{device.plate ? ` - ${device.plate}` : ""}
                  </option>
                ))}
              </select>
            )}
            {activeDevice && (
              <Badge variant={activeDevice.status === "online" ? "default" : "secondary"}>
                {activeDevice.status === "online" ? "Online" : activeDevice.status}
              </Badge>
            )}
            {obd && obd.dtcCodes.length > 0 && (
              <Badge variant="destructive" className="ml-auto">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {obd.dtcCodes.length} Códigos de Erro
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {loadingPosition && !position && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {position && !hasAnyOBD && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>Este dispositivo não reporta dados OBD-II.</p>
            <p className="text-sm mt-1">Dados básicos de posição e velocidade estão disponíveis abaixo.</p>
          </CardContent>
        </Card>
      )}

      {position && (
        <>
          {/* Main Gauges */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* RPM */}
            {obd != null && obd.rpm != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Rotação do Motor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center">
                    <div className={`text-4xl font-bold ${getGaugeColor(obd.rpm!, 6000, 83)}`}>
                      {Math.round(obd.rpm!)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">RPM</p>
                    <ProgressBar value={obd.rpm!} max={6000} thresholds={[4000, 5000]} />
                  </div>
                </CardContent>
              </Card>
            )}

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
                  <div className={`text-4xl font-bold ${getGaugeColor(obd?.speed ?? speedKmh ?? 0, 120, 83)}`}>
                    {Math.round(obd?.speed ?? speedKmh ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">km/h</p>
                  <ProgressBar value={obd?.speed ?? speedKmh ?? 0} max={180} thresholds={[100, 120]} />
                </div>
              </CardContent>
            </Card>

            {/* Fuel Level */}
            {obd != null && obd.fuelLevel != null && (
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
                      obd.fuelLevel! < 20 ? "text-red-500" : obd.fuelLevel! < 40 ? "text-yellow-500" : "text-green-500"
                    }`}>
                      {Math.round(obd.fuelLevel!)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Tanque</p>
                    <ProgressBar
                      value={obd.fuelLevel!}
                      max={100}
                      thresholds={[20, 40]}
                      colorFn={(v) => v < 20 ? "bg-red-500" : v < 40 ? "bg-yellow-500" : "bg-green-500"}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Coolant Temperature */}
            {obd != null && obd.coolantTemp != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Thermometer className="h-4 w-4" />
                    Temperatura do Motor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center">
                    <div className={`text-4xl font-bold ${getGaugeColor(obd.coolantTemp!, 120, 83)}`}>
                      {Math.round(obd.coolantTemp!)}°
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Celsius</p>
                    <ProgressBar value={obd.coolantTemp!} max={120} thresholds={[90, 100]} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Additional Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {obd != null && obd.engineLoad != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Carga do Motor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.round(obd.engineLoad!)}%</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(obd.engineLoad!, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {obd != null && obd.throttlePosition != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Posição do Acelerador</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.round(obd.throttlePosition!)}%</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                    <div
                      className="h-1.5 rounded-full bg-green-500 transition-all"
                      style={{ width: `${Math.min(obd.throttlePosition!, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {obd != null && obd.batteryVoltage != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Voltagem da Bateria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{obd.batteryVoltage!.toFixed(1)}V</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {obd.batteryVoltage! < 12 ? "Baixa" : obd.batteryVoltage! > 14.5 ? "Alta" : "Normal"}
                  </p>
                </CardContent>
              </Card>
            )}

            {obd != null && obd.engineHours != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Horas de Motor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatTime(obd.engineHours!)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Motor ligado (acumulado)</p>
                </CardContent>
              </Card>
            )}

            {obd != null && obd.totalDistance != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Odômetro</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(obd.totalDistance! / 1000).toFixed(1)} km
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Distância total percorrida</p>
                </CardContent>
              </Card>
            )}

            {obd != null && obd.sat != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Satélites GPS</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{obd.sat}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {obd.sat! >= 8 ? "Sinal excelente" : obd.sat! >= 4 ? "Sinal bom" : "Sinal fraco"}
                  </p>
                </CardContent>
              </Card>
            )}

            {obd != null && obd.ignition != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Ignição</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${obd.ignition ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-2xl font-bold">{obd.ignition ? "Ligada" : "Desligada"}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* DTC Codes */}
          {obd && obd.dtcCodes.length > 0 && (
            <Card className="border-red-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                  Códigos de Diagnóstico (DTC)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {obd.dtcCodes.map((code, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg"
                    >
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

          {/* Last update info */}
          <p className="text-xs text-muted-foreground text-center">
            Última atualização: {new Date(position.deviceTime).toLocaleString("pt-BR")}
            {" · "}Atualização automática a cada 5s
          </p>
        </>
      )}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  thresholds,
  colorFn,
}: {
  value: number;
  max: number;
  thresholds: [number, number];
  colorFn?: (v: number) => string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const color = colorFn
    ? colorFn(value)
    : value > thresholds[1]
      ? "bg-red-500"
      : value > thresholds[0]
        ? "bg-yellow-500"
        : "bg-blue-500";

  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
