'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Search, Shield, User, Settings, Trash2, Edit, Eye, Database } from 'lucide-react';
import type { AuditLog } from '@/types';

// Mock data
const mockLogs: AuditLog[] = [
  {
    id: 1,
    userId: 1,
    userName: 'Admin Sistema',
    action: 'CREATE',
    resource: 'device',
    resourceId: 15,
    details: 'Criado dispositivo "VW Gol - XYZ-1234"',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  },
  {
    id: 2,
    userId: 1,
    userName: 'Admin Sistema',
    action: 'UPDATE',
    resource: 'geofence',
    resourceId: 3,
    details: 'Alterado cercas "Centro da Cidade" - raio modificado de 500m para 750m',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    id: 3,
    userId: 2,
    userName: 'João Silva',
    action: 'DELETE',
    resource: 'notification',
    resourceId: 8,
    details: 'Removida notificação "Alerta de Velocidade"',
    ipAddress: '192.168.1.50',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  },
  {
    id: 4,
    userId: 1,
    userName: 'Admin Sistema',
    action: 'LOGIN',
    resource: 'auth',
    resourceId: 0,
    details: 'Login realizado com sucesso',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString()
  },
  {
    id: 5,
    userId: 3,
    userName: 'Maria Santos',
    action: 'VIEW',
    resource: 'report',
    resourceId: 12,
    details: 'Visualizado relatório "Resumo Mensal - Junho 2024"',
    ipAddress: '192.168.1.75',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString()
  },
  {
    id: 6,
    userId: 1,
    userName: 'Admin Sistema',
    action: 'UPDATE',
    resource: 'settings',
    resourceId: 1,
    details: 'Configurações globais atualizadas - timezone alterado para America/Sao_Paulo',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  },
  {
    id: 7,
    userId: 2,
    userName: 'João Silva',
    action: 'CREATE',
    resource: 'command',
    resourceId: 5,
    details: 'Enviado comando "Desligar Motor" para dispositivo ABC-1234',
    ipAddress: '192.168.1.50',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString()
  },
  {
    id: 8,
    userId: 4,
    userName: 'Carlos Oliveira',
    action: 'FAILED_LOGIN',
    resource: 'auth',
    resourceId: 0,
    details: 'Tentativa de login falhou - senha incorreta',
    ipAddress: '203.0.113.45',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString()
  }
];

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-500',
  UPDATE: 'bg-blue-500',
  DELETE: 'bg-red-500',
  VIEW: 'bg-gray-500',
  LOGIN: 'bg-purple-500',
  LOGOUT: 'bg-purple-400',
  FAILED_LOGIN: 'bg-red-600'
};

const actionIcons: Record<string, any> = {
  CREATE: Database,
  UPDATE: Edit,
  DELETE: Trash2,
  VIEW: Eye,
  LOGIN: User,
  LOGOUT: User,
  FAILED_LOGIN: Shield
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>(mockLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterResource, setFilterResource] = useState<string>('all');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ipAddress.includes(searchTerm);
    
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesResource = filterResource === 'all' || log.resource === filterResource;

    return matchesSearch && matchesAction && matchesResource;
  });

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));
  const uniqueResources = Array.from(new Set(logs.map(l => l.resource)));

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s atrás`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return date.toLocaleString('pt-BR');
  };

  const stats = {
    total: logs.length,
    today: logs.filter(l => {
      const logDate = new Date(l.timestamp);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    }).length,
    failedLogins: logs.filter(l => l.action === 'FAILED_LOGIN').length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs de Auditoria"
        description="Histórico completo de ações no sistema"
        icon={Shield}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos Hoje</CardTitle>
            <Settings className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.today}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tentativas Falhas</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.failedLogins}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todas as Ações</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>

            <select
              value={filterResource}
              onChange={(e) => setFilterResource(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todos os Recursos</option>
              {uniqueResources.map(resource => (
                <option key={resource} value={resource}>{resource}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredLogs.map((log) => {
              const ActionIcon = actionIcons[log.action] || Settings;
              return (
                <div key={log.id} className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  {/* Icon & Badge */}
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full ${actionColors[log.action]} flex items-center justify-center`}>
                      <ActionIcon className="h-5 w-5 text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge className={actionColors[log.action]}>
                          {log.action}
                        </Badge>
                        <span className="text-sm font-medium">{log.userName}</span>
                        <span className="text-xs text-muted-foreground">
                          {log.resource}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">{log.details}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        IP: {log.ipAddress}
                      </span>
                      <span className="truncate max-w-xs" title={log.userAgent}>
                        {log.userAgent.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum log encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
