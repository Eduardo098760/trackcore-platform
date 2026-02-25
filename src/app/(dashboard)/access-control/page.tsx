'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissionsStore } from '@/lib/stores/permissions';
import { useAuthStore } from '@/lib/stores/auth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { ROUTE_CONFIGS, GROUP_LABELS, RouteGroup } from '@/lib/permissions/routes';
import { RouteKey, RoutePermissions, ALL_ROUTE_KEYS } from '@/lib/permissions/types';
import { getDefaultPermissionsByRole, SUPER_ADMIN_PERMISSIONS } from '@/lib/permissions/defaults';
import { getOrganizations } from '@/lib/api/organizations';
import { api } from '@/lib/api/client';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import {
  Building2, Users, ShieldCheck, ShieldOff,
  CheckCheck, RotateCcw, KeyRound, Info
} from 'lucide-react';
import { Organization, User } from '@/types';

type TabId = 'companies' | 'users';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin:      'Administrador',
  operator:   'Operador',
  client:     'Cliente',
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  admin:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
  operator:   'bg-green-500/20 text-green-300 border-green-500/30',
  client:     'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildAllTrue(): RoutePermissions {
  return Object.fromEntries(ALL_ROUTE_KEYS.map((k) => [k, true])) as RoutePermissions;
}

function buildAllFalse(): RoutePermissions {
  return Object.fromEntries(ALL_ROUTE_KEYS.map((k) => [k, false])) as RoutePermissions;
}

function countEnabled(perms: RoutePermissions): number {
  return ALL_ROUTE_KEYS.filter((k) => perms[k]).length;
}

// ── Sub-componente: grade de toggles por grupo ────────────────────────────────

