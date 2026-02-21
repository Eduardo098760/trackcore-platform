'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ReportType, ReportFilter, TripReport, StopReport } from '@/types';
import { generateTripReport, generateStopReport, generateEventReport, generateSummaryReport, exportReportPDF, exportReportExcel } from '@/lib/api/reports';
import { getDevices } from '@/lib/api/devices';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Download, Calendar as CalendarIcon, MapPin, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState<ReportType>('trips');
  const [selectedDevices, setSelectedDevices] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(new Date(Date.now() - 24 * 60 * 60 * 1000)); // Último dia
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const { data: devices = [], isLoading: isLoadingDevices, error: devicesError, refetch: refetchDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      console.log('[ReportsPage] Carregando veículos...');
      const result = await getDevices();
      console.log('[ReportsPage] Veículos carregados:', result?.length || 0);
      return result;
    },
    retry: 3,
    retryDelay: 1000,
    staleTime: 60000, // 1 minuto
    gcTime: 300000, // 5 minutos
  });

  // Auto-selecionar primeiro veículo quando carregar
  useEffect(() => {
    if (devices.length > 0 && selectedDevices.length === 0) {
      setSelectedDevices([devices[0].id]);
      console.log('[ReportsPage] Auto-selecionado veículo:', devices[0].name);
    }
  }, [devices, selectedDevices.length]);

  const handleRefreshDevices = async () => {
    try {
      await refetchDevices();
      toast.success('Veículos recarregados!');
    } catch (error) {
      toast.error('Erro ao recarregar veículos');
    }
  };

  const handleGenerateReport = async () => {
    if (selectedDevices.length === 0) {
      toast.error('Selecione pelo menos um veículo');
      return;
    }

    console.log('[handleGenerateReport] Iniciando geração do relatório...');
    console.log('[handleGenerateReport] Tipo:', reportType);
    console.log('[handleGenerateReport] Devices:', selectedDevices);
    console.log('[handleGenerateReport] Período:', { from: dateFrom.toISOString(), to: dateTo.toISOString() });

    setIsGenerating(true);
    setReportData(null);

    const filter: ReportFilter = {
      deviceIds: selectedDevices,
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
      type: reportType,
    };

    console.log('[handleGenerateReport] Filter:', JSON.stringify(filter, null, 2));

    try {
      let data;
      if (reportType === 'trips') {
        console.log('[handleGenerateReport] Chamando generateTripReport...');
        data = await generateTripReport(filter);
        console.log('[handleGenerateReport] Dados recebidos:', data);
      } else if (reportType === 'stops') {
        console.log('[handleGenerateReport] Chamando generateStopReport...');
        data = await generateStopReport(filter);
        console.log('[handleGenerateReport] Dados recebidos:', data);
      } else if (reportType === 'events') {
        data = await generateEventReport(filter);
      } else if (reportType === 'summary') {
        data = await generateSummaryReport(filter);
      }
      console.log('[handleGenerateReport] Data final:', data);
      
      if (!data || (Array.isArray(data) && data.length === 0)) {
        toast.warning('Nenhum dado encontrado para o período selecionado');
        setReportData(null);
      } else if (Array.isArray(data) && data[0] && data[0].trips && data[0].trips.length === 0) {
        toast.warning('Nenhuma viagem encontrada para o período selecionado. Tente um período diferente.');
        setReportData(data); // Ainda mostra o card mas sem viagens
      } else {
        setReportData(data);
        toast.success('Relatório gerado com sucesso!');
      }
    } catch (error: any) {
      console.error('[handleGenerateReport] Erro ao gerar relatório:', error);
      console.error('[handleGenerateReport] Stack:', error.stack);
      toast.error('Erro ao gerar relatório: ' + (error.message || 'Erro desconhecido'));
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
      a.download = `relatorio-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.html`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Relatório exportado! Abra o arquivo e use Ctrl+P para salvar como PDF.');
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
      window.URL.revokeObjectURL(url);
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

  const safeParseDate = (v: any): Date | null => {
    if (v == null) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === 'string') {
      const n = Number(v);
      if (!Number.isNaN(n)) {
        const d = new Date(n);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Gere relatórios detalhados de viagens, paradas e eventos
          </p>
        </div>
        {isLoadingDevices && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando veículos...
          </div>
        )}
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
              <Label>Veículo</Label>
              <Select
                value={selectedDevices[0]?.toString() || ''}
                onValueChange={(value) => setSelectedDevices([parseInt(value)])}
                disabled={isLoadingDevices || devices.length === 0}
              >
                <SelectTrigger>
                  <SelectValue>
                    {isLoadingDevices ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Carregando...
                      </span>
                    ) : selectedDevices[0] ? (
                      devices.find(d => d.id === selectedDevices[0])?.name
                    ) : (
                      'Selecione um veículo'
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {devices.length > 0 ? (
                    devices.map((device) => (
                      <SelectItem key={device.id} value={device.id.toString()}>
                        {device.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      {isLoadingDevices ? 'Carregando...' : 'Nenhum veículo disponível'}
                    </div>
                  )}
                </SelectContent>
              </Select>
              {devicesError && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-red-500">
                    Erro ao carregar veículos.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleRefreshDevices}
                    className="h-auto p-0 text-xs"
                  >
                    Tentar novamente
                  </Button>
                </div>
              )}
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
            <Button 
              onClick={handleGenerateReport} 
              disabled={isGenerating || selectedDevices.length === 0} 
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando Relatório...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar Relatório
                </>
              )}
            </Button>
            {reportData && (
              <>
                <Button variant="secondary" onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
                <Button variant="secondary" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {reportData && reportType === 'trips' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Relatório de Viagens</CardTitle>
            <p className="text-sm text-muted-foreground">
              Período: {format(dateFrom, 'dd/MM/yyyy', { locale: ptBR })} até {format(dateTo, 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {!reportData || (reportData as TripReport[]).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">Nenhum dado retornado pela API</p>
                <p className="text-sm text-muted-foreground mt-2">Verifique o console para mais detalhes</p>
              </div>
            ) : (
              (reportData as TripReport[]).map((deviceReport) => (
              <div key={deviceReport.deviceId} className="space-y-4">
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold mb-3">{deviceReport.deviceName}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Total de Viagens</p>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{deviceReport.trips?.length ?? 0}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Distância Total</p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">{(deviceReport.totalDistance / 1000).toFixed(1)} km</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Velocidade Média</p>
                      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{deviceReport.averageSpeed.toFixed(0)} km/h</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Detalhes das Viagens</h4>
                  <div className="mb-2 text-xs text-muted-foreground">
                    Total de trips neste device: {deviceReport.trips?.length || 0}
                  </div>
                  {!deviceReport.trips || deviceReport.trips.length === 0 ? (
                    <div className="text-center py-8 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
                      <p className="text-muted-foreground">
                        ⚠️ Nenhuma viagem registrada no período selecionado
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Tente selecionar um período diferente ou verifique se o veículo teve movimentação
                      </p>
                    </div>
                  ) : (
                    deviceReport.trips.map((trip) => (
                    <div
                      key={trip.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <div className="mt-1">
                          <MapPin className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold mb-1">
                            {(() => {
                              const sd = safeParseDate(trip.startTime);
                              return sd ? format(sd, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data inválida';
                            })()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/70">De:</span> {trip.startAddress}
                          </p>
                          {trip.endAddress && trip.endAddress !== trip.startAddress && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium text-foreground/70">Para:</span> {trip.endAddress}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">Distância</p>
                          <p className="font-semibold">{((trip.distance || 0) / 1000).toFixed(1)} km</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">Duração</p>
                          <p className="font-semibold">{formatDuration(Number(trip.duration) || 0)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">Vel. Máx.</p>
                          <p className="font-semibold">{(Number(trip.maxSpeed) || 0).toFixed(0)} km/h</p>
                        </div>
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </div>
            ))
            )}
          </CardContent>
        </Card>
      )}


      {reportData && reportType === 'stops' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Relatório de Paradas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Período: {format(dateFrom, 'dd/MM/yyyy', { locale: ptBR })} até {format(dateTo, 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {(reportData as StopReport[]).map((deviceReport) => (
              <div key={deviceReport.deviceId} className="space-y-4">
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold mb-3">{deviceReport.deviceName}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Total de Paradas</p>
                      <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{deviceReport.totalStops}</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Tempo Total Parado</p>
                      <p className="text-3xl font-bold text-red-600 dark:text-red-400">{formatDuration(deviceReport.totalDuration)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Detalhes das Paradas</h4>
                  {(deviceReport.stops ?? []).map((stop) => (
                    <div
                      key={stop.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <div className="mt-1">
                          <Clock className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold mb-1">
                            {format(new Date(stop.startTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {stop.address}
                          </p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Duração</p>
                        <p className="font-semibold">{formatDuration(stop.duration)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {reportData && reportType === 'events' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Relatório de Eventos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Período: {format(dateFrom, 'dd/MM/yyyy', { locale: ptBR })} até {format(dateTo, 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </CardHeader>
          <CardContent>
            {(reportData as any[]).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">Nenhum evento encontrado no período selecionado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(reportData as any[]).map((event: any) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1">
                        <Clock className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold mb-1">{event.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const d = safeParseDate(event.serverTime);
                            return d ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data inválida';
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      Device #{event.deviceId}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {reportData && reportType === 'summary' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Resumo por Veículo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Período: {format(dateFrom, 'dd/MM/yyyy', { locale: ptBR })} até {format(dateTo, 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {(reportData as any[]).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">Nenhum dado encontrado no período selecionado</p>
              </div>
            ) : (
              (reportData as any[]).map((item: any) => (
                <div key={item.deviceId} className="border rounded-lg p-4 space-y-3">
                  <h3 className="text-lg font-semibold">{item.deviceName}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Distância</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{((item.distance || 0) / 1000).toFixed(1)} km</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Vel. Média</p>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">{(item.averageSpeed || 0).toFixed(0)} km/h</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Vel. Máxima</p>
                      <p className="text-xl font-bold text-red-600 dark:text-red-400">{(item.maxSpeed || 0).toFixed(0)} km/h</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Horas Motor</p>
                      <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{(item.engineHours || 0).toFixed(1)} h</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Combustível</p>
                      <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{(item.spentFuel || 0).toFixed(1)} L</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
