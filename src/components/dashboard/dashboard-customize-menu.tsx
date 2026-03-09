"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  LayoutDashboard,
  BarChart3,
  List,
  TrendingUp,
  RotateCcw,
  PieChart,
} from "lucide-react";
import type { WidgetConfig } from "@/lib/hooks/useDashboardConfig";

const CATEGORY_META: Record<
  WidgetConfig["category"],
  { label: string; icon: typeof BarChart3 }
> = {
  stats: { label: "Estatísticas", icon: LayoutDashboard },
  charts: { label: "Gráficos", icon: PieChart },
  lists: { label: "Listas", icon: List },
  kpi: { label: "Indicadores", icon: TrendingUp },
};

interface DashboardCustomizeMenuProps {
  widgets: WidgetConfig[];
  onToggle: (id: string) => void;
  onReset: () => void;
}

export function DashboardCustomizeMenu({
  widgets,
  onToggle,
  onReset,
}: DashboardCustomizeMenuProps) {
  const categories = Object.keys(CATEGORY_META) as WidgetConfig["category"][];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="w-4 h-4" />
          <span className="sr-only">Personalizar dashboard</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4" />
          Personalizar Dashboard
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {categories.map((cat) => {
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const items = widgets.filter((w) => w.category === cat);
          if (items.length === 0) return null;

          return (
            <div key={cat}>
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Icon className="w-3 h-3" />
                {meta.label}
              </div>
              {items.map((widget) => (
                <div
                  key={widget.id}
                  className="flex items-center justify-between px-2 py-2 hover:bg-muted/50 rounded-sm cursor-pointer"
                  onClick={() => onToggle(widget.id)}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-medium truncate">
                      {widget.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {widget.description}
                    </p>
                  </div>
                  <Switch
                    checked={widget.visible}
                    onCheckedChange={() => onToggle(widget.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                </div>
              ))}
              <DropdownMenuSeparator />
            </div>
          );
        })}

        <div className="px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={onReset}
          >
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Restaurar Padrão
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
