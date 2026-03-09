"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth";
import { useTenant } from "@/lib/hooks/useTenant";
import { useTenantColors } from "@/lib/hooks/useTenantColors";
import { Loader2, MapPin, ArrowRight, QrCode, X, Camera, Globe } from "lucide-react";

/* ─── Helpers de servidor ─── */

const STORAGE_KEY = "traccar-server";
const COOKIE_NAME = "traccar-server";

function getSavedServer(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
}

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

/** Normaliza URL garantindo protocolo */
function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/+$/, "");
}

/* ─── QR Code Scanner (usa API nativa do navegador ou fallback com camera) ─── */

function QrScanner({ onScan, onClose }: { onScan: (data: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(true);
  const animFrameRef = useRef<number>(0);

  const stopCamera = useCallback(() => {
    setScanning(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanFrame();
        }
      } catch {
        if (mounted) setError("Não foi possível acessar a câmera");
      }
    }

    function scanFrame() {
      if (!scanning || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // @ts-expect-error BarcodeDetector API
      if (typeof window.BarcodeDetector !== "undefined") {
        // @ts-expect-error BarcodeDetector API
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        detector
          .detect(canvas)
          .then((codes: { rawValue: string }[]) => {
            if (codes.length > 0 && codes[0].rawValue) {
              stopCamera();
              onScan(codes[0].rawValue);
            } else {
              animFrameRef.current = requestAnimationFrame(scanFrame);
            }
          })
          .catch(() => {
            animFrameRef.current = requestAnimationFrame(scanFrame);
          });
      } else {
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    }

    startCamera();
    return () => { mounted = false; stopCamera(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold">Escanear QR Code</h3>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="relative bg-black aspect-[4/3]">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 p-6 text-center">
              <Camera className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">{error}</p>
              <p className="text-xs text-white/50 mt-2">Verifique as permissões da câmera no navegador</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/50 rounded-2xl" />
              </div>
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="px-5 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Aponte para o QR Code do servidor Traccar
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverInput, setServerInput] = useState("");
  const [showQr, setShowQr] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const colors = useTenantColors();

  const serverReady = !!normalizeUrl(serverInput);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const url = normalizeUrl(serverInput);
    if (!url) {
      setError("Informe o endereço do servidor");
      return;
    }

    // Salva o servidor antes de tentar login
    saveServer(url);
    setLoading(true);

    try {
      const response = await login(email, password);
      queryClient.clear();
      setAuth(response.user, response.token, response.organization, email, password, rememberMe);
      router.push("/splash");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleQrScan = (data: string) => {
    setShowQr(false);
    const url = normalizeUrl(data);
    if (url) {
      setServerInput(url);
      saveServer(url);
    }
  };

  useEffect(() => {
    const saved = getSavedServer();
    setServerInput(saved || "http://sv01.rastrear.app.br");
    if (!saved) saveServer("http://sv01.rastrear.app.br");
    const { email: savedEmail } = useAuthStore.getState().getCredentials();
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {showQr && <QrScanner onScan={handleQrScan} onClose={() => setShowQr(false)} />}

      {/* Coluna esquerda - Welcome (desktop) */}
      <div
        className="hidden lg:flex lg:w-[42%] relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-72 h-72 rounded-3xl bg-white/30 rotate-12 translate-x-1/4" />
          <div className="absolute w-56 h-56 rounded-3xl bg-white/20 -rotate-6 -translate-x-1/4 translate-y-1/4" />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center px-12 text-left w-full [color:hsl(var(--primary-foreground))]">
          <div className="w-full max-w-xs flex flex-col items-center">
            {tenant?.faviconUrl ? (
              <div className="relative w-40 h-40 mb-8 flex items-center justify-center">
                {/* Logo central */}
                <Image
                  src={tenant.faviconUrl}
                  alt={tenant.companyName || "Logo"}
                  width={72}
                  height={72}
                  className="object-contain drop-shadow-lg brightness-0 invert relative z-10"
                  priority
                />
                {tenant.slug === "sv02.rastrear.app.br" && (
                  <>
                    {/* Anel orbital com brilho */}
                    <div className="absolute inset-1 rounded-full border border-white/10" />
                    <div className="absolute inset-1 rounded-full" style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.08) 25%, transparent 50%)' }} />

                    {/* Satélite principal - órbita circular */}
                    <div className="absolute inset-1 animate-[orbit_10s_linear_infinite]">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.5)]" />
                      </div>
                    </div>

                    {/* Segundo ponto - órbita contrária, maior */}
                    <div className="absolute -inset-1 animate-[orbit_16s_linear_infinite_reverse]">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="w-1.5 h-1.5 bg-white/40 rounded-full shadow-[0_0_6px_1px_rgba(255,255,255,0.3)]" />
                      </div>
                    </div>

                    {/* Brilho radiante sutil ao redor da logo */}
                    <div className="absolute inset-6 rounded-full bg-white/5 blur-md animate-pulse" />
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 mb-8">
                <MapPin className="w-10 h-10 text-inherit" strokeWidth={2} />
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight">
              {tenant.companyName}
            </h1>
            <p className="text-white/95 text-base mt-2 font-normal">{tenant?.metadata?.title || "Plataforma de rastreamento"}</p>
          </div>
        </div>
      </div>

      {/* Mobile: barra superior com marca */}
      <div
        className="lg:hidden flex items-center justify-center gap-2 py-5 px-4 w-full shrink-0 [color:hsl(var(--primary-foreground))]"
        style={{
          background: `linear-gradient(135deg, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`,
        }}
      >
        {tenant?.faviconUrl ? (
          <div className="relative w-32 h-8">
            <Image
              src={tenant.faviconUrl}
              alt={tenant.companyName || "Logo"}
              fill
              className="object-contain brightness-0 invert"
              priority
            />
          </div>
        ) : (
          <MapPin className="w-8 h-8 text-inherit" strokeWidth={2} />
        )}
        <div className="flex flex-col">
          <span className="text-xl font-bold">{tenant.companyName}</span>
          <span className="text-xs text-white/80">{tenant?.metadata?.description || "Plataforma de rastreamento"}</span>
        </div>
      </div>

      {/* Coluna direita - Formulário */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-muted/80 min-h-0">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-xl p-8 sm:p-10 border border-border">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">Entrar</h2>
              <p className="text-muted-foreground text-sm mt-1">Informe o servidor e suas credenciais</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Servidor - campo obrigatório */}
              <div className="space-y-1.5">
                <Label htmlFor="server" className="text-xs font-medium text-muted-foreground">
                  Servidor
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="server"
                      type="url"
                      placeholder="http://servidor:8082"
                      value={serverInput}
                      onChange={(e) => setServerInput(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 rounded-xl bg-muted border-0 pl-10 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl shrink-0"
                    onClick={() => setShowQr(true)}
                    title="Escanear QR Code"
                    disabled={loading}
                  >
                    <QrCode className="w-5 h-5" />
                  </Button>
                </div>
              </div>

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
                disabled={loading || !serverReady}
                style={{
                  background: serverReady
                    ? `linear-gradient(to right, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`
                    : undefined,
                }}
                className={`w-full h-12 rounded-xl font-semibold text-white hover:shadow-lg transition-shadow focus-visible:ring-2 focus-visible:ring-ring border-0 shadow-md ${
                  !serverReady ? "bg-muted-foreground/40 cursor-not-allowed" : ""
                }`}
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
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            © {new Date().getFullYear()} Track Core. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
