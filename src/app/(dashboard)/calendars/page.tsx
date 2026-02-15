'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Plus, Edit, Trash2, Search, Clock, CalendarDays, AlertCircle } from 'lucide-react';
import type { Calendar as CalendarType } from '@/types';

// Mock data
const mockCalendars: CalendarType[] = [
  {
    id: 1,
    name: 'Horário Comercial',
    description: 'Segunda a Sexta, 8h às 18h',
    data: 'DTSTART:20240101T080000\nDTEND:20240101T180000\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: 2,
    name: 'Turno Noturno',
    description: 'Segunda a Sábado, 18h às 2h',
    data: 'DTSTART:20240101T180000\nDTEND:20240102T020000\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: 3,
    name: 'Fim de Semana',
    description: 'Sábado e Domingo, 24h',
    data: 'DTSTART:20240106T000000\nDTEND:20240107T235959\nRRULE:FREQ=WEEKLY;BYDAY=SA,SU',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
];

const weekDays = [
  { value: 'MO', label: 'Seg' },
  { value: 'TU', label: 'Ter' },
  { value: 'WE', label: 'Qua' },
  { value: 'TH', label: 'Qui' },
  { value: 'FR', label: 'Sex' },
  { value: 'SA', label: 'Sáb' },
  { value: 'SU', label: 'Dom' }
];

export default function CalendarsPage() {
  const [calendars, setCalendars] = useState<CalendarType[]>(mockCalendars);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<CalendarType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: '08:00',
    endTime: '18:00',
    selectedDays: ['MO', 'TU', 'WE', 'TH', 'FR']
  });

  const filteredCalendars = calendars.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    setEditingCalendar(null);
    setFormData({
      name: '',
      description: '',
      startTime: '08:00',
      endTime: '18:00',
      selectedDays: ['MO', 'TU', 'WE', 'TH', 'FR']
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (calendar: CalendarType) => {
    setEditingCalendar(calendar);
    // Parse iCal data to extract time and days
    setFormData({
      name: calendar.name,
      description: calendar.description || '',
      startTime: '08:00',
      endTime: '18:00',
      selectedDays: ['MO', 'TU', 'WE', 'TH', 'FR']
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este calendário?')) {
      setCalendars(calendars.filter(c => c.id !== id));
    }
  };

  const generateICalData = () => {
    const { startTime, endTime, selectedDays } = formData;
    const byday = selectedDays.join(',');
    return `DTSTART:20240101T${startTime.replace(':', '')}00\nDTEND:20240101T${endTime.replace(':', '')}00\nRRULE:FREQ=WEEKLY;BYDAY=${byday}`;
  };

  const handleSave = () => {
    const iCalData = generateICalData();
    
    if (editingCalendar) {
      setCalendars(calendars.map(c => 
        c.id === editingCalendar.id 
          ? { ...c, name: formData.name, description: formData.description, data: iCalData, updatedAt: new Date().toISOString() }
          : c
      ));
    } else {
      const newCalendar: CalendarType = {
        id: Math.max(...calendars.map(c => c.id), 0) + 1,
        name: formData.name,
        description: formData.description,
        data: iCalData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setCalendars([...calendars, newCalendar]);
    }
    setIsDialogOpen(false);
  };

  const toggleDay = (day: string) => {
    const newDays = formData.selectedDays.includes(day)
      ? formData.selectedDays.filter(d => d !== day)
      : [...formData.selectedDays, day];
    setFormData({ ...formData, selectedDays: newDays });
  };

  const stats = {
    total: calendars.length,
    active: calendars.length // Todos ativos por padrão
  };

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
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calendários Ativos</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCalendars.map((calendar) => (
          <Card key={calendar.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-base">{calendar.name}</CardTitle>
                </div>
                <Badge variant="outline" className="text-green-500 border-green-500/50">
                  Ativo
                </Badge>
              </div>
              {calendar.description && (
                <p className="text-sm text-muted-foreground mt-2">{calendar.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Configurado para operação recorrente
                  </span>
                </div>
                
                <div className="flex gap-2 pt-3 border-t">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(calendar)}>
                    <Edit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-500 hover:text-red-600" 
                    onClick={() => handleDelete(calendar.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                  <p>
                    {formData.selectedDays.length === 0 ? 'Nenhum dia selecionado' :
                     formData.selectedDays.length === 7 ? 'Todos os dias' :
                     `${formData.selectedDays.map(d => weekDays.find(w => w.value === d)?.label).join(', ')}`}
                  </p>
                  <p>Das {formData.startTime} às {formData.endTime}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={handleSave} 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!formData.name || formData.selectedDays.length === 0}
              >
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
