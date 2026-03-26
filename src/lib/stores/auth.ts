import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { User, Organization } from "@/types";
import { isPwaInstalled } from "@/lib/pwa-utils";

interface AdminSnapshot {
  user: User;
  token: string;
  email: string | null;
  password: string | null;
  organization: Organization | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  organization: Organization | null;
  email: string | null;
  password: string | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
  // Impersonação real: admin entra como outro usuário sem sair
  isImpersonating: boolean;
  adminSnapshot: AdminSnapshot | null;
  setAuth: (
    user: User,
    token: string,
    organization?: Organization,
    email?: string,
    password?: string,
    rememberMe?: boolean,
  ) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  getCredentials: () => { email: string | null; password: string | null };
  startImpersonation: (target: User) => void;
  stopImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      organization: null,
      email: null,
      password: null,
      isAuthenticated: false,
      rememberMe: false,
      isImpersonating: false,
      adminSnapshot: null,
      setAuth: (user, token, organization, email, password, rememberMe = true) => {
        // Em modo PWA, sempre persistir credenciais para manter sessão permanente
        const effectiveRememberMe = isPwaInstalled() ? true : rememberMe;
        console.log("Salvando autenticação:", {
          email,
          rememberMe: effectiveRememberMe,
          pwa: isPwaInstalled(),
          organization: organization?.name,
        });
        set({
          user,
          token,
          organization: organization || null,
          email: effectiveRememberMe ? email : null,
          password: effectiveRememberMe ? password : null,
          isAuthenticated: true,
          rememberMe: effectiveRememberMe,
          // Se setAuth for chamado manualmente fora da impersonação, reseta o estado
          isImpersonating: false,
          adminSnapshot: null,
        });
      },
      setUser: (user) => {
        // Se estiver em impersonação, não permite sobrescrever com dados do Traccar
        if (get().isImpersonating) {
          console.log("[AuthStore] setUser ignorado durante impersonação");
          return;
        }
        console.log("[AuthStore] setUser:", user.name, "| role:", user.role);
        set({ user });
      },
      clearAuth: () => {
        console.log("Limpando autenticação");
        try {
          localStorage.removeItem("inAppNotifications");
          localStorage.removeItem("speedAlerts");
          window.dispatchEvent(new CustomEvent("notificationsCleared"));
          window.dispatchEvent(new CustomEvent("speedAlertsCleared"));
        } catch (_) {}
        set({
          user: null,
          token: null,
          organization: null,
          email: null,
          password: null,
          isAuthenticated: false,
          rememberMe: false,
          isImpersonating: false,
          adminSnapshot: null,
        });
      },
      getCredentials: () => ({
        email: get().email,
        password: get().password,
      }),
      startImpersonation: (target: User) => {
        const { user, token, email, password, organization } = get();
        if (!user || !token) {
          console.warn("[AuthStore] startImpersonation: sem usuário admin autenticado");
          return;
        }
        console.log("[AuthStore] Iniciando impersonação como:", target.name);
        // Salva snapshot do admin para restaurar depois
        const snapshot: AdminSnapshot = { user, token, email, password, organization };
        // Token fake para o usuário alvo (não é usado para chamadas Traccar — o cookie admin continua)
        const targetToken = btoa(
          JSON.stringify({ userId: target.id, email: target.email, impersonated: true }),
        );
        // Limpa dados visuais do admin
        try {
          localStorage.removeItem("inAppNotifications");
          localStorage.removeItem("speedAlerts");
          window.dispatchEvent(new CustomEvent("notificationsCleared"));
          window.dispatchEvent(new CustomEvent("speedAlertsCleared"));
        } catch (_) {}
        set({
          isImpersonating: true,
          adminSnapshot: snapshot,
          user: target,
          token: targetToken,
          email: target.email,
          password: null,
          isAuthenticated: true,
        });
      },
      stopImpersonation: () => {
        const { adminSnapshot } = get();
        if (!adminSnapshot) {
          console.warn("[AuthStore] stopImpersonation: sem snapshot de admin");
          return;
        }
        console.log(
          "[AuthStore] Encerrando impersonação, voltando ao admin:",
          adminSnapshot.user.name,
        );
        // Limpa dados do usuário impersonado
        try {
          localStorage.removeItem("inAppNotifications");
          localStorage.removeItem("speedAlerts");
          window.dispatchEvent(new CustomEvent("notificationsCleared"));
          window.dispatchEvent(new CustomEvent("speedAlertsCleared"));
        } catch (_) {}
        set({
          isImpersonating: false,
          adminSnapshot: null,
          user: adminSnapshot.user,
          token: adminSnapshot.token,
          email: adminSnapshot.email,
          password: adminSnapshot.password,
          organization: adminSnapshot.organization,
          isAuthenticated: true,
        });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
