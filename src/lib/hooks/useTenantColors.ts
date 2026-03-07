"use client";

import { useMemo } from "react";
import { useTenant } from "./useTenant";

/**
 * Hook que retorna paleta de cores dinâmicas baseada no tenant
 * Facilita a aplicação de cores do theme em componentes
 */
export function useTenantColors() {
  const { tenant } = useTenant();

  return useMemo(() => {
    // Extrai os valores HSL da configuração
    const primaryLight = tenant?.colors.primaryLight || "221.2 83.2% 53.3%";
    const primaryForegroundLight = tenant?.colors.primaryForegroundLight || "222.2 47.4% 11.2%";
    const primaryDark = tenant?.colors.primaryDark || "217.2 91.2% 59.8%";
    const primaryForegroundDark = tenant?.colors.primaryForegroundDark || "0 0% 100%";

    // Cria objetos para uso em inline styles e classes
    return {
      // Valores HSL puros
      primary: {
        light: primaryLight,
        foregroundLight: primaryForegroundLight,
        dark: primaryDark,
        foregroundDark: primaryForegroundDark,
      },

      // Cores para uso em styles inline
      inline: {
        // Light mode
        primaryLight: `hsl(${primaryLight})`,
        primaryForegroundLight: `hsl(${primaryForegroundLight})`,
        // Dark mode
        primaryDark: `hsl(${primaryDark})`,
        primaryForegroundDark: `hsl(${primaryForegroundDark})`,
        // Variações com transparência
        primaryLightTr10: `hsla(${primaryLight}, 0.1)`,
        primaryLightTr20: `hsla(${primaryLight}, 0.2)`,
        primaryLightTr50: `hsla(${primaryLight}, 0.5)`,
        primaryDarkTr10: `hsla(${primaryDark}, 0.1)`,
        primaryDarkTr20: `hsla(${primaryDark}, 0.2)`,
      },

      // Gradientes comuns
      gradients: {
        primary: `linear-gradient(135deg, hsl(${primaryLight}), hsl(${primaryDark}))`,
        primaryToTransparent: `linear-gradient(135deg, hsl(${primaryLight}), transparent)`,
      },

      // Shadows
      shadows: {
        primary: `0 0 40px hsla(${primaryLight}, 0.4)`,
        primarySm: `0 0 20px hsla(${primaryLight}, 0.2)`,
      },

      // Borders
      borders: {
        primary: `1px solid hsl(${primaryLight})`,
        primaryLight: `1px solid hsla(${primaryLight}, 0.3)`,
      },
    };
  }, [tenant]);
}
