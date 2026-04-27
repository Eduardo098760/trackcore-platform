"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { useTenant } from "@/lib/hooks/useTenant";
import { useTenantColors } from "@/lib/hooks/useTenantColors";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  const { tenant } = useTenant();
  const colors = useTenantColors();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
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
                    <div className="absolute inset-1 rounded-full border border-white/10" />
                    <div
                      className="absolute inset-1 rounded-full"
                      style={{
                        background:
                          "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.08) 25%, transparent 50%)",
                      }}
                    />
                    <div className="absolute inset-1 animate-[orbit_10s_linear_infinite]">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.5)]" />
                      </div>
                    </div>
                    <div className="absolute -inset-1 animate-[orbit_16s_linear_infinite_reverse]">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="w-1.5 h-1.5 bg-white/40 rounded-full shadow-[0_0_6px_1px_rgba(255,255,255,0.3)]" />
                      </div>
                    </div>
                    <div className="absolute inset-6 rounded-full bg-white/5 blur-md animate-pulse" />
                  </>
                )}
              </div>
            ) : tenant?.logoUrl ? (
              <div className="relative w-56 h-20 mb-8">
                <Image
                  src={tenant.logoUrl}
                  alt={tenant.companyName || "Logo"}
                  fill
                  className="object-contain brightness-0 invert drop-shadow-lg"
                  priority
                />
              </div>
            ) : (
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 mb-8">
                <MapPin className="w-10 h-10 text-inherit" strokeWidth={2} />
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight">{tenant.companyName}</h1>
            <p className="text-white/95 text-base mt-2 font-normal">
              {tenant?.metadata?.title || "Plataforma de rastreamento"}
            </p>
          </div>
        </div>
      </div>

      <div
        className="lg:hidden flex items-center justify-center gap-2 py-5 px-4 w-full shrink-0 [color:hsl(var(--primary-foreground))]"
        style={{
          background: `linear-gradient(135deg, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`,
        }}
      >
        {tenant?.faviconUrl ? (
          <div className="relative w-32 h-8">
            <Image src={tenant.faviconUrl} alt={tenant.companyName || "Logo"} fill className="object-contain brightness-0 invert" priority />
          </div>
        ) : (
          <MapPin className="w-8 h-8 text-inherit" strokeWidth={2} />
        )}
        <div className="flex flex-col">
          <span className="text-xl font-bold">{tenant.companyName}</span>
          <span className="text-xs text-white/80">{tenant?.metadata?.description || "Plataforma de rastreamento"}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-muted/80 min-h-0">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-xl p-8 sm:p-10 border border-border">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">{title}</h2>
              <p className="text-muted-foreground text-sm mt-1">{description}</p>
            </div>
            {children}
          </div>
          <div className="text-center text-xs text-muted-foreground mt-4">
            © {new Date().getFullYear()} {tenant.companyName}. Todos os direitos reservados.
          </div>
          {footer}
        </div>
      </div>
    </div>
  );
}