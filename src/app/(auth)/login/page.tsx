"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { login } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth";
import { useTenantColors } from "@/lib/hooks/useTenantColors";
import { Loader2, ArrowRight } from "lucide-react";
import { getTenantServerUrl } from "@/config/tenants";
import { isPwaInstalled, markPwaAuthenticated } from "@/lib/pwa-utils";

/* ─── Helpers de servidor ─── */

const STORAGE_KEY = "traccar-server";
const COOKIE_NAME = "traccar-server";

function saveServer(url: string) {
  if (typeof window === "undefined") return;
  const clean = url.replace(/\/+$/, "");
  try {
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean);
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(clean)};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    } else {
      localStorage.removeItem(STORAGE_KEY);
      document.cookie = `${COOKIE_NAME}=;path=/;max-age=0`;
    }
  } catch {}
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const queryClient = useQueryClient();
  const colors = useTenantColors();
  const activated = searchParams?.get("activated") === "1";
  const passwordReset = searchParams?.get("reset") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login(email, password);
      queryClient.clear();
      setAuth(response.user, response.token, response.organization, email, password, rememberMe);
      // Marcar que o PWA foi autenticado (evita re-auth forçada no próximo launch)
      if (isPwaInstalled()) {
        markPwaAuthenticated();
      }
      router.push("/splash");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-save server URL from tenant config
    const serverUrl = getTenantServerUrl();
    saveServer(serverUrl);

    const emailFromQuery = searchParams?.get("email");
    const { email: savedEmail } = useAuthStore.getState().getCredentials();
    if (emailFromQuery) {
      setEmail(emailFromQuery);
      setRememberMe(true);
    } else if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, [searchParams]);

  return (
    <AuthShell title="Entrar" description="Informe suas credenciais para acessar">
      {activated && (
        <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-500">
          Senha definida com sucesso. Seu email já foi preenchido para facilitar o login.
        </div>
      )}
      {passwordReset && (
        <div className="mb-5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-500">
          Senha redefinida com sucesso. Faça login com a nova credencial.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="h-12 rounded-xl bg-muted border-0 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
            Senha
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="h-12 rounded-xl bg-muted border-0 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-input bg-background text-primary focus:ring-ring"
                />
          <Label
            htmlFor="rememberMe"
            className="text-sm font-normal cursor-pointer text-muted-foreground"
          >
            Manter-me conectado
          </Label>
        </div>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-xl">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          style={{
            background: `linear-gradient(to right, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`,
          }}
          className="w-full h-12 rounded-xl font-semibold text-white hover:shadow-lg transition-shadow focus-visible:ring-2 focus-visible:ring-ring border-0 shadow-md"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Entrando...
            </>
          ) : (
            <>
              ENTRAR
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>

        <div className="text-center">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Esqueceu sua senha?
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted/80" />}>
      <LoginContent />
    </Suspense>
  );
}
