'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Map,
  Car,
  History,
  Bell,
  Users,
  Building2,
  Settings,
  MapPin,
  Terminal,
  Shield,
  FileText,
  BellRing,
  FolderTree,
  CalendarDays,
  Calculator,
  Gauge,
  BarChart3,
  Video,
  Camera,
  AlertTriangle,
  Route
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Mapa', href: '/map', icon: Map },
  { name: 'Rotas', href: '/routes', icon: Route },
  { name: 'Veículos', href: '/vehicles', icon: Car },
  { name: 'Histórico', href: '/history', icon: History },
  { name: 'Eventos', href: '/events', icon: Bell },
  { name: 'Comandos', href: '/commands', icon: Terminal },
];

const videoTelemetry = [
  { name: 'VideoTelemetria', href: '/video', icon: Video },
  { name: 'Alertas de Vídeo', href: '/video-alerts', icon: AlertTriangle },
  { name: 'Câmeras', href: '/cameras', icon: Camera },
];

const advanced = [
  { name: 'Cercas Eletrônicas', href: '/geofences', icon: Shield },
  { name: 'Notificações', href: '/notifications', icon: BellRing },
  { name: 'Relatórios', href: '/reports', icon: FileText },
  { name: 'Grupos', href: '/groups', icon: FolderTree },
  { name: 'Calendários', href: '/calendars', icon: CalendarDays },
  { name: 'Atributos Computados', href: '/computed-attributes', icon: Calculator },
  { name: 'Computador de Bordo', href: '/obd', icon: Gauge },
  { name: 'Estatísticas', href: '/statistics', icon: BarChart3 },
];

const management = [
  { name: 'Clientes', href: '/clients', icon: Building2 },
  { name: 'Usuários', href: '/users', icon: Users },
  { name: 'Logs de Auditoria', href: '/audit', icon: Shield },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActiveRoute = (href: string) => {
    if (!pathname) return false;
    // exact match or nested route match (ex: /vehicles/123 should keep /vehicles active)
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const linkClassName = (active: boolean) =>
    cn(
      'relative flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 group overflow-hidden outline-none',
      'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0',
      active
        ? 'bg-white/10 text-white border border-white/10'
        : 'text-gray-300 hover:text-white hover:bg-white/5'
    );

  const iconClassName = (active: boolean) =>
    cn(
      'w-5 h-5 mr-3 relative z-10 transition-transform duration-200 group-hover:scale-110',
      active && 'text-white'
    );

  return (
    // Sidebar recolhida (w-16) e expande (w-64) no hover, ajustando o layout ao redor
    <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="group/sidebar flex flex-col h-full w-16 hover:w-64 transition-[width] duration-200 ease-out border-r border-white/10 bg-gradient-to-b from-gray-900 via-gray-950 to-black dark:from-gray-950 dark:via-black dark:to-gray-950 backdrop-blur-xl overflow-hidden">
        {/* Logo */}
        <div className="relative flex items-center h-16 px-4 border-b border-white/10">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5"></div>
          <div className="relative flex items-center space-x-3">
            <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-lg shadow-blue-500/50">
              <MapPin className="w-6 h-6 text-white" />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/50 to-purple-400/50 rounded-lg blur-lg"></div>
            </div>
            <div className="opacity-0 translate-x-[-6px] pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-hover/sidebar:pointer-events-auto transition-all duration-200">
              <h1 className="text-lg font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent whitespace-nowrap">Nova Web</h1>
              <p className="text-xs text-blue-400 whitespace-nowrap">GPS Tracking Pro</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-600/50 scrollbar-track-transparent">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.name}
                  title={item.name}
                  className={cn(
                    linkClassName(isActive),
                    'justify-center group-hover/sidebar:justify-start'
                  )}
                >
                  <item.icon className={cn(iconClassName(isActive), 'mr-0 group-hover/sidebar:mr-3')} />
                  <span className="relative z-10 opacity-0 w-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 whitespace-nowrap">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          <Separator className="my-4 hidden group-hover/sidebar:block" />

          <div className="space-y-1">
            <p className="px-3 text-xs font-semibold text-purple-400/70 uppercase tracking-wider mb-2 hidden group-hover/sidebar:block">
              VideoTelemetria
            </p>
            {videoTelemetry.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.name}
                  title={item.name}
                  className={cn(
                    linkClassName(isActive),
                    'justify-center group-hover/sidebar:justify-start'
                  )}
                >
                  <item.icon className={cn(iconClassName(isActive), 'mr-0 group-hover/sidebar:mr-3')} />
                  <span className="relative z-10 opacity-0 w-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 whitespace-nowrap">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          <Separator className="my-4 hidden group-hover/sidebar:block" />

          <div className="space-y-1">
            <p className="px-3 text-xs font-semibold text-purple-400/70 uppercase tracking-wider mb-2 hidden group-hover/sidebar:block">
              Recursos Avançados
            </p>
            {advanced.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.name}
                  title={item.name}
                  className={cn(
                    linkClassName(isActive),
                    'justify-center group-hover/sidebar:justify-start'
                  )}
                >
                  <item.icon className={cn(iconClassName(isActive), 'mr-0 group-hover/sidebar:mr-3')} />
                  <span className="relative z-10 opacity-0 w-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 whitespace-nowrap">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          <Separator className="my-4 hidden group-hover/sidebar:block" />

          <div className="space-y-1">
            <p className="px-3 text-xs font-semibold text-blue-400/70 uppercase tracking-wider mb-2 hidden group-hover/sidebar:block">
              Gerenciamento
            </p>
            {management.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.name}
                  title={item.name}
                  className={cn(
                    linkClassName(isActive),
                    'justify-center group-hover/sidebar:justify-start'
                  )}
                >
                  <item.icon className={cn(iconClassName(isActive), 'mr-0 group-hover/sidebar:mr-3')} />
                  <span className="relative z-10 opacity-0 w-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 whitespace-nowrap">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="relative p-4 border-t border-white/10">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 to-transparent"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center text-xs text-gray-400">
              <div className="relative">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <div className="absolute inset-0 bg-green-500 rounded-full blur-md animate-pulse"></div>
              </div>
              <span className="font-medium opacity-0 w-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 whitespace-nowrap">Sistema Online</span>
            </div>
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
