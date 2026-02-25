'use client';

import { useState } from 'react';
import { RouteKey, RoutePermissions } from '@/lib/permissions/types';
import { ROUTE_CONFIGS, GROUP_LABELS, RouteGroup } from '@/lib/permissions/routes';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, ShieldOff, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const GROUP_COLORS: Record<RouteGroup, string> = {
  main:       'text-blue-400/80',
  video:      'text-purple-400/80',
  advanced:   'text-orange-400/80',
  management: 'text-green-400/80',
};

export function PermissionGrid({
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

  // todos os grupos começam expandidos
  const [expanded, setExpanded] = useState<Set<RouteGroup>>(
    () => new Set(groups)
  );

  const toggleGroup = (group: RouteGroup) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const toggle = (key: RouteKey) => {
    if (disabled) return;
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const items         = ROUTE_CONFIGS.filter((r) => r.group === group);
        const isExpanded    = expanded.has(group);
        const enabledCount  = items.filter((r) => value[r.key]).length;
        const totalCount    = items.length;

        return (
          <div key={group} className="rounded-xl border border-white/5 overflow-hidden">
            {/* Header clicável do grupo */}
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-wider',
                    GROUP_COLORS[group]
                  )}
                >
                  {GROUP_LABELS[group]}
                </span>
                <span className="text-[10px] text-gray-500">
                  {enabledCount}/{totalCount}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-gray-500 transition-transform duration-200',
                  isExpanded ? 'rotate-0' : '-rotate-90'
                )}
              />
            </button>

            {/* Itens colapsáveis */}
            {isExpanded && (
              <div className="px-2 pb-2 pt-1 grid grid-cols-1 gap-1">
                {items.map((route) => {
                  const enabled          = value[route.key];
                  const blockedByCeiling = ceiling ? !ceiling[route.key] : false;
                  const isDisabled       = disabled || blockedByCeiling;

                  return (
                    <div
                      key={route.key}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg border transition-colors',
                        isDisabled
                          ? 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
                          : enabled
                          ? 'border-blue-500/20 bg-blue-500/5'
                          : 'border-white/5 bg-white/[0.02]'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {enabled && !isDisabled
                          ? <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          : <ShieldOff   className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                        }
                        <span className="text-sm text-gray-300 truncate">{route.name}</span>
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
            )}
          </div>
        );
      })}
    </div>
  );
}
