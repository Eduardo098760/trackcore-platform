/**
 * Utilitários para gerenciar metadados do tenant no lado do servidor
 */

import { Metadata } from "next";
import { headers } from "next/headers";
import { getTenantConfig, normalizeHostname } from "@/config/tenants";

/**
 * Extrai o hostname completo do header Host
 * Exemplos:
 * - rastrear.app.br
 * - www.rastrear.app.br → rastrear.app.br
 * - meuapp.rastrear.app.br
 */
export async function extractTenantSlugFromHeaders(): Promise<string> {
  const headersList = await headers();
  const hostname = headersList.get("host") || "";

  // Normalizar hostname (remover www, porta)
  const normalized = normalizeHostname(hostname);

  return normalized;
}

/**
 * Gera metadados da página baseado no tenant
 * Usar em layout.tsx ou pages.tsx
 *
 * Para metadata dinâmico por hostname, use generateDynamicTenantMetadata() em async contexto
 */
export function generateTenantMetadata(hostname: string = "sv02.rastrear.app.br"): Metadata {
  const tenant = getTenantConfig(hostname);

  return {
    title: {
      template: `%s | ${tenant.companyName}`,
      default: tenant.metadata?.title || `${tenant.companyName} - Rastreamento Veicular`,
    },
    description:
      tenant.metadata?.description || `Sistema de rastreamento de frota ${tenant.companyName}`,
    icons: {
      icon: tenant.faviconUrl,
      shortcut: tenant.faviconUrl,
      apple: tenant.faviconUrl,
    },
    openGraph: {
      title: tenant.metadata?.title || `${tenant.companyName} - Rastreamento`,
      description: tenant.metadata?.description || `Sistema de rastreamento de frota`,
      url: tenant.metadata?.website || "https://trackcore.com",
      siteName: tenant.companyName,
      type: "website",
    },
  };
}

/**
 * Gera metadados dinâmico baseado no host/subdomain (async)
 * Use em estruturas de layout que suportam async
 */
export async function generateDynamicTenantMetadata(): Promise<Metadata> {
  const tenantSlug = await extractTenantSlugFromHeaders();
  return generateTenantMetadata(tenantSlug);
}

/**
 * Gera CSS variables para injetar no servidor (SSR)
 * Evita "flash" de cor errada ao carregar
 */
export function generateTenantColorsCSS(hostname: string = "sv02.rastrear.app.br"): string {
  const tenant = getTenantConfig(hostname);

  // Gerar inline styles para aplicar no <html> tag
  return `
    :root {
      --primary: ${tenant.colors.primaryLight};
      --primary-foreground: ${tenant.colors.primaryForegroundLight};
    }

    .dark {
      --primary: ${tenant.colors.primaryDark};
      --primary-foreground: ${tenant.colors.primaryForegroundDark};
    }
  `;
}
