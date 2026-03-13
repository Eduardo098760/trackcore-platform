'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Share2,
  Copy,
  ExternalLink,
  ShieldOff,
  Clock,
  Car,
  Loader2,
  Link2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getDevices } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ActiveShare {
  shareId: string;
  deviceId: number;
  deviceName: string;
  plate: string;
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
}

const DURATIONS: { label: string; ms: number }[] = [
  { label: '15 minutos', ms: 15 * 60 * 1000 },
  { label: '30 minutos', ms: 30 * 60 * 1000 },
  { label: '1 hora', ms: 60 * 60 * 1000 },
  { label: '3 horas', ms: 3 * 60 * 60 * 1000 },
  { label: '6 horas', ms: 6 * 60 * 60 * 1000 },
  { label: '12 horas', ms: 12 * 60 * 60 * 1000 },
  { label: '24 horas', ms: 24 * 60 * 60 * 1000 },
];

async function fetchActiveShares(): Promise<ActiveShare[]> {
  const res = await fetch('/api/share/active', { credentials: 'include' });
  if (!res.ok) throw new Error('Falha ao buscar compartilhamentos');
  return res.json();
}

async function revokeShare(shareId: string): Promise<void> {
  const res = await fetch('/api/share/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ shareId }),
  });
  if (!res.ok) throw new Error('Falha ao revogar compartilhamento');
}

async function createShare(deviceId: number, durationMs: number): Promise<{ token: string }> {
  const res = await fetch('/api/share/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ deviceId, durationMs }),
  });
  if (!res.ok) throw new Error('Falha ao criar compartilhamento');
  return res.json();
}

function RemainingTime({ expiresAt }: { expiresAt: number }) {
  const [ms, setMs] = useState(Math.max(0, expiresAt - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setMs(Math.max(0, expiresAt - Date.now())), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const urgent = ms < 5 * 60_000;
  if (ms <= 0) return <Badge variant="secondary">Expirado</Badge>;
  return (
    <span className={`font-mono text-xs font-bold ${urgent ? 'text-red-400' : 'text-amber-400'}`}>
      {h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

export default function SharedAccessPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<string>(String(DURATIONS[2].ms));
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const { data: shares, isLoading } = useQuery({
    queryKey: ['active-shares'],
    queryFn: fetchActiveShares,
    refetchInterval: 10000,
  });

  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeShare,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-shares'] });
      toast.success('Compartilhamento revogado');
    },
    onError: () => toast.error('Erro ao revogar compartilhamento'),
  });

  const createMutation = useMutation({
    mutationFn: ({ deviceId, durationMs }: { deviceId: number; durationMs: number }) =>
      createShare(deviceId, durationMs),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-shares'] });
      const url = `${window.location.origin}/share/${data.token}`;
      setGeneratedLink(url);
      toast.success('Link de compartilhamento criado');
    },
    onError: () => toast.error('Erro ao criar compartilhamento'),
  });

  const handleCreate = () => {
    if (!selectedDeviceId) {
      toast.error('Selecione um veículo');
      return;
    }
    createMutation.mutate({
      deviceId: Number(selectedDeviceId),
      durationMs: Number(selectedDuration),
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado!');
  };

  const activeShares = shares?.filter(s => !s.revoked && s.expiresAt > Date.now()) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acesso Compartilhado"
        description="Gerencie links de compartilhamento de localização"
        icon={Share2}
        action={
          <Button onClick={() => { setCreateOpen(true); setGeneratedLink(null); }}>
            <Link2 className="h-4 w-4 mr-2" />
            Novo Compartilhamento
          </Button>
        }
      />

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>Links de compartilhamento permitem que pessoas sem conta acompanhem a localização de um veículo em tempo real.</p>
              <p className="mt-1">Os links expiram automaticamente no tempo definido. Você pode revogar a qualquer momento.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Shares */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Compartilhamentos Ativos ({activeShares.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeShares.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum compartilhamento ativo no momento.
            </p>
          ) : (
            <div className="space-y-3">
              {activeShares.map((share) => (
                <div
                  key={share.shareId}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Car className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{share.deviceName}</p>
                      {share.plate && (
                        <p className="text-xs text-muted-foreground">{share.plate}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <RemainingTime expiresAt={share.expiresAt} />
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Criado: {new Date(share.createdAt).toLocaleString('pt-BR')}
                    </div>

                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const url = `${window.location.origin}/share/${share.shareId}`;
                          window.open(url, '_blank');
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => revokeMutation.mutate(share.shareId)}
                        disabled={revokeMutation.isPending}
                      >
                        <ShieldOff className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Compartilhamento</DialogTitle>
          </DialogHeader>

          {generatedLink ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Link criado com sucesso! Envie para quem deseja compartilhar:
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={generatedLink}
                  className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm"
                />
                <Button size="sm" onClick={() => copyToClipboard(generatedLink)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => window.open(generatedLink, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir
                </Button>
                <Button onClick={() => { setCreateOpen(false); setGeneratedLink(null); }}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Veículo</label>
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices?.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}{d.plate ? ` - ${d.plate}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duração</label>
                <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d.ms} value={String(d.ms)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Link
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
