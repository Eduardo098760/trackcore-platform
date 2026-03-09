"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStats } from "@/types";
import {
  Car,
  Radio,
  AlertTriangle,
  Users,
  Navigation,
  CircleStop,
  ShieldBan,
  CalendarClock,
} from "lucide-react";
import { useTenant } from "@/lib/hooks/useTenant";
import { useTenantColors } from "@/lib/hooks/useTenantColors";

interface StatsCardsProps {
  stats?: DashboardStats;
  showPrimary?: boolean;
  showSecondary?: boolean;
}

export function StatsCards({ stats, showPrimary = true, showSecondary = true }: StatsCardsProps) {
  if (!stats) return null;
  const { tenant } = useTenant();
  const colors = useTenantColors();

  const cards = [
    {
      title: "Total de Veículos",
      value: stats.devices.total,
      description: `${stats.devices.online} online`,
      icon: Car,
      gradient: "from-blue-600 to-cyan-600",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      glow: "shadow-blue-500/20",
      dynamic: true,
    },
    {
      title: "Veículos Online",
      value: stats.devices.online,
      description: `${stats.devices.offline} offline`,
      icon: Radio,
      gradient: "from-green-600 to-emerald-600",
      iconBg: "bg-green-500/10",
      iconColor: "text-green-500",
      glow: "shadow-green-500/20",
    },
    {
      title: "Alertas Ativos",
      value: stats.activeAlerts,
      description: "Requerem atenção",
      icon: AlertTriangle,
      gradient: "from-yellow-600 to-orange-600",
      iconBg: "bg-yellow-500/10",
      iconColor: "text-yellow-500",
      glow: "shadow-yellow-500/20",
    },
    {
      title: "Clientes",
      value: stats.clients,
      description: "Clientes cadastrados",
      icon: Users,
      gradient: "from-purple-600 to-pink-600",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-500",
      glow: "shadow-purple-500/20",
      dynamic: true,
    },
  ];

  const secondaryCards = [
    {
      title: "Em Movimento",
      value: stats.devices.moving,
      description: `${stats.devices.total > 0 ? Math.round((stats.devices.moving / stats.devices.total) * 100) : 0}% da frota`,
      icon: Navigation,
      gradient: "from-sky-600 to-blue-600",
      iconBg: "bg-sky-500/10",
      iconColor: "text-sky-500",
      glow: "shadow-sky-500/20",
    },
    {
      title: "Parados",
      value: stats.devices.stopped,
      description: `${stats.devices.total > 0 ? Math.round((stats.devices.stopped / stats.devices.total) * 100) : 0}% da frota`,
      icon: CircleStop,
      gradient: "from-amber-600 to-yellow-600",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      glow: "shadow-amber-500/20",
    },
    {
      title: "Bloqueados",
      value: stats.devices.blocked,
      description: stats.devices.blocked > 0 ? "Atenção necessária" : "Nenhum bloqueado",
      icon: ShieldBan,
      gradient: "from-red-600 to-rose-600",
      iconBg: "bg-red-500/10",
      iconColor: "text-red-500",
      glow: "shadow-red-500/20",
    },
    {
      title: "Eventos Hoje",
      value: stats.eventsToday,
      description: "Nas últimas 24h",
      icon: CalendarClock,
      gradient: "from-indigo-600 to-violet-600",
      iconBg: "bg-indigo-500/10",
      iconColor: "text-indigo-500",
      glow: "shadow-indigo-500/20",
    },
  ];

  const renderCard = (card: typeof cards[number], index: number) => {
    let gradientStyle = {};
    let iconBgClass = card.iconBg;
    let iconColorClass = card.iconColor;
    let glowClass = card.glow;

    if (card.dynamic) {
      gradientStyle = {
        backgroundImage: `linear-gradient(to right, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`,
      };
      iconBgClass = "bg-white/10";
      iconColorClass = "opacity-70";
      glowClass = "";
    }

    return (
      <Card
        key={index}
        className={`relative overflow-hidden backdrop-blur-xl bg-white/80 dark:bg-gray-950/80 border-white/20 shadow-lg ${glowClass} hover:shadow-xl transition-all duration-300 group`}
      >
        <div
          className={`absolute top-0 right-0 w-24 h-24 ${!card.dynamic ? `bg-gradient-to-br ${card.gradient}` : ""} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`}
          style={card.dynamic ? gradientStyle : {}}
        ></div>
        <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 relative z-10">
          <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {card.title}
          </CardTitle>
          {(() => {
            const Icon = card.icon;
            return (
              <div
                className={`p-2 rounded-lg ${iconBgClass} group-hover:scale-110 transition-transform`}
                style={
                  card.dynamic ? { backgroundColor: `hsla(${colors.primary.light}, 0.1)` } : {}
                }
              >
                <Icon
                  className={`w-4 h-4 ${iconColorClass}`}
                  style={card.dynamic ? { color: `hsl(${colors.primary.light})` } : {}}
                />
              </div>
            );
          })()}
        </CardHeader>
        <CardContent className="relative z-10 pb-4 px-4 pt-0">
          <div
            className={`text-2xl font-bold ${!card.dynamic ? `bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent` : "text-white"}`}
            style={card.dynamic ? { color: `hsl(${colors.primary.light})` } : {}}
          >
            {card.value}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{card.description}</p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      {showPrimary && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {cards.map(renderCard)}
        </div>
      )}
      {showSecondary && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {secondaryCards.map(renderCard)}
        </div>
      )}
    </div>
  );
}
