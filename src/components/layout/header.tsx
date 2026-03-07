"use client";

<<<<<<< HEAD
import { useState, useEffect } from 'react';
import { Bell, Moon, Sun, LogOut, User, Settings, UserCheck, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
=======
import { useState, useEffect } from "react";
import { Search, Bell, Moon, Sun, LogOut, User, Settings, UserCheck, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
>>>>>>> 5cf214c69b62058b234ca94fcc2afde0168fdf87
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
<<<<<<< HEAD
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/lib/stores/auth';

import { ConnectionStatus } from '@/components/ui/connection-status';
import { NotificationBadge } from '@/components/ui/notification-badge';
import { NotificationPanel } from '@/components/layout/notification-panel';
import { useImpersonation } from '@/lib/hooks/useImpersonation';
=======
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/stores/auth";
import { useSearchStore } from "@/lib/stores/search";
import { useTenantColors } from "@/lib/hooks/useTenantColors";
import { ConnectionStatus } from "@/components/ui/connection-status";
import { NotificationBadge } from "@/components/ui/notification-badge";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { useImpersonation } from "@/lib/hooks/useImpersonation";
>>>>>>> 5cf214c69b62058b234ca94fcc2afde0168fdf87

export function Header() {
  const { theme, setTheme } = useTheme();
  const { user, clearAuth, isImpersonating, adminSnapshot } = useAuthStore();
  const { returnToAdmin, loading: impersonationLoading } = useImpersonation();
  const colors = useTenantColors();

  const router = useRouter();
  const queryClient = useQueryClient();
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);

  // Query para buscar notificações não lidas
  const { data: notifications = [] } = useQuery({
    queryKey: ["inAppNotifications"],
    queryFn: async () => {
      const stored = localStorage.getItem("inAppNotifications");
      return stored ? JSON.parse(stored) : [];
    },
    refetchInterval: 10000,
  });

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  // Listener SEMPRE ATIVO (Header nunca desmonta) para atualizar badge e cache
  // assim que uma notificação é criada ou limpada (troca de usuário / logout)
  useEffect(() => {
    const handleNewNotification = () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications"] });
    };
    const handleCleared = () => {
      // Remove imediatamente do cache sem buscar localStorage (já foi apagado)
      queryClient.setQueryData(["inAppNotifications"], []);
    };
    window.addEventListener("notificationAdded", handleNewNotification);
    window.addEventListener("notificationsCleared", handleCleared);
    return () => {
      window.removeEventListener("notificationAdded", handleNewNotification);
      window.removeEventListener("notificationsCleared", handleCleared);
    };
  }, [queryClient]);

  const handleLogout = () => {
    queryClient.clear(); // limpa todo o cache ao sair
    clearAuth();
    router.push("/login");
  };

  const getUserInitials = () => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      manager: "Gerente",
      user: "Usuário",
      readonly: "Somente Leitura",
      deviceReadonly: "Leit. Dispositivos",
      // retrocompat
      superadmin: "Administrador",
      operator: "Usuário",
      client: "Somente Leitura",
    };
    return labels[role] || role;
  };

  return (
    <>
      {/* Banner de impersonação — aparece quando admin entra como outro usuário */}
      {isImpersonating && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-amber-500 text-amber-950 text-sm font-medium z-50">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 shrink-0" />
            <span>
              Você está visualizando como <strong>{user?.name}</strong>
              {adminSnapshot?.user?.name && (
                <span className="font-normal opacity-75"> · Admin: {adminSnapshot.user.name}</span>
              )}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => returnToAdmin()}
            disabled={impersonationLoading}
            className="h-7 px-3 text-xs text-amber-950 hover:bg-amber-400/60 font-semibold gap-1.5"
          >
            {impersonationLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            {impersonationLoading ? "Saindo..." : "Voltar ao Admin"}
          </Button>
        </div>
      )}

<<<<<<< HEAD
    <header className="relative flex items-center justify-end h-16 px-6 bg-gradient-to-r from-gray-900 via-gray-950 to-black dark:from-gray-950 dark:via-black dark:to-gray-950 border-b border-white/10 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5"></div>
=======
      <header className="relative flex items-center justify-between h-16 px-6 bg-gradient-to-r from-gray-900 via-gray-950 to-black dark:from-gray-950 dark:via-black dark:to-gray-950 border-b border-white/10 backdrop-blur-xl">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, hsla(${colors.primary.light}, 0.05), hsla(${colors.primary.light}, 0.05))`,
          }}
        ></div>

        {/* Search */}
        <div className="relative flex-1 max-w-md z-10">
          <div className="relative group">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:transition-colors"
              style={{ color: "var(--tw-100)" }}
            />
            <Input
              type="search"
              placeholder="Buscar veículo, placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:bg-white/10 transition-all focus:ring-2"
              style={
                {
                  "--tw-ring-color": `hsla(${colors.primary.light}, 0.2)`,
                  "--tw-border-opacity": "1",
                  borderColor: `hsla(${colors.primary.light}, 0.5)`,
                } as React.CSSProperties
              }
            />
          </div>
        </div>
>>>>>>> 5cf214c69b62058b234ca94fcc2afde0168fdf87

        {/* Actions */}
        <div className="relative flex items-center space-x-4 z-10">
          {/* Connection Status */}
          <ConnectionStatus />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="relative hover:bg-white/10 text-gray-300 hover:text-white transition-all"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Notifications */}
          <NotificationBadge count={unreadCount} onClick={() => setNotificationPanelOpen(true)} />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full hover:ring-2 transition-all"
                style={{ "--tw-ring-color": `hsl(${colors.primary.light})` } as React.CSSProperties}
              >
                <Avatar
                  className="h-10 w-10 ring-2"
                  style={{ borderColor: `hsla(${colors.primary.light}, 0.3)` }}
                >
                  <AvatarImage src={user?.avatar} alt={user?.name} />
                  <AvatarFallback
                    className="text-white font-bold"
                    style={{
                      background: `linear-gradient(135deg, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`,
                    }}
                  >
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    {user?.role && getRoleLabel(user.role)}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Notification Panel */}
        <NotificationPanel open={notificationPanelOpen} onOpenChange={setNotificationPanelOpen} />
      </header>
    </>
  );
}
