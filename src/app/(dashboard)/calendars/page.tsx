'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Plus, Edit, Trash2, Search, Clock, CalendarDays, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCalendars,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  TraccarCalendar,
  buildICalData,
  encodeCalendarData,
  decodeCalendarData,
} from '@/lib/api/calendars';

const weekDays = [
  { value: 'MO', label: 'Seg' },
  { value: 'TU', label: 'Ter' },
  { value: 'WE', label: 'Qua' },
  { value: 'TH', label: 'Qui' },
  { value: 'FR', label: 'Sex' },
  { value: 'SA', label: 'Sáb' },
  { value: 'SU', label: 'Dom' },
];

/** Tenta extrair horário e dias do iCal decodificado */
function parseICalFields(icalRaw: string): { startTime: string; endTime: string; days: string[]; description: string } {
  const decoded = icalRaw.includes('BEGIN:VCALENDAR') ? icalRaw : decodeCalendarData(icalRaw);
  let startTime = '08:00';
  let endTime = '18:00';
  let days: string[] = ['MO', 'TU', 'WE', 'TH', 'FR'];

  const dtstart = decoded.match(/DTSTART[^:]*:(\d{8}T(\d{2})(\d{2})\d{2})/);
  if (dtstart) startTime = `${dtstart[2]}:${dtstart[3]}`;

  const dtend = decoded.match(/DTEND[^:]*:(\d{8}T(\d{2})(\d{2})\d{2})/);
  if (dtend) endTime = `${dtend[2]}:${dtend[3]}`;

  const byday = decoded.match(/BYDAY=([A-Z,]+)/);
  if (byday) days = byday[1].split(',');

  return { startTime, endTime, days, description: '' };
}

/** Gera descrição legível a partir dos dados do iCal */
function buildDescription(startTime: string, endTime: string, days: string[]): string {
  const dayLabels = days.map((d) => weekDays.find((w) => w.value === d)?.label).filter(Boolean);
  if (days.length === 7) return `Todos os dias, ${startTime} às ${endTime}`;
  if (days.length === 5 && !days.includes('SA') && !days.includes('SU')) return `Seg a Sex, ${startTime} às ${endTime}`;
  return `${dayLabels.join(', ')}, ${startTime} às ${endTime}`;
}

export default function CalendarsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<TraccarCalendar | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: '08:00',
    endTime: '18:00',
    selectedDays: ['MO', 'TU', 'WE', 'TH', 'FR'],
  });

  // ─── Queries ───────────────────────────────────────────────────────
  const { data: calendars = [], isLoading, error } = useQuery({
    queryKey: ['calendars'],
    queryFn: getCalendars,
    staleTime: 30000,
  });

  // ─── Mutations ─────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: Omit<TraccarCalendar, 'id'>) => createCalendar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
      toast.success('Calendário criado com sucesso!');
      setIsDialogOpen(false);
    },
    onError: (err: any) => toast.error(`Erro ao criar calendário: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TraccarCalendar }) => updateCalendar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
      toast.success('Calendário atualizado com sucesso!');
      setIsDialogOpen(false);
    },
    onError: (err: any) => toast.error(`Erro ao atualizar: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCalendar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
      toast.success('Calendário excluído com sucesso!');
    },
    onError: (err: any) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  // ─── Filtros ───────────────────────────────────────────────────────
  const filteredCalendars = useMemo(
    () => calendars.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [calendars, searchTerm],
  );

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditingCalendar(null);
    setFormData({ name: '', description: '', startTime: '08:00', endTime: '18:00', selectedDays: ['MO', 'TU', 'WE', 'TH', 'FR'] });
    setIsDialogOpen(true);
  };

  const handleEdit = (cal: TraccarCalendar) => {
    setEditingCalendar(cal);
    const parsed = parseICalFields(cal.data);
    setFormData({
      name: cal.name,
      description: cal.attributes?.description as string || '',
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      selectedDays: parsed.days,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (cal: TraccarCalendar) => {
    if (confirm(`Excluir o calendário "${cal.name}"?`)) {
      deleteMutation.mutate(cal.id);
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    if (formData.selectedDays.length === 0) {
      toast.error('Selecione pelo menos um dia.');
      return;
    }

    const ical = buildICalData(formData.startTime, formData.endTime, formData.selectedDays);
    const encodedData = encodeCalendarData(ical);

    if (editingCalendar) {
      updateMutation.mutate({
        id: editingCalendar.id,
        data: {
          id: editingCalendar.id,
          name: formData.name,
          data: encodedData,
          attributes: { ...(editingCalendar.attributes ?? {}), description: formData.description },
        },
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        data: encodedData,
        attributes: { description: formData.description },
      });
    }
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter((d) => d !== day)
        : [...prev.selectedDays, day],
    }));
  };

  /** Descrição legível do calendário a partir do campo data */
  const getCalendarSummary = (cal: TraccarCalendar): string => {
    try {
      const parsed = parseICalFields(cal.data);
      return buildDescription(parsed.startTime, parsed.endTime, parsed.days);
    } catch {
      return cal.attributes?.description as string || 'Calendário personalizado';
    }
  };

  // ─── Render ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Calendários de Trabalho" description="Defina horários de operação, turnos e feriados" icon={CalendarDays} />
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
            <p className="text-muted-foreground">Erro ao carregar calendários.</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['calendars'] })}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendários de Trabalho"
        description="Defina horários de operação, turnos e feriados"
        icon={CalendarDays}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Calendários</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calendars.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calendários Ativos</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{calendars.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar calendários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Novo Calendário
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando calendários...</span>
        </div>
      ) : calendars.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Nenhum calendário cadastrado.</p>
            <Button onClick={handleAdd} variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro calendário
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCalendars.map((cal) => (
            <Card key={cal.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-base">{cal.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-green-500 border-green-500/50">
                    Ativo
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{getCalendarSummary(cal)}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cal.attributes?.description && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{cal.attributes.description as string}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(cal)}>
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(cal)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCalendar ? 'Editar Calendário' : 'Novo Calendário'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Horário Comercial"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Horário Início</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Horário Fim</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias da Semana</Label>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={formData.selectedDays.includes(day.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleDay(day.value)}
                    className={formData.selectedDays.includes(day.value) ? 'bg-blue-600' : ''}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  <p className="font-medium mb-1">Resumo:</p>
                  <p>{buildDescription(formData.startTime, formData.endTime, formData.selectedDays)}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={handleSave}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!formData.name || formData.selectedDays.length === 0 || createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
