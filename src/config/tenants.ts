/**
 * Configuração de Tenants (Multi-Tenant Theme Platform)
 *
 * Configuração atual: Um único tenant como fallback universal
 * - sv02.rastrear.app.br (fallback para todos os hostnames)
 *
 * Cada tenant tem sua própria identidade visual:
 * - Cores primárias (light e dark)
 * - Logo e ícone
 * - Nome da empresa
 * - Server URL (opcional)
 */

export interface TenantConfig {
  /** ID único do tenant */
  id: string;

  /** Nome da empresa */
  companyName: string;

  /** Slug usando hostname completo (ex: rastrear.app.br, meuapp.rastrear.app.br) */
  slug: string;

  /** URL do logo */
  logoUrl: string;

  /** URL do favicon/ícone */
  faviconUrl: string;

  /** Cores primárias em HSL */
  colors: {
    /** Light mode - Primary */
    primaryLight: string;

    /** Light mode - Primary Foreground */
    primaryForegroundLight: string;

    /** Dark mode - Primary */
    primaryDark: string;

    /** Dark mode - Primary Foreground */
    primaryForegroundDark: string;
  };

  /** Dados adicionais */
  metadata?: {
    title?: string;
    description?: string;
    website?: string;
    serverUrl?: string;
  };
}

/**
 * MAPA DE TENANTS
 * Apenas um tenant único como fallback universal
 */
export const TENANTS_CONFIG: Record<string, TenantConfig> = {
  "sv02.rastrear.app.br": {
    id: "1",
    companyName: "Rastrear",
    slug: "sv02.rastrear.app.br",
    logoUrl: "/logos/rastrear-logo-light.webp", // Usar logo claro por padrão, o dark mode ajustará via CSS
    faviconUrl: "/logos/rastrear-icone-light.png",
    colors: {
      primaryLight: process.env.NEXT_PUBLIC_PRIMARY_LIGHT || "270 100% 50%",
      primaryForegroundLight:
        process.env.NEXT_PUBLIC_PRIMARY_FOREGROUND_LIGHT || "222.2 47.4% 11.2%",
      primaryDark: process.env.NEXT_PUBLIC_PRIMARY_DARK || "270 85% 65%",
      primaryForegroundDark: process.env.NEXT_PUBLIC_PRIMARY_FOREGROUND_DARK || "0 0% 100%",
    },
    metadata: {
      title: "Rastrear - Plataforma de Rastreamento Veicular",
      description: "Sistema completo de rastreamento de frota em tempo real",
      website: "https://sv02.rastrear.app.br",
      serverUrl: "http://sv01.rastrear.app.br",
    },
  },
  "sv03.rastrear.app.br": {
    id: "1",
    companyName: "Rastrear",
    slug: "sv02.rastrear.app.br",
    logoUrl: "/logos/rastrear-logo-light.webp", // Usar logo claro por padrão, o dark mode ajustará via CSS
    faviconUrl: "/logos/rastrear-icone-light.png",
    colors: {
      primaryLight: "270 100% 50%",
      primaryForegroundLight: "222.2 47.4% 11.2%",
      primaryDark: "270 85% 65%",
      primaryForegroundDark: "0 0% 100%",
    },
    metadata: {
      title: "Rastrear - Plataforma de Rastreamento Veicular",
      description: "Sistema completo de rastreamento de frota em tempo real",
      website: "https://sv02.rastrear.app.br",
      serverUrl: "http://sv01.rastrear.app.br",
    },
  },
};

/**
 * Normaliza hostname removendo www e porta
 * Exemplos:
 * - www.sv02.rastrear.app.br:3000 → sv02.rastrear.app.br
 * - localhost:3000 → localhost
 */
export function normalizeHostname(hostname: string): string {
  if (!hostname) return process.env.NEXT_PUBLIC_DEFAULT_TENANT || "sv02.rastrear.app.br";

  // Remove porta (localhost:3000 → localhost)
  const host = hostname.split(":")[0];

  // Remove www.
  if (host.startsWith("www.")) {
    return host.substring(4);
  }

  return host;
}

/**
 * Obtém a configuração do tenant pelo hostname
 * Com fallback automático para o tenant definido em NEXT_PUBLIC_DEFAULT_TENANT se não encontrada
 *
 * @param hostname - Hostname completo (ex: sv02.rastrear.app.br, www.sv02.rastrear.app.br)
 */
export function getTenantConfig(hostname?: string): TenantConfig {
  if (!hostname) {
    const defaultTenant = process.env.NEXT_PUBLIC_DEFAULT_TENANT || "sv02.rastrear.app.br";
    return TENANTS_CONFIG[defaultTenant] || TENANTS_CONFIG["sv02.rastrear.app.br"];
  }

  // Normalizar hostname (remover www, porta)
  const normalized = normalizeHostname(hostname);

  // Buscar configuração
  if (normalized in TENANTS_CONFIG) {
    return TENANTS_CONFIG[normalized];
  }

  // Fallback especial para localhost em desenvolvimento
  if (normalized === "localhost" || normalized === "127.0.0.1") {
    const defaultTenant = process.env.NEXT_PUBLIC_DEFAULT_TENANT || "sv02.rastrear.app.br";
    return TENANTS_CONFIG[defaultTenant] || TENANTS_CONFIG["sv02.rastrear.app.br"];
  }

  // Fallback: usar padrão
  const defaultTenant = process.env.NEXT_PUBLIC_DEFAULT_TENANT || "sv02.rastrear.app.br";
  console.warn(
    `[Tenant] Hostname "${normalized}" não encontrado. Usando fallback "${defaultTenant}".`,
  );
  return TENANTS_CONFIG[defaultTenant] || TENANTS_CONFIG["sv02.rastrear.app.br"];
}

/**
 * Obtém a URL do servidor para um tenant específico
 * Com fallback para variável de ambiente
 *
 * @param hostname - Hostname do tenant
 * @returns URL do servidor (ex: http://sv01.rastrear.app.br)
 */
export function getTenantServerUrl(hostname?: string): string {
  const tenant = getTenantConfig(hostname);

  // Se tenant tem serverUrl configurado, usar
  if (tenant.metadata?.serverUrl) {
    return tenant.metadata.serverUrl;
  }

  // Fallback para env var
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

/**
 * Lista todos os slugs de tenants (útil para validação)
 */
export function getAllTenantSlugs(): string[] {
  return Object.keys(TENANTS_CONFIG);
}

/**
 * Formata configuração de cores para aplicar as CSS variables
 */
export function formatTenantColors(config: TenantConfig): Record<string, string> {
  return {
    "--primary-light": config.colors.primaryLight,
    "--primary-foreground-light": config.colors.primaryForegroundLight,
    "--primary-dark": config.colors.primaryDark,
    "--primary-foreground-dark": config.colors.primaryForegroundDark,
  };
}
