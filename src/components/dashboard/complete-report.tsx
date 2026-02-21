'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportFilter } from '@/types';
import { generateTripReport, generateStopReport, generateEventReport, generateSummaryReport } from '@/lib/api/reports';
import { getDevices } from '@/lib/api/devices';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Calendar as CalendarIcon, MapPin, Clock, Loader2, Activity, TrendingUp, AlertTriangle, Gauge } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function CompleteReportView() {
  const [selectedDevices, setSelectedDevices] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [tripsData, setTripsData] = useState<any>(null);
  const [stopsData, setStopsData] = useState<any>(null);
  const [eventsData, setEventsData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);

  const { data: devices = [], isLoading: isLoadingDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    retry: 3,
  });

  useEffect(() => {
    if (devices.length > 0 && selectedDevices.length === 0) {
      setSelectedDevices([devices[0].id]);
    }
  }, [devices, selectedDevices.length]);

  const handleGenerateCompleteReport = async () => {
    if (selectedDevices.length === 0) {
      toast.error('Selecione pelo menos um veículo');
      return;
    }

    setIsGenerating(true);
    const filter: ReportFilter = {
      deviceIds: selectedDevices,
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
      type: 'trips',
    };

    try {
      const [trips, stops, events, summary] = await Promise.all([
        generateTripReport(filter).catch(() => []),
        generateStopReport(filter).catch(() => []),
        generateEventReport(filter).catch(() => []),
        generateSummaryReport(filter).catch(() => []),
      ]);

      setTripsData(trips);
      setStopsData(stops);
      setEventsData(events);
      setSummaryData(summary);
      
      toast.success('Relatório completo gerado!');
    } catch (error) {
      toast.error('Erro ao gerar relatório');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const prepareChartData = () => {
    if (!tripsData || tripsData.length === 0) return [];
    
    const device = tripsData[0];
    return device.trips.map((trip: any, index: number) => ({
      name: `Viagem ${index + 1}`,
      distancia: (trip.distance / 1000).toFixed(1),
      velocidade: trip.maxSpeed.toFixed(0),
      duracao: trip.duration / 60, // em minutos
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Relatório Completo do Veículo</h1>
        <p className="text-muted-foreground">
          Histórico detalhado com viagens, paradas, eventos e estatísticas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>Veículo</Label>
              <Select
                value={selectedDevices[0]?.toString() || ''}
                onValueChange={(value) => setSelectedDevices([parseInt(value)])}
                disabled={isLoadingDevices || devices.length === 0}
              >
                <SelectTrigger>
                  <SelectValue>
                    {isLoadingDevices ? 'Carregando...' : selectedDevices[0] ? devices.find(d => d.id === selectedDevices[0])?.name : 'Selecione'}
                  </SelectValue>
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
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, 'PPP', { locale: ptBR })}
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
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, 'PPP', { locale: ptBR })}
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

          <Button onClick={handleGenerateCompleteReport} disabled={isGenerating} size="lg" className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando Relatório Completo...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Gerar Relatório Completo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {(tripsData || stopsData || eventsData || summaryData) && (
        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="resumo">
              <Activity className="h-4 w-4 mr-2" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="viagens">
              <MapPin className="h-4 w-4 mr-2" />
              Viagens
            </TabsTrigger>
            <TabsTrigger value="paradas">
              <Clock className="h-4 w-4 mr-2" />
              Paradas
            </TabsTrigger>
            <TabsTrigger value="eventos">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Eventos
            </TabsTrigger>
            <TabsTrigger value="graficos">
              <TrendingUp className="h-4 w-4 mr-2" />
              Gráficos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-4 mt-4">
            {summaryData && summaryData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Distância Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{(summaryData[0].distance / 1000).toFixed(1)} km</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Velocidade Média</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{summaryData[0].averageSpeed.toFixed(0)} km/h</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Velocidade Máxima</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{summaryData[0].maxSpeed.toFixed(0)} km/h</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Horas de Motor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{formatDuration(summaryData[0].engineHours)}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {tripsData && tripsData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Estatísticas de Viagens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{tripsData[0].trips.length}</p>
                      <p className="text-sm text-muted-foreground">Total de Viagens</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{(tripsData[0].totalDistance / 1000).toFixed(1)} km</p>
                      <p className="text-sm text-muted-foreground">Distância Percorrida</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">{formatDuration(tripsData[0].totalDuration)}</p>
                      <p className="text-sm text-muted-foreground">Tempo em Movimento</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {stopsData && stopsData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Estatísticas de Paradas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{stopsData[0].totalStops}</p>
                      <p className="text-sm text-muted-foreground">Total de Paradas</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{formatDuration(stopsData[0].totalDuration)}</p>
                      <p className="text-sm text-muted-foreground">Tempo Parado</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="viagens" className="space-y-4 mt-4">
            {tripsData && tripsData.length > 0 && tripsData[0].trips.map((trip: any) => (
              <Card key={trip.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <MapPin className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-lg">
                            {format(new Date(trip.startTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <p className="text-sm text-muted-foreground">{trip.startAddress}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Término</p>
                          <p className="text-sm font-medium">
                            {format(new Date(trip.endTime), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Distância</p>
                          <p className="text-lg font-bold text-green-600">{(trip.distance / 1000).toFixed(1)} km</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Duração</p>
                          <p className="text-lg font-bold">{formatDuration(trip.duration)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Vel. Máx.</p>
                          <p className="text-lg font-bold text-red-600">{trip.maxSpeed.toFixed(0)} km/h</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Vel. Média</p>
                          <p className="text-lg font-bold text-blue-600">{trip.averageSpeed.toFixed(0)} km/h</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!tripsData || tripsData.length === 0 || tripsData[0].trips.length === 0) && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">Nenhuma viagem registrada no período</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="paradas" className="space-y-4 mt-4">
            {stopsData && stopsData.length > 0 && stopsData[0].stops.map((stop: any) => (
              <Card key={stop.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <Clock className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-lg">
                            {format(new Date(stop.startTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <p className="text-sm text-muted-foreground">{stop.address}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Término</p>
                          <p className="text-sm font-medium">
                            {format(new Date(stop.endTime), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground">Duração da Parada</p>
                        <p className="text-2xl font-bold text-red-600">{formatDuration(stop.duration)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!stopsData || stopsData.length === 0 || stopsData[0].stops.length === 0) && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">Nenhuma parada registrada no período</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="eventos" className="space-y-4 mt-4">
            {eventsData && eventsData.length > 0 ? (
              eventsData.map((event: any, index: number) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <div className="flex-1">
                        <p className="font-semibold">{event.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(event.serverTime), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </p>
                        {event.attributes && Object.keys(event.attributes).length > 0 && (
                          <div className="mt-2 text-sm">
                            {JSON.stringify(event.attributes)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">Nenhum evento registrado no período</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="graficos" className="space-y-4 mt-4">
            {tripsData && tripsData.length > 0 && tripsData[0].trips.length > 0 && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Distância por Viagem (km)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="distancia" fill="#3b82f6" name="Distância (km)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Velocidade Máxima por Viagem (km/h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={prepareChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="velocidade" stroke="#ef4444" name="Velocidade (km/h)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
            {(!tripsData || tripsData.length === 0 || tripsData[0].trips.length === 0) && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">Dados insuficientes para gerar gráficos</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
