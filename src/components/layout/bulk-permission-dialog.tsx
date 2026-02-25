'use client';

import { useState } from 'react';
import { usePermissionsStore, PermissionPreset } from '@/lib/stores/permissions';
import { ALL_ROUTE_KEYS, RoutePermissions } from '@/lib/permissions/types';
import { PermissionGrid } from './permission-grid';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  BookMarked, Plus, Trash2, CheckCheck,
  Users, LayoutTemplate, ArrowRight, Zap,
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

// ── Props ──────────────────────────────────────────────────────────────────────

interface BulkPermissionDialogProps {
  open: boolean;
  onClose: () => void;
  /** IDs dos usuários selecionados na tabela */
  selectedUserIds: number[];
  /** Callback chamado após aplicar com sucesso (para limpar seleção) */
  onApplied: () => void;
}

type TabId = 'apply' | 'create';

// ── Componente ─────────────────────────────────────────────────────────────────

export function BulkPermissionDialog({
  open,
  onClose,
  selectedUserIds,
  onApplied,
}: BulkPermissionDialogProps) {
  const { presets, setPreset, removePreset, setUserPermissions } = usePermissionsStore();
  const [activeTab, setActiveTab]   = useState<TabId>('apply');
  const [newName,   setNewName]     = useState('');
  const [newDesc,   setNewDesc]     = useState('');
  const [draft,     setDraft]       = useState<RoutePermissions>(buildAllTrue);

  const presetList = Object.values(presets).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const handleApplyPreset = (preset: PermissionPreset) => {
    if (selectedUserIds.length === 0) {
      toast.error('Selecione pelo menos um usuário na tabela para aplicar');
      return;
    }
    selectedUserIds.forEach((userId) => {
      setUserPermissions(userId, {
        inheritFromCompany: false,
        routes: preset.routes,
        appliedPresetId: preset.id,
        appliedPresetName: preset.name,
      });
    });
    toast.success(`"${preset.name}" aplicado a ${selectedUserIds.length} usuário(s)!`);
    onApplied();
    onClose();
  };

  const handleSavePreset = () => {
    if (!newName.trim()) {
      toast.error('Informe um nome para o preset');
      return;
    }
    const id = `preset_${Date.now()}`;
    setPreset({
      id,
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      routes: draft,
      createdAt: new Date().toISOString(),
    });
    toast.success(`Preset "${newName.trim()}" criado com sucesso!`);
    setNewName('');
    setNewDesc('');
    setDraft(buildAllTrue());
    setActiveTab('apply');
  };

  const handleDeletePreset = (id: string, name: string) => {
    if (confirm(`Excluir o preset "${name}"?`)) {
      removePreset(id);
      toast.success('Preset excluído');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-[#0d1117] border-white/10 p-0 overflow-hidden">

        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 shrink-0">
              <LayoutTemplate className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <DialogTitle className="text-gray-100">Permissões em Massa · Presets</DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedUserIds.length > 0
                  ? `${selectedUserIds.length} usuário(s) selecionado(s) — pronto para aplicar`
                  : 'Selecione usuários na tabela para poder aplicar um preset'}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Tabs ── */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg w-fit">
            {([
              { id: 'apply'  as TabId, label: 'Presets Salvos', icon: BookMarked },
              { id: 'create' as TabId, label: 'Criar Preset',   icon: Plus      },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === id
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {id === 'apply' && presetList.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 text-[10px] font-bold">
                    {presetList.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Tab: Presets Salvos */}
          {activeTab === 'apply' && (
            <>
              {presetList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 border border-dashed border-white/10 rounded-xl">
                  <BookMarked className="w-10 h-10 text-gray-600" />
                  <p className="text-sm text-gray-500">Nenhum preset criado ainda</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('create')}
                    className="border-white/10 text-gray-300 hover:bg-white/5 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Criar primeiro preset
                  </Button>
                </div>
              ) : (
                presetList.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-purple-500/20 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-purple-500/10 shrink-0">
                      <Zap className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{preset.name}</p>
                      {preset.description && (
                        <p className="text-xs text-gray-500 truncate">{preset.description}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-0.5">
                        {countEnabled(preset.routes)}/{ALL_ROUTE_KEYS.length} rotas habilitadas
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleApplyPreset(preset)}
                        disabled={selectedUserIds.length === 0}
                        title={selectedUserIds.length === 0 ? 'Selecione usuários na tabela' : undefined}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs h-8 gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        {selectedUserIds.length > 0 ? `Aplicar a ${selectedUserIds.length}` : 'Aplicar'}
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePreset(preset.id, preset.name)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                        title="Excluir preset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}

              {selectedUserIds.length === 0 && presetList.length > 0 && (
                <p className="text-xs text-amber-400/60 text-center pt-1">
                  ⚠ Selecione usuários na tabela para poder aplicar um preset
                </p>
              )}
            </>
          )}

          {/* Tab: Criar Preset */}
          {activeTab === 'create' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Nome do Preset *</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Operador Básico"
                    className="bg-white/5 border-white/10 text-gray-200 placeholder:text-gray-600 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Descrição (opcional)</label>
                  <Input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Breve descrição das permissões"
                    className="bg-white/5 border-white/10 text-gray-200 placeholder:text-gray-600 h-9"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDraft(buildAllTrue())}
                  className="border-white/10 text-gray-300 hover:bg-white/5 text-xs h-7 flex-1"
                >
                  Liberar tudo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDraft(buildAllFalse())}
                  className="border-white/10 text-gray-300 hover:bg-white/5 text-xs h-7 flex-1"
                >
                  Bloquear tudo
                </Button>
              </div>

              <div className="border border-white/5 rounded-xl p-4 bg-white/[0.02]">
                <PermissionGrid value={draft} onChange={setDraft} />
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-white/5 shrink-0 flex gap-2">
          {activeTab === 'create' ? (
            <>
              <Button
                onClick={handleSavePreset}
                disabled={!newName.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Salvar Preset
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                Fechar
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full border-white/10 text-gray-300 hover:bg-white/5"
            >
              Fechar
            </Button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
