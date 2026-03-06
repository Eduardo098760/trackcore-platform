"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, Shield, Wifi, BarChart3, Map, CheckCircle2 } from "lucide-react";
import { getDevices, getPositions } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth";
import { useTenant } from "@/lib/hooks/useTenant";

const STEPS = [
  { icon: Shield, message: "Validando sessão...", duration: 700 },
  { icon: Wifi, message: "Conectando ao servidor...", duration: 700 },
  { icon: Map, message: "Carregando veículos...", duration: 900 },
  { icon: BarChart3, message: "Preparando dashboard...", duration: 700 },
  { icon: CheckCircle2, message: "Tudo pronto!", duration: 500 },
];

const MIN_SPLASH_MS = 3500;

export default function SplashPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { tenant } = useTenant();
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef(Date.now());

  /* Redireciona se não autenticado */
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  /* Prefetch dos dados críticos em paralelo */
  useEffect(() => {
    if (!isAuthenticated) return;

    const prefetch = async () => {
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: ["devices"],
          queryFn: () => getDevices(),
        }),
        queryClient.prefetchQuery({
          queryKey: ["positions"],
          queryFn: () => getPositions(),
        }),
      ]);
    };

    prefetch();
  }, [isAuthenticated, queryClient]);

  /* Animação dos steps */
  useEffect(() => {
    if (stepIndex >= STEPS.length) return;

    const timer = setTimeout(() => {
      setStepIndex((prev) => prev + 1);
      setProgress(Math.round(((stepIndex + 1) / STEPS.length) * 100));
    }, STEPS[stepIndex].duration);

    return () => clearTimeout(timer);
  }, [stepIndex]);

  /* Quando todos os steps terminarem, aguarda o mínimo e redireciona */
  useEffect(() => {
    if (stepIndex < STEPS.length) return;

    const elapsed = Date.now() - startRef.current;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);

    const timer = setTimeout(() => {
      setDone(true);
      setTimeout(() => router.replace("/dashboard"), 300);
    }, remaining);

    return () => clearTimeout(timer);
  }, [stepIndex, router]);

  const currentStep = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const StepIcon = currentStep.icon;

  return (
    <div
      className={`
        fixed inset-0 flex flex-col items-center justify-center
        bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900
        transition-opacity duration-300
        ${done ? "opacity-0" : "opacity-100"}
      `}
    >
      {/* Decoração de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ backgroundColor: `hsl(${tenant?.colors.primaryLight})` }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ backgroundColor: `hsl(${tenant?.colors.primaryLight})` }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5" />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="flex items-center gap-3">
          <div
            className="relative flex items-center justify-center w-16 h-16 rounded-2xl text-white shadow-lg"
            style={{
              backgroundColor: `hsl(${tenant?.colors.primaryLight})`,
              boxShadow: `0 0 40px hsl(${tenant?.colors.primaryLight})/40`,
            }}
          >
            <MapPin className="w-8 h-8 text-white" strokeWidth={2.5} />
            {/* Ping animado */}
            <span
              className="absolute inset-0 rounded-2xl animate-ping opacity-30"
              style={{ backgroundColor: `hsl(${tenant?.colors.primaryLight})` }}
            />
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="w-64 flex flex-col gap-3">
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: `hsl(${tenant?.colors.primaryLight})`,
              }}
            />
          </div>

          {/* Status atual */}
          <div className="flex items-center justify-center gap-2 text-sm min-h-[24px] text-white opacity-75">
            <StepIcon className="w-4 h-4 shrink-0 animate-pulse" />
            <span className="transition-all duration-300">{currentStep.message}</span>
          </div>
        </div>

        {/* Dots de loading */}
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor:
                  i < stepIndex
                    ? `hsl(${tenant?.colors.primaryLight})`
                    : i === stepIndex
                      ? `hsl(${tenant?.colors.primaryLight})`
                      : "rgba(255,255,255,0.2)",
                transform: i < stepIndex || i === stepIndex ? "scale(1.25)" : "scale(1)",
                animation:
                  i === stepIndex ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Versão */}
      <p className="absolute bottom-6 text-white/20 text-xs tracking-widest uppercase">
        v1.0 · {new Date().getFullYear()}
      </p>
    </div>
  );
}
