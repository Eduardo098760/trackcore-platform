'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportType, ReportFilter, TripReport, StopReport } from '@/types';
import { generateTripReport, generateStopReport, exportReportPDF, exportReportExcel } from '@/lib/api/reports';
import { getDevices } from '@/lib/api/devices';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Download, Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('trips');
  const [selectedDevices, setSelectedDevices] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const handleGenerateReport = async () => {
    if (selectedDevices.length === 0) {
      toast.error('Selecione pelo menos um veículo');
      return;
    }

    setIsGenerating(true);
    setReportData(null);

    const filter: ReportFilter = {
      deviceIds: selectedDevices,
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
      type: reportType,
    };

    try {
      let data;
      if (reportType === 'trips') {
        data = await generateTripReport(filter);
      } else if (reportType === 'stops') {
        data = await generateStopReport(filter);
      }
      setReportData(data);
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar relatório');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    const filter: ReportFilter = {
      deviceIds: selectedDevices,
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
      type: reportType,
    };

    try {
      const blob = await exportReportPDF(reportType, filter);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      a.click();
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar PDF');
    }
  };

  const handleExportExcel = async () => {
    const filter: ReportFilter = {
      deviceIds: selectedDevices,
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
      type: reportType,
    };

    try {
      const blob = await exportReportExcel(reportType, filter);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      a.click();
      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar Excel');
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Gere relatórios detalhados de viagens, paradas e eventos
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={(value: ReportType) => setReportType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trips">Viagens</SelectItem>
                  <SelectItem value="stops">Paradas</SelectItem>
                  <SelectItem value="events">Eventos</SelectItem>
                  <SelectItem value="summary">Resumo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Veículos</Label>
              <Select
                value={selectedDevices[0]?.toString()}
                onValueChange={(value) => setSelectedDevices([parseInt(value)])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um veículo" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dateFrom && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'PPP', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && setDateFrom(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dateTo && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'PPP', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && setDateTo(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerateReport} disabled={isGenerating}>
              <FileText className="h-4 w-4 mr-2" />
              {isGenerating ? 'Gerando...' : 'Gerar Relatório'}
            </Button>
            {reportData && (
              <>
                <Button variant="outline" onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
                <Button variant="outline" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {reportData && reportType === 'trips' && (
        <div className="space-y-4">
          {(reportData as TripReport[]).map((deviceReport) => (
            <Card key={deviceReport.deviceId}>
              <CardHeader>
                <CardTitle>{deviceReport.deviceName}</CardTitle>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total de Viagens</p>
                    <p className="text-2xl font-bold">{deviceReport.trips.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Distância Total</p>
                    <p className="text-2xl font-bold">{(deviceReport.totalDistance / 1000).toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Velocidade Média</p>
                    <p className="text-2xl font-bold">{deviceReport.averageSpeed.toFixed(0)} km/h</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deviceReport.trips.map((trip) => (
                    <div
                      key={trip.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(trip.startTime), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {trip.startAddress || 'Endereço não disponível'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <p className="text-muted-foreground">Distância</p>
                          <p className="font-medium">{(trip.distance / 1000).toFixed(1)} km</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Duração</p>
                          <p className="font-medium">{formatDuration(trip.duration)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Vel. Máx.</p>
                          <p className="font-medium">{trip.maxSpeed.toFixed(0)} km/h</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reportData && reportType === 'stops' && (
        <div className="space-y-4">
          {(reportData as StopReport[]).map((deviceReport) => (
            <Card key={deviceReport.deviceId}>
              <CardHeader>
                <CardTitle>{deviceReport.deviceName}</CardTitle>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total de Paradas</p>
                    <p className="text-2xl font-bold">{deviceReport.totalStops}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tempo Total Parado</p>
                    <p className="text-2xl font-bold">{formatDuration(deviceReport.totalDuration)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deviceReport.stops.map((stop) => (
                    <div
                      key={stop.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(stop.startTime), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {stop.address || 'Endereço não disponível'}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm">
                        <p className="text-muted-foreground">Duração</p>
                        <p className="font-medium">{formatDuration(stop.duration)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
