'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardStats } from '@/types';
import { Car, Radio, AlertTriangle, Users } from 'lucide-react';

interface StatsCardsProps {
  stats?: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) return null;

  const cards = [
    {
      title: 'Total de Veículos',
      value: stats.devices.total,
      description: `${stats.devices.online} online`,
      icon: Car,
      gradient: 'from-blue-600 to-cyan-600',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      glow: 'shadow-blue-500/20',
    },
    {
      title: 'Veículos Online',
      value: stats.devices.online,
      description: `${stats.devices.offline} offline`,
      icon: Radio,
      gradient: 'from-green-600 to-emerald-600',
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-500',
      glow: 'shadow-green-500/20',
    },
    {
      title: 'Alertas Ativos',
      value: stats.activeAlerts,
      description: 'Requerem atenção',
      icon: AlertTriangle,
      gradient: 'from-yellow-600 to-orange-600',
      iconBg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-500',
      glow: 'shadow-yellow-500/20',
    },
    {
      title: 'Clientes',
      value: stats.clients,
      description: 'Clientes cadastrados',
      icon: Users,
      gradient: 'from-purple-600 to-pink-600',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      glow: 'shadow-purple-500/20',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card key={index} className={`relative overflow-hidden backdrop-blur-xl bg-white/80 dark:bg-gray-950/80 border-white/20 shadow-xl ${card.glow} hover:shadow-2xl transition-all duration-300 group`}>
          <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.gradient} opacity-10 blur-3xl group-hover:opacity-20 transition-opacity`}></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {card.title}
            </CardTitle>
            {(() => {
              const Icon = card.icon;
              return (
                <div className={`p-3 rounded-xl ${card.iconBg} group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              );
            })()}
          </CardHeader>
          <CardContent className="relative z-10">
            <div className={`text-4xl font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
              {card.value}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
