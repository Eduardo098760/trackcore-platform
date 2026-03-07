"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStats } from "@/types";
import { Car, Radio, AlertTriangle, Users } from "lucide-react";
import { useTenant } from "@/lib/hooks/useTenant";
import { useTenantColors } from "@/lib/hooks/useTenantColors";

interface StatsCardsProps {
  stats?: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
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
      dynamic: true, // Usa cores do tenant
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
      gradient: "from-purple-600 to-pink-600", // Fallback
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-500",
      glow: "shadow-purple-500/20",
      dynamic: true, // Usa cores do tenant
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        // Para cards dinâmicos, usar cores do tenant
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
            className={`relative overflow-hidden backdrop-blur-xl bg-white/80 dark:bg-gray-950/80 border-white/20 shadow-xl ${glowClass} hover:shadow-2xl transition-all duration-300 group`}
          >
            <div
              className={`absolute top-0 right-0 w-32 h-32 ${!card.dynamic ? `bg-gradient-to-br ${card.gradient}` : ""} opacity-10 blur-3xl group-hover:opacity-20 transition-opacity`}
              style={card.dynamic ? gradientStyle : {}}
            ></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {card.title}
              </CardTitle>
              {(() => {
                const Icon = card.icon;
                return (
                  <div
                    className={`p-3 rounded-xl ${iconBgClass} group-hover:scale-110 transition-transform`}
                    style={
                      card.dynamic ? { backgroundColor: `hsla(${colors.primary.light}, 0.1)` } : {}
                    }
                  >
                    <Icon
                      className={`w-5 h-5 ${iconColorClass}`}
                      style={card.dynamic ? { color: `hsl(${colors.primary.light})` } : {}}
                    />
                  </div>
                );
              })()}
            </CardHeader>
            <CardContent className="relative z-10">
              <div
                className={`text-4xl font-bold ${!card.dynamic ? `bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent` : "text-white"}`}
                style={card.dynamic ? { color: `hsl(${colors.primary.light})` } : {}}
              >
                {card.value}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