function PermissionGrid({
  value,
  onChange,
  ceiling,
}: {
  value: RoutePermissions;
  onChange: (updated: RoutePermissions) => void;
  /** Teto máximo (empresa) para colorir permissões bloqueadas pelo teto */
  ceiling?: RoutePermissions;
}) {
  const groups: RouteGroup[] = ['main', 'video', 'advanced', 'management'];

  const toggle = (key: RouteKey) => {
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const items = ROUTE_CONFIGS.filter((r) => r.group === group);
        return (
          <div key={group}>
            <p className="text-xs font-semibold text-purple-400/80 uppercase tracking-wider mb-2">
              {GROUP_LABELS[group]}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map((route) => {
                const enabled         = value[route.key];
                const blockedByCeiling = ceiling ? !ceiling[route.key] : false;

                return (
                  <div
                    key={route.key}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                      blockedByCeiling
                        ? 'border-white/5 bg-white/2 opacity-50 cursor-not-allowed'
                        : enabled
                        ? 'border-blue-500/20 bg-blue-500/5'
                        : 'border-white/5 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {enabled && !blockedByCeiling
                        ? <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        : <ShieldOff className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                      }
                      <span className="text-sm text-gray-300">{route.name}</span>
                      {blockedByCeiling && (
                        <span className="text-[10px] text-orange-400/70 ml-1">(bloqueado pela empresa)</span>
                      )}
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => !blockedByCeiling && toggle(route.key)}
                      disabled={blockedByCeiling}
                      className="data-[state=checked]:bg-blue-600"
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

// ── Tab: Empresas ──────────────────────────────────────────────────────────────

function CompaniesTab() {
  const { companies, setCompanyPermissions } = usePermissionsStore();
  const [selectedId, setSelectedId]           = useState<number | null>(null);
  const [draft, setDraft]                     = useState<RoutePermissions | null>(null);

  const { data: orgs = [], isLoading } = useQuery<Organization[]>({
    queryKey: ['organizations-perms'],
    queryFn:  getOrganizations,
  });

  const handleSelect = (org: Organization) => {
    setSelectedId(org.id);
    // Carrega permissões salvas ou usa todas liberadas como padrão
    setDraft(companies[org.id] ?? buildAllTrue());
  };

  const handleSave = () => {
    if (selectedId === null || !draft) return;
    setCompanyPermissions(selectedId, draft);
    toast.success('Permissões da empresa salvas!');
  };

  const handleReset = (role: string) => {
    if (!draft) return;
    setDraft(getDefaultPermissionsByRole(role));
  };

  const selected = orgs.find((o) => o.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de empresas */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Empresas</p>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Nenhuma empresa encontrada</p>
        ) : (
          orgs.map((org) => {
            const perms = companies[org.id];
            const count = perms ? countEnabled(perms) : ALL_ROUTE_KEYS.length;
            return (
              <button
                key={org.id}
                onClick={() => handleSelect(org)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selectedId === org.id
                    ? 'border-blue-500/40 bg-blue-500/10'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-sm font-medium text-gray-200 truncate">{org.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                    {count}/{ALL_ROUTE_KEYS.length}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 ml-6 capitalize">{org.plan}</p>
              </button>
            );
          })
        )}
      </div>

      {/* Editor de permissões */}
      <div className="lg:col-span-2">
        {!selected || !draft ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 border border-dashed border-white/10 rounded-xl">
            <Building2 className="w-8 h-8 text-gray-600" />
            <p className="text-sm text-gray-500">Selecione uma empresa para editar suas permissões</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header do editor */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-100">{selected.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {countEnabled(draft)} de {ALL_ROUTE_KEYS.length} rotas habilitadas
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm" variant="outline"
                  onClick={() => setDraft(buildAllTrue())}
                  className="border-white/10 text-gray-300 hover:bg-white/5 text-xs h-7"
                >
                  Liberar tudo
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={() => setDraft(buildAllFalse())}
                  className="border-white/10 text-gray-300 hover:bg-white/5 text-xs h-7"
                >
                  Bloquear tudo
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1" />
                  Salvar
                </Button>
              </div>
            </div>

            <div className="border border-white/5 rounded-xl p-4 bg-white/[0.02]">
              <PermissionGrid value={draft} onChange={setDraft} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Usuários ──────────────────────────────────────────────────────────────

function UsersTab() {
  const { companies, users, setUserPermissions } = usePermissionsStore();
  const organization = useAuthStore((s) => s.organization);
  const [selectedUserId, setSelectedUserId]       = useState<number | null>(null);
  const [inherit, setInherit]                     = useState(true);
  const [draft, setDraft]                         = useState<RoutePermissions | null>(null);

  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ['users-perms'],
    queryFn:  () => api.get<User[]>('/users'),
  });

  const handleSelect = (u: User) => {
    setSelectedUserId(u.id);
    const saved = users[u.id];
    if (saved) {
      setInherit(saved.inheritFromCompany);
      setDraft(saved.routes);
    } else {
      // Default: herdar da empresa
      setInherit(true);
      const companyCeiling = organization ? companies[organization.id] : undefined;
      setDraft(companyCeiling ?? buildAllTrue());
    }
  };

  const handleSave = () => {
    if (selectedUserId === null || !draft) return;
    setUserPermissions(selectedUserId, { inheritFromCompany: inherit, routes: draft });
    toast.success('Permissões do usuário salvas!');
  };

  const companyPerms = organization ? companies[organization.id] : undefined;

  const selectedUser = allUsers.find((u) => u.id === selectedUserId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de usuários */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Usuários</p>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : allUsers.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Nenhum usuário encontrado</p>
        ) : (
          allUsers.map((u) => {
            const entry   = users[u.id];
            const isSuperA = u.role === 'superadmin';
            return (
              <button
                key={u.id}
                onClick={() => !isSuperA && handleSelect(u)}
                disabled={isSuperA}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  isSuperA
                    ? 'border-purple-500/20 bg-purple-500/5 opacity-70 cursor-not-allowed'
                    : selectedUserId === u.id
                    ? 'border-blue-500/40 bg-blue-500/10'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-200 truncate">{u.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${ROLE_COLORS[u.role] ?? ROLE_COLORS.client}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</p>
                {isSuperA && (
                  <p className="text-[10px] text-purple-400/70 mt-0.5">Acesso irrestrito</p>
                )}
                {!isSuperA && entry && !entry.inheritFromCompany && (
                  <p className="text-[10px] text-blue-400/70 mt-0.5">Permissões customizadas</p>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Editor */}
      <div className="lg:col-span-2">
        {!selectedUser || !draft ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 border border-dashed border-white/10 rounded-xl">
            <Users className="w-8 h-8 text-gray-600" />
            <p className="text-sm text-gray-500">Selecione um usuário para gerenciar suas permissões</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-100">{selectedUser.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedUser.email}</p>
              </div>
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Salvar
              </Button>
            </div>

            {/* Toggle de herança */}
            <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
              inherit ? 'border-green-500/20 bg-green-500/5' : 'border-blue-500/20 bg-blue-500/5'
            }`}>
              <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">Herdar permissões da empresa</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {inherit
                    ? 'O usuário usa exatamente as permissões definidas para a empresa.'
                    : 'O usuário tem permissões customizadas. Não pode superar o teto da empresa.'}
                </p>
              </div>
              <Switch
                checked={inherit}
                onCheckedChange={(v) => {
                  setInherit(v);
                  if (v) {
                    // Ao herdar, reseta o draft para as permissões da empresa
                    setDraft(companyPerms ?? buildAllTrue());
                  }
                }}
                className="data-[state=checked]:bg-green-600 shrink-0"
              />
            </div>

            {/* Grade de permissões (desabilitada quando herda) */}
            <div className={inherit ? 'opacity-40 pointer-events-none' : ''}>
              <div className="border border-white/5 rounded-xl p-4 bg-white/[0.02]">
                <PermissionGrid
                  value={draft}
                  onChange={setDraft}
                  ceiling={companyPerms}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AccessControlPage() {
  const { isSuperAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabId>('companies');

  // Apenas SUPER_ADMIN pode acessar esta página (RouteGuard cuida do resto)
  if (!isSuperAdmin) {
    return null; // RouteGuard já exibe o painel de acesso negado
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Acesso"
        description="Gerencie as permissões de acesso às rotas por empresa e por usuário."
        icon={KeyRound}
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm text-gray-300 space-y-1">
          <p><strong className="text-amber-300">Hierarquia de permissões:</strong></p>
          <ol className="list-decimal list-inside space-y-0.5 text-gray-400">
            <li><strong className="text-gray-300">Super Admin</strong> — acesso irrestrito a tudo</li>
            <li><strong className="text-gray-300">Empresa</strong> — define o teto máximo de acesso</li>
            <li><strong className="text-gray-300">Usuário</strong> — herda da empresa ou tem permissões customizadas (nunca supera a empresa)</li>
          </ol>
        </div>
      </div>

      {/* Tabs */}
      <Card className="bg-card/50 border-white/10 p-6">
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg w-fit mb-6">
          {([ 
            { id: 'companies' as TabId, label: 'Empresas',  icon: Building2 },
            { id: 'users'     as TabId, label: 'Usuários',  icon: Users },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'companies' ? <CompaniesTab /> : <UsersTab />}
      </Card>
    </div>
  );
}
