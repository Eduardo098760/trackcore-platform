"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/lib/hooks/useTenant";
import { useTenantColors } from "@/lib/hooks/useTenantColors";
import { KeyRound, Loader2, MapPin } from "lucide-react";

export default function PrimeiroAcessoPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { tenant } = useTenant();
  const colors = useTenantColors();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const token = typeof params?.token === "string" ? params.token : "";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("A confirmação da senha não confere.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/access-invite/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível concluir o primeiro acesso.");
      }
      router.replace(`/login?email=${encodeURIComponent(data?.email || "")}&activated=1`);
      return;
    } catch (activationError: any) {
      setError(activationError?.message || "Não foi possível concluir o primeiro acesso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/80 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {tenant?.faviconUrl ? (
            <div className="relative w-20 h-20 mx-auto mb-4">
              <Image src={tenant.faviconUrl} alt={tenant.companyName || "Logo"} fill className="object-contain" priority />
            </div>
          ) : (
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 text-white"
              style={{ background: `linear-gradient(135deg, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))` }}
            >
              <MapPin className="w-8 h-8" />
            </div>
          )}
          <h1 className="text-2xl font-bold">{tenant?.companyName || "TrackCore"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina sua senha inicial para acessar a plataforma</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              Primeiro acesso
            </CardTitle>
            <CardDescription>
              Crie a senha que você usará nos próximos acessos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a senha"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || !token}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Definir senha"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}