/**
 * Configuração de Tenants (Multi-Tenant Theme Platform)
 *
 * Cada tenant tem sua própria identidade visual:
 * - Cores primárias (light e dark)
 * - Logo e ícone
 * - Nome da empresa
 *
 * Fallback padrão: "rastrear"
 */

export interface TenantConfig {
  /** ID único do tenant */
  id: string;

  /** Nome da empresa */
  companyName: string;

  /** Slug para subdomínio (ex: rastrear.trackcore.com) */
  slug: string;

  /** URL do logo */
  logoUrl: string;

  /** URL do favicon/ícone */
  faviconUrl: string;

  /** Cores primárias em HSL */
  colors: {
    /** Light mode - Primary */
    primaryLight: string; // "221.2 83.2% 53.3%"

    /** Light mode - Primary Foreground */
    primaryForegroundLight: string; // "210 40% 98%"

    /** Dark mode - Primary */
    primaryDark: string; // "217.2 91.2% 59.8%"

    /** Dark mode - Primary Foreground */
    primaryForegroundDark: string; // "222.2 47.4% 11.2%"
  };

  /** Dados adicionais */
  metadata?: {
    title?: string;
    description?: string;
    website?: string;
  };
}

/**
 * MAPA DE TENANTS
 * Organize por slug do subdomínio
 */
export const TENANTS_CONFIG: Record<string, TenantConfig> = {
  rastrear: {
    id: "1",
    companyName: "Rastrear",
    slug: "rastrear",
    logoUrl: "/logos/rastrear-logo.svg",
    faviconUrl: "/logos/rastrear-favicon.ico",
    colors: {
      primaryLight: "221.2 83.2% 53.3%", // Roxo azulado
      primaryForegroundLight: "210 40% 98%",
      primaryDark: "217.2 91.2% 59.8%",
      primaryForegroundDark: "222.2 47.4% 11.2%",
    },
    metadata: {
      title: "Rastrear - Plataforma de Rastreamento Veicular",
      description: "Sistema completo de rastreamento de frota em tempo real",
      website: "https://rastrear.trackcore.com",
    },
  },

  // Client 1 - Exemplo
  transportadora: {
    id: "2",
    companyName: "Transportadora ABC",
    slug: "transportadora",
    logoUrl: "/logos/transportadora-logo.svg",
    faviconUrl: "/logos/transportadora-favicon.ico",
    colors: {
      primaryLight: "24 96% 53%", // Laranja
      primaryForegroundLight: "210 40% 98%",
      primaryDark: "24 96% 63%",
      primaryForegroundDark: "222.2 47.4% 11.2%",
    },
    metadata: {
      title: "Transportadora ABC - Rastreamento",
      description: "Sistema de rastreamento para frota da Transportadora ABC",
      website: "https://transportadora.trackcore.com",
    },
  },

  // Client 2 - Exemplo
  logistica: {
    id: "3",
    companyName: "Logística DEF",
    slug: "logistica",
    logoUrl: "/logos/logistica-logo.svg",
    faviconUrl: "/logos/logistica-favicon.ico",
    colors: {
      primaryLight: "142 72% 43%", // Verde
      primaryForegroundLight: "210 40% 98%",
      primaryDark: "142 72% 53%",
      primaryForegroundDark: "210 40% 98%",
    },
    metadata: {
      title: "Logística DEF - Rastreamento",
      description: "Plataforma de rastreamento para Logística DEF",
      website: "https://logistica.trackcore.com",
    },
  },

  // Client 3 - Exemplo
  delivery: {
    id: "4",
    companyName: "DeliveryFast",
    slug: "delivery",
    logoUrl: "/logos/delivery-logo.svg",
    faviconUrl: "/logos/delivery-favicon.ico",
    colors: {
      primaryLight: "3 100% 61%", // Vermelho
      primaryForegroundLight: "210 40% 98%",
      primaryDark: "3 100% 71%",
      primaryForegroundDark: "222.2 47.4% 11.2%",
    },
    metadata: {
      title: "DeliveryFast - Rastreamento",
      description: "Sistema de rastreamento em tempo real para entregas",
      website: "https://delivery.trackcore.com",
    },
  },
};

/**
 * Obtém a configuração do tenant pelo slug
 * Com fallback automático para "rastrear" se não encontrada
 */
export function getTenantConfig(slug?: string): TenantConfig {
  if (!slug || !(slug in TENANTS_CONFIG)) {
    console.warn(`[Tenant] Slug "${slug}" não encontrado. Usando fallback "rastrear".`);
    return TENANTS_CONFIG.rastrear;
  }
  return TENANTS_CONFIG[slug];
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
