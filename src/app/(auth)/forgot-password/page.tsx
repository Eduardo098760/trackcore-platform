"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { requestPasswordReset } from "@/lib/api/auth";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { getTenantServerUrl } from "@/config/tenants";

const STORAGE_KEY = "traccar-server";
const COOKIE_NAME = "traccar-server";

function saveServer(url: string) {
  if (typeof window === "undefined") return;
  const clean = url.replace(/\/+$/, "");
  try {
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean);
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(clean)};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    }
  } catch {}
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    saveServer(getTenantServerUrl());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Não foi possível enviar o email de recuperação.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell title="Recuperar senha" description="Solicitação enviada com sucesso">
        <div className="space-y-5">
          <div className="flex justify-center">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-center text-green-500">
            Se o email existir na base, você receberá as instruções de recuperação em instantes.
          </div>
          <Button onClick={() => router.push("/login")} className="w-full h-12 rounded-xl">
            Voltar para o login
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Recuperar senha" description="Digite seu email para receber instruções de recuperação">
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

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-xl">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full h-12 rounded-xl" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            "Enviar instruções"
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full h-12 rounded-xl"
          onClick={() => router.push("/login")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para o login
        </Button>
      </form>
    </AuthShell>
  );
}
