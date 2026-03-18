'use client';

import { useState, useEffect } from 'react';
import { usePermissionsStore } from '@/lib/stores/permissions';
import { useAuthStore } from '@/lib/stores/auth';
import { ROUTE_CONFIGS, GROUP_LABELS, RouteGroup } from '@/lib/permissions/routes';
import { RouteKey, RoutePermissions, ALL_ROUTE_KEYS } from '@/lib/permissions/types';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  ShieldCheck, ShieldOff, CheckCheck,
  Building2, Users, Info,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildAllTrue(): RoutePermissions {
  return Object.fromEntries(ALL_ROUTE_KEYS.map((k) => [k, true])) as RoutePermissions;
}

function buildAllFalse(): RoutePermissions {
  return Object.fromEntries(ALL_ROUTE_KEYS.map((k) => [k, false])) as RoutePermissions;
}

function countEnabled(perms: RoutePermissions): number {
  return ALL_ROUTE_KEYS.filter((k) => perms[k]).length;
}

// ── Grade de toggles ───────────────────────────────────────────────────────────

function PermissionGrid({
  value,
  onChange,
  ceiling,
  disabled,
}: {
  value: RoutePermissions;
  onChange: (updated: RoutePermissions) => void;
  ceiling?: RoutePermissions;
  disabled?: boolean;
}) {
  const groups: RouteGroup[] = ['main', 'video', 'advanced', 'management'];

  const toggle = (key: RouteKey) => {
    if (disabled) return;
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const items = ROUTE_CONFIGS.filter((r) => r.group === group);
        return (
          <div key={group}>
            <p className="text-[11px] font-semibold text-purple-400/80 uppercase tracking-wider mb-2">
              {GROUP_LABELS[group]}
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {items.map((route) => {
                const enabled          = value[route.key];
                const blockedByCeiling = ceiling ? !ceiling[route.key] : false;
                const isDisabled       = disabled || blockedByCeiling;

                return (
                  <div
                    key={route.key}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                      isDisabled
                        ? 'border-border/50 bg-muted/10 opacity-50 cursor-not-allowed'
                        : enabled
                        ? 'border-blue-500/20 bg-blue-500/5'
                        : 'border-border/50 bg-muted/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {enabled && !isDisabled
                        ? <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        : <ShieldOff  className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      }
                      <span className="text-sm text-foreground truncate">{route.name}</span>
                      {blockedByCeiling && (
                        <span className="text-[10px] text-orange-400/70 shrink-0">(empresa)</span>
                      )}
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggle(route.key)}
                      disabled={isDisabled}
                      className="data-[state=checked]:bg-blue-600 ml-2 shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface PermissionSheetProps {
  mode: 'user' | 'company';
  targetId: number | null;
  targetName: string;
  open: boolean;
  onClose: () => void;
}

// ── Componente principal ───────────────────────────────────────────────────────

export function PermissionSheet({
  mode,
  targetId,
  targetName,
  open,
  onClose,
}: PermissionSheetProps) {
  const { companies, users, setCompanyPermissions, setUserPermissions } = usePermissionsStore();
  const organization = useAuthStore((s) => s.organization);
  const companyPerms = organization ? companies[organization.id] : undefined;

  const [draft, setDraft]       = useState<RoutePermissions | null>(null);
  const [inherit, setInherit]   = useState(true);

  // Recarrega o rascunho sempre que a sheet abrir ou o alvo mudar
  useEffect(() => {
    if (!open || targetId === null) return;

    if (mode === 'company') {
      setDraft(companies[targetId] ?? buildAllTrue());
    } else {
      const saved = users[targetId];
      if (saved) {
        setInherit(saved.inheritFromCompany);
        setDraft(saved.routes);
      } else {
        setInherit(true);
        setDraft(companyPerms ?? buildAllTrue());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetId, mode]);

  const handleSave = () => {
    if (targetId === null || !draft) return;

    if (mode === 'company') {
      setCompanyPermissions(targetId, draft);
      toast.success(`Permissões de "${targetName}" salvas!`);
    } else {
      // limpa preset ao salvar manualmente (editou individualmente)
      setUserPermissions(targetId, { inheritFromCompany: inherit, routes: draft, appliedPresetId: undefined, appliedPresetName: undefined });
      toast.success(`Permissões de "${targetName}" salvas!`);
    }
    onClose();
  };

  const enabledCount = draft ? countEnabled(draft) : 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-background border-border flex flex-col p-0 overflow-hidden"
      >
        {/* Header fixo */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            {mode === 'company'
              ? <Building2 className="w-5 h-5 text-blue-400 shrink-0" />
              : <Users     className="w-5 h-5 text-blue-400 shrink-0" />
            }
            <div className="min-w-0">
              <SheetTitle className="text-foreground text-base truncate">{targetName}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mode === 'company' ? 'Permissões da empresa' : 'Permissões do usuário'}
                {draft && ` · ${enabledCount}/${ALL_ROUTE_KEYS.length} rotas`}
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Botões rápidos (somente no modo empresa ou usuário com permissões customizadas) */}
          {mode === 'company' && draft && (
            <div className="flex gap-2">
              <Button
                size="sm" variant="outline"
                onClick={() => setDraft(buildAllTrue())}
                className="border-border text-foreground hover:bg-accent text-xs h-7 flex-1"
              >
                Liberar tudo
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={() => setDraft(buildAllFalse())}
                className="border-border text-foreground hover:bg-accent text-xs h-7 flex-1"
              >
                Bloquear tudo
              </Button>
            </div>
          )}

          {/* Toggle de herança (somente usuários) */}
          {mode === 'user' && (
            <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
              inherit ? 'border-green-500/20 bg-green-500/5' : 'border-blue-500/20 bg-blue-500/5'
            }`}>
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Herdar da empresa</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {inherit
                    ? 'Usa exatamente as permissões definidas para a empresa.'
                    : 'Permissões customizadas. Não pode superar o teto da empresa.'}
                </p>
              </div>
              <Switch
                checked={inherit}
                onCheckedChange={(v) => {
                  setInherit(v);
                  if (v) setDraft(companyPerms ?? buildAllTrue());
                }}
                className="data-[state=checked]:bg-green-600 shrink-0"
              />
            </div>
          )}

          {/* Grade de permissões */}
          {draft && (
            <div className={mode === 'user' && inherit ? 'opacity-40 pointer-events-none' : ''}>
              <PermissionGrid
                value={draft}
                onChange={setDraft}
                ceiling={mode === 'user' ? companyPerms : undefined}
              />
            </div>
          )}
        </div>

        {/* Footer fixo */}
        <div className="px-6 py-4 border-t border-border/50 shrink-0">
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!draft}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Salvar permissões
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-foreground hover:bg-accent"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
