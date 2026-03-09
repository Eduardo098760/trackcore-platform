"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTenant } from "@/lib/hooks/useTenant";
import { useTenantColors } from "@/lib/hooks/useTenantColors";
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
  Route,
  KeyRound,
  Wrench,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/lib/hooks/usePermissions";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { name: "Mapa", href: "/map", icon: Map, key: "map" },
  { name: "Rotas", href: "/routes", icon: Route, key: "routes" },
  { name: "Veículos", href: "/vehicles", icon: Car, key: "vehicles" },
  { name: "Histórico", href: "/history", icon: History, key: "history" },
  { name: "Eventos", href: "/events", icon: Bell, key: "events" },
  { name: "Comandos", href: "/commands", icon: Terminal, key: "commands" },
];

const videoTelemetry = [
  { name: "VideoTelemetria", href: "/video", icon: Video, key: "video" },
  { name: "Alertas de Vídeo", href: "/video-alerts", icon: AlertTriangle, key: "videoAlerts" },
  { name: "Câmeras", href: "/cameras", icon: Camera, key: "cameras" },
];

const advanced = [
  { name: "Cercas Eletrônicas", href: "/geofences", icon: Shield, key: "geofences" },
  { name: "Notificações", href: "/notifications", icon: BellRing, key: "notifications" },
  { name: "Relatórios", href: "/reports", icon: FileText, key: "reports" },
  { name: "Grupos", href: "/groups", icon: FolderTree, key: "groups" },
  { name: "Calendários", href: "/calendars", icon: CalendarDays, key: "calendars" },
  {
    name: "Atributos Computados",
    href: "/computed-attributes",
    icon: Calculator,
    key: "computedAttributes",
  },
  { name: "Computador de Bordo", href: "/obd", icon: Gauge, key: "obd" },
  { name: "Estatísticas", href: "/statistics", icon: BarChart3, key: "statistics" },
  { name: "Manutenção", href: "/maintenance", icon: Wrench, key: "maintenance" },
];

