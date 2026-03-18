"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth";
import { getCurrentUser, login } from "@/lib/api/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { RouteGuard } from "@/components/layout/route-guard";
import { useEventNotifications } from "@/lib/hooks/useEventNotifications";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { WhatsAppButton } from "@/components/whatsapp-button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isAuthenticated,
    user: storedUser,
    setAuth,
    setUser,
    clearAuth,
    getCredentials,
    rememberMe,
    isImpersonating,
  } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);

  // Ativar monitoramento de eventos do Traccar para notificações
  useEventNotifications(isAuthenticated && !isValidating);

  const isMapRoute =
    !!pathname &&
    (pathname === "/map" ||
      pathname.startsWith("/map/") ||
      pathname === "/replay" ||
      pathname.startsWith("/replay/") ||
      pathname === "/geofences" ||
      pathname.startsWith("/geofences/"));

  useEffect(() => {
    const validateSession = async () => {
      // ⚡ Em modo de impersonação, não validar sessão Traccar:
      // getCurrentUser() retornaria o admin e sobrescreveria o usuário impersonado.
      // O cookie Traccar do admin continua válido para todas as chamadas de API.
      if (isImpersonating) {
        setIsValidating(false);
        return;
      }

      if (!isAuthenticated) {
        // Aguarda re-hidratação do estado persistido antes de forçar logout
        const hasPersist =
          typeof window !== "undefined" &&
          !!localStorage.getItem("auth-storage");
        if (!hasPersist) {
          console.log("Não autenticado e sem persistência, redirecionando...");
          router.push("/login");
          setIsValidating(false);
          return;
        }
        console.log(
          "Estado não autenticado, mas há dados persistidos — tentando validar sessão...",
        );
      } else {
        console.log("Usuário autenticado, verificando sessão...");
      }

      try {
        // Verifica se a sessão do Traccar ainda é válida
        const freshUser = await getCurrentUser();
        console.log(
          "Sessão válida:",
          freshUser.email,
          "| role:",
          freshUser.role,
        );
        // Atualiza o user no store com dados frescos (corrige role, etc.)
        if (storedUser && freshUser.role !== storedUser.role) {
          console.log(
            `[Layout] Role atualizada: ${storedUser.role} → ${freshUser.role}`,
          );
        }
        setUser(freshUser);
        setIsValidating(false);
      } catch (error) {
        console.log("Erro ao validar sessão:", error);

        // Tenta re-autenticar automaticamente
        const { email, password } = getCredentials();

        if (email && password && rememberMe) {
          console.log("Tentando re-autenticar com credenciais salvas...");
          try {
            const response = await login(email, password);
            console.log("Re-autenticação bem-sucedida");
            setAuth(
              response.user,
              response.token,
              undefined,
              email,
              password,
              true,
            );
            setIsValidating(false);
          } catch (reloginError) {
            console.error("Re-autenticação falhou:", reloginError);
            clearAuth();
            router.push("/login");
          }
        } else {
          console.log("Sem credenciais salvas, fazendo logout");
          clearAuth();
          router.push("/login");
        }
      }
    };

    validateSession();

    // Renova a sessão a cada 15 minutos (menos agressivo)
    const interval = setInterval(
      async () => {
        try {
          await getCurrentUser();
          console.log("Sessão renovada");
        } catch (error) {
          console.log("Erro ao renovar sessão, tentando re-login...");
          const { email, password } = getCredentials();
          if (email && password && rememberMe) {
            try {
              await login(email, password);
              console.log("Re-login automático bem-sucedido");
            } catch (e) {
              console.error("Re-login falhou");
            }
          }
        }
      },
      15 * 60 * 1000,
    ); // 15 minutos

    return () => clearInterval(interval);
  }, [
    isAuthenticated,
    isImpersonating,
    router,
    setAuth,
    clearAuth,
    getCredentials,
    rememberMe,
  ]);

  if (!isAuthenticated || isValidating) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            Verificando sessão...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ServiceWorkerRegistrar />
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main
          className={
            isMapRoute
              ? "flex-1 overflow-hidden p-0 bg-theme-background"
              : "flex-1 overflow-y-auto p-6 bg-theme-background"
          }
        >
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
      <WhatsAppButton />
    </div>
  );
}
