"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/stores/auth";
import { login, getCurrentUser } from "@/lib/api/auth";

export function useAutoLogin() {
  const { isAuthenticated, user, getCredentials, setAuth, clearAuth } =
    useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const attemptAutoLogin = async () => {
      // Se já está autenticado, refrescar o perfil do Traccar para garantir
      // que a role e demais campos estejam sempre atualizados
      if (isAuthenticated && user) {
        try {
          console.log(
            "[useAutoLogin] Sessão ativa — atualizando perfil do Traccar...",
          );
          const freshUser = await getCurrentUser();
          // Atualiza apenas o objeto user, mantendo token/org/credenciais intactos
          useAuthStore.setState((s) => ({ ...s, user: freshUser }));
          console.log(
            "[useAutoLogin] Perfil atualizado:",
            freshUser.name,
            "| role:",
            freshUser.role,
          );
        } catch (err) {
          // Sessão expirou no Traccar — limpa e redireciona para login
          console.warn(
            "[useAutoLogin] Sessão Traccar expirada, limpando auth...",
          );
          clearAuth();
        } finally {
          setIsLoading(false);
        }
        return;
      }

      const { email, password } = getCredentials();

      // Se não tem credenciais salvas, não pode fazer auto-login
      if (!email || !password) {
        setIsLoading(false);
        return;
      }

      try {
        console.log("[useAutoLogin] Tentando auto-login com", email);
        const response = await login(email, password);
        setAuth(
          response.user,
          response.token,
          undefined,
          email,
          password,
          true,
        );
        console.log(
          "[useAutoLogin] Auto-login bem-sucedido | role:",
          response.user.role,
        );
      } catch (err: any) {
        console.error("[useAutoLogin] Auto-login falhou:", err.message);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    attemptAutoLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isLoading, error };
}