const management = [
  { name: "Clientes", href: "/clients", icon: Building2, key: "clients" },
  { name: "Usuários", href: "/users", icon: Users, key: "users" },
  { name: "Logs de Auditoria", href: "/audit", icon: Shield, key: "audit" },
  { name: "Configurações", href: "/settings", icon: Settings, key: "settings" },
  { name: "Controle de Acesso", href: "/access-control", icon: KeyRound, key: "accessControl" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const { tenant } = useTenant();
  const colors = useTenantColors();

  // Filtra os itens de cada grupo baseado nas permissões do usuário
  const visibleNavigation = navigation.filter((i) => can(i.key as any));
  const visibleVideo = videoTelemetry.filter((i) => can(i.key as any));
  const visibleAdvanced = advanced.filter((i) => can(i.key as any));
  const visibleManagement = management.filter((i) => can(i.key as any));
  const isActiveRoute = (href: string) => {
    if (!pathname) return false;
    // exact match or nested route match (ex: /vehicles/123 should keep /vehicles active)
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const linkClassName = (active: boolean) =>
    cn(
      "relative flex items-center px-2 group-hover/sidebar:px-3 py-3 text-sm font-medium rounded-lg transition-colors duration-200 group overflow-hidden outline-none",
      "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0",
      active
        ? "bg-white/10 text-white border border-white/10"
        : "text-gray-300 hover:text-white hover:bg-white/5",
    );

  const iconClassName = (active: boolean) =>
    cn(
      // Bigger in collapsed mode, smaller when expanded (hover)
      "w-6 h-6 group-hover/sidebar:w-5 group-hover/sidebar:h-5 mr-3 relative z-10 transition-transform duration-200 group-hover:scale-110",
      active && "text-white",
    );

  return (
    // Sidebar recolhida (w-16) e expande (w-64) no hover, ajustando o layout ao redor
    <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="group/sidebar flex flex-col h-full w-20 hover:w-64 transition-[width] duration-200 ease-out border-r border-white/[0.06] bg-gradient-to-b from-gray-900 via-gray-950 to-black dark:from-gray-950 dark:via-black dark:to-gray-950 backdrop-blur-xl overflow-hidden">
        {/* Logo */}
        <div className="relative flex items-center justify-center h-14 border-b border-white/[0.06]">
          {/* Logo fechado (collapsed) */}
          <div className="relative flex items-center justify-center w-full h-full group-hover/sidebar:opacity-0 group-hover/sidebar:scale-95 transition-all duration-200">
            <Image
              src={tenant?.faviconUrl || "/logos/rastrear-favicon.ico"}
              alt="Logo compacta"
              width={48}
              height={48}
              className="drop-shadow-lg"
            />
          </div>

          {/* Logo expandida (expanded) */}
          <div className="absolute inset-0 px-4 opacity-0 translate-x-[-6px] pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-hover/sidebar:pointer-events-auto transition-all duration-200 flex items-center justify-center">
            <Image
              src={tenant?.logoUrl || "/logos/rastrear-logo.svg"}
              alt={tenant?.companyName || "Logo"}
              width={180}
              height={48}
              className="drop-shadow-lg"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto sidebar-scrollbar scrollbar-thin scrollbar-thumb-blue-600/50 scrollbar-track-transparent">
          <div className="space-y-1">
            {visibleNavigation.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.name}
                  title={item.name}
                  className={cn(
                    linkClassName(isActive),
                    "justify-center group-hover/sidebar:justify-start",
                  )}
                >
                  <item.icon
                    strokeWidth={2.25}
                    className={cn(iconClassName(isActive), "mr-0 group-hover/sidebar:mr-3")}
                  />
                  <span className="relative z-10 opacity-0 w-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 whitespace-nowrap">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          {visibleVideo.length > 0 && (
            <>
              <Separator className="my-4 hidden group-hover/sidebar:block" />
              <div className="space-y-1">
                <p
                  className="px-3 text-xs font-semibold uppercase tracking-wider mb-2 hidden group-hover/sidebar:block opacity-70"
                  style={{ color: `hsl(${colors.primary.light})` }}
                >
                  VideoTelemetria
                </p>
                {visibleVideo.map((item) => {
                  const isActive = isActiveRoute(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.name}
                      title={item.name}
                      className={cn(
                        linkClassName(isActive),
                        "justify-center group-hover/sidebar:justify-start",
                      )}
                    >
                      <item.icon
                        strokeWidth={2.25}
                        className={cn(iconClassName(isActive), "mr-0 group-hover/sidebar:mr-3")}
                      />
                      <span className="relative z-10 opacity-0 w-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 whitespace-nowrap">
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {visibleAdvanced.length > 0 && (
            <>
              <Separator className="my-4 hidden group-hover/sidebar:block" />
              <div className="space-y-1">
                <p
                  className="px-3 text-xs font-semibold uppercase tracking-wider mb-2 hidden group-hover/sidebar:block opacity-70"
                  style={{ color: `hsl(${colors.primary.light})` }}
                >
                  Recursos Avançados
                </p>
                {visibleAdvanced.map((item) => {
                  const isActive = isActiveRoute(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.name}
                      title={item.name}
                      className={cn(
                        linkClassName(isActive),
                        "justify-center group-hover/sidebar:justify-start",
                      )}
                    >
                      <item.icon
                        strokeWidth={2.25}
                        className={cn(iconClassName(isActive), "mr-0 group-hover/sidebar:mr-3")}
                      />
                      <span className="relative z-10 opacity-0 w-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 whitespace-nowrap">
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {visibleManagement.length > 0 && (
            <>
              <Separator className="my-4 hidden group-hover/sidebar:block" />
              <div className="space-y-1">
                <p className="px-3 text-xs font-semibold text-blue-400/70 uppercase tracking-wider mb-2 hidden group-hover/sidebar:block">
                  Gerenciamento
                </p>
                {visibleManagement.map((item) => {
                  const isActive = isActiveRoute(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.name}
                      title={item.name}
                      className={cn(
                        linkClassName(isActive),
                        "justify-center group-hover/sidebar:justify-start",
                      )}
                    >
                      <item.icon
                        strokeWidth={2.25}
                        className={cn(iconClassName(isActive), "mr-0 group-hover/sidebar:mr-3")}
                      />
                      <span className="relative z-10 opacity-0 w-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 whitespace-nowrap">
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
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
              <span className="font-medium opacity-0 w-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 whitespace-nowrap">
                Sistema Online
              </span>
            </div>
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
