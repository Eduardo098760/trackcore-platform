"use client";

import { useEffect, useState } from "react";
import {
  TenantConfig,
  getTenantConfig,
  getAllTenantSlugs,
  normalizeHostname,
} from "@/config/tenants";

/**
 * Hook para detectar e obter configuração do tenant atual
 * Baseado no hostname completo (ex: sv02.rastrear.app.br, www.sv02.rastrear.app.br)
 * Fallback automático para sv02.rastrear.app.br
 */
export function useTenant(): {
  tenant: TenantConfig;
  slug: string;
  isLoading: boolean;
  isReady: boolean;
} {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [slug, setSlug] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Só executar no client lado
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    try {
      // Pegar hostname inteiro (ex: sv02.rastrear.app.br, www.sv02.rastrear.app.br)
      const fullHostname = window.location.hostname;

      // Normalizar (remover www, porta)
      const detectedSlug = normalizeHostname(fullHostname);

      // Validar se slug existe
      const allSlugs = getAllTenantSlugs();
      if (!allSlugs.includes(detectedSlug) && detectedSlug !== "localhost") {
        console.warn(
          `[useTenant] Hostname "${detectedSlug}" não existe. Usando fallback "sv02.rastrear.app.br".`,
        );
      }

      const config = getTenantConfig(fullHostname);

      setSlug(detectedSlug);
      setTenant(config);

      console.log(`[useTenant] ✓ Tenant detectado: ${config.companyName} (${detectedSlug})`);
    } catch (error) {
      console.error("[useTenant] Erro ao detectar tenant:", error);
      // Fallback
      setSlug("sv02.rastrear.app.br");
      setTenant(getTenantConfig("sv02.rastrear.app.br"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    tenant: tenant || getTenantConfig("sv02.rastrear.app.br"),
    slug,
    isLoading,
    isReady: tenant !== null,
  };
}

/**
 * Hook para obter apenas o slug do tenant atual
 */
export function useTenantSlug(): string {
  const { slug } = useTenant();
  return slug;
}

/**
 * Hook para obter apenas a config do tenant atual
 */
export function useTenantConfig(): TenantConfig {
  const { tenant } = useTenant();
  return tenant;
}
