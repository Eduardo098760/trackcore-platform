'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Share2, Copy, CheckCheck, Clock, Car,
  Link2, AlertTriangle, ExternalLink, RefreshCw,
  ShieldOff, Wifi, Loader2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Device } from '@/types';

interface ActiveShare {
  shareId:    string;
  deviceId:   number;
  deviceName: string;
  plate:      string;
  createdAt:  number;
  expiresAt:  number;
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
  return (
    <span className={`font-mono text-xs font-bold ${urgent ? 'text-red-400' : 'text-amber-400'}`}>
      {h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

const DURATIONS: { label: string; ms: number }[] = [
  { label: '15 minutos',  ms: 15 * 60 * 1000          },
  { label: '30 minutos',  ms: 30 * 60 * 1000          },
  { label: '1 hora',      ms: 1  * 60 * 60 * 1000     },
  { label: '3 horas',     ms: 3  * 60 * 60 * 1000     },
  { label: '6 horas',     ms: 6  * 60 * 60 * 1000     },
  { label: '12 horas',    ms: 12 * 60 * 60 * 1000     },
  { label: '24 horas',    ms: 24 * 60 * 60 * 1000     },
];

interface ShareLocationDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  device:        Device | null;
  /** Chamado após criar ou revogar, para atualizar indicadores na tabela */
  onShareChange?: () => void;
}

export function ShareLocationDialog({
  open,
  onOpenChange,
  device,
  onShareChange,
}: ShareLocationDialogProps) {
  const [durationMs,    setDurationMs]    = useState(3_600_000);
  const [shareUrl,      setShareUrl]      = useState<string | null>(null);
  const [expiresAt,     setExpiresAt]     = useState<number | null>(null);
  const [generating,    setGenerating]    = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [activeShares,  setActiveShares]  = useState<ActiveShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [revoking,      setRevoking]      = useState<string | null>(null);

  // ── Buscar shares ativos ao abrir ─────────────────────────────────────────
  const fetchActiveShares = useCallback(async () => {
    if (!device) return;
    setLoadingShares(true);
    try {
      const res = await fetch(`/api/share/active?deviceId=${device.id}`);
      if (res.ok) setActiveShares(await res.json());
    } finally {
      setLoadingShares(false);
    }
  }, [device]);

  useEffect(() => {
    if (open && device) {
      fetchActiveShares();
      setShareUrl(null);
      setExpiresAt(null);
      setCopied(false);
    }
  }, [open, device, fetchActiveShares]);

  // ── Gerar novo link ───────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!device) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/share/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deviceId: device.id, deviceName: device.name, plate: device.plate || '', durationMs }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShareUrl(`${window.location.origin}/share/${data.token}`);
      setExpiresAt(data.expiresAt);
      await fetchActiveShares();
      onShareChange?.();
    } catch {
      toast.error('Erro ao gerar link de compartilhamento');
    } finally {
      setGenerating(false);
    }
  };

  // ── Revogar share ─────────────────────────────────────────────────────────
  const handleRevoke = async (shareId: string) => {
    setRevoking(shareId);
    try {
      const res = await fetch('/api/share/revoke', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ shareId }),
      });
      if (!res.ok) throw new Error();
      toast.success('Acesso revogado com sucesso');
      setActiveShares(prev => prev.filter(s => s.shareId !== shareId));
      setShareUrl(null);
      setExpiresAt(null);
      onShareChange?.();
    } catch {
      toast.error('Erro ao revogar acesso');
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    for (const s of activeShares) await handleRevoke(s.shareId);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2500);
  };

  const selectedDuration = DURATIONS.find(d => d.ms === durationMs);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setShareUrl(null); setExpiresAt(null); } onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-blue-400" />
            </div>
            Compartilhar Localização
          </DialogTitle>
          <DialogDescription>
            Gerencie links temporários de rastreamento em modo leitura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Veículo */}
          {device && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10">
              <Car className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{device.name}</p>
                {device.plate && <p className="text-xs text-muted-foreground font-mono">{device.plate}</p>}
              </div>
              {activeShares.length > 0
                ? <Badge className="bg-green-500/15 text-green-400 border border-green-500/30 text-[10px] gap-1">
                    <Wifi className="w-2.5 h-2.5" /> {activeShares.length} ativo{activeShares.length > 1 ? 's' : ''}
                  </Badge>
                : <Badge variant="secondary" className="text-[10px]">Somente leitura</Badge>
              }
            </div>
          )}

          {/* ── Links ativos ─────────────────────────────────────────────── */}
          {(loadingShares || activeShares.length > 0) && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm text-amber-400">
                    <Wifi className="w-3.5 h-3.5" />
                    Links ativos ({activeShares.length})
                  </Label>
                  {activeShares.length > 1 && (
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
                      onClick={handleRevokeAll}
                      disabled={!!revoking}
                    >
                      <ShieldOff className="w-3 h-3 mr-1" />Revogar todos
                    </Button>
                  )}
                </div>

                {loadingShares
                  ? <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…
                    </div>
                  : activeShares.map(share => (
                    <div key={share.shareId} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-green-500/5 border border-green-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <RemainingTime expiresAt={share.expiresAt} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Criado às {new Date(share.createdAt).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                        onClick={() => handleRevoke(share.shareId)}
                        disabled={revoking === share.shareId}
                      >
                        {revoking === share.shareId
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <><ShieldOff className="w-3 h-3 mr-1" />Revogar</>
                        }
                      </Button>
                    </div>
                  ))
                }
              </div>
              <Separator className="bg-white/5" />
            </>
          )}

          {/* Aviso de segurança */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300/90 leading-relaxed">
              Qualquer pessoa com o link poderá ver a localização em tempo real.
              Use apenas em situações de emergência.
            </p>
          </div>

          <Separator className="bg-white/5" />

          {/* Duração */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Duração do novo link
            </Label>
            <Select
              value={String(durationMs)}
              onValueChange={(v) => { setDurationMs(Number(v)); setShareUrl(null); setExpiresAt(null); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map(d => (
                  <SelectItem key={d.ms} value={String(d.ms)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botão gerar */}
          {!shareUrl && (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleGenerate}
              disabled={generating || !device}
            >
              {generating
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando…</>
                : <><Link2 className="w-4 h-4 mr-2" />Gerar Link · {selectedDuration?.label}</>
              }
            </Button>
          )}

          {/* Link gerado */}
          {shareUrl && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Link de compartilhamento</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="text-xs font-mono bg-white/5 border-white/10 cursor-text"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0 border-white/10">
                    {copied ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {expiresAt && (
                <p className="text-[11px] text-center text-muted-foreground">
                  ⏱ Expira em <span className="font-medium text-foreground">{new Date(expiresAt).toLocaleString('pt-BR')}</span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShareUrl(null); setExpiresAt(null); }} className="border-white/10 text-xs">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Novo Link
                </Button>
                <Button size="sm" className={`text-xs ${copied ? 'bg-emerald-700 hover:bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'}`} onClick={handleCopy}>
                  {copied
                    ? <><CheckCheck className="w-3.5 h-3.5 mr-1.5" />Copiado!</>
                    : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copiar Link</>
                  }
                </Button>
              </div>

              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => window.open(shareUrl, '_blank')}>
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Abrir em nova aba (testar)
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
