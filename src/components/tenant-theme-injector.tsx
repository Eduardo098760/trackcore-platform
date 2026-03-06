"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useTenant } from "@/lib/hooks/useTenant";

/**
 * Componente que injeta as CSS variables do tenant dinamicamente
 * Aplicando cores primárias diferentes baseado no tema (light/dark) e tenant
 */
export function TenantThemeInjector() {
  const { tenant, isLoading } = useTenant();
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    // Aguardar até tenant ser carregado
    if (isLoading || !tenant) {
      return;
    }

    // Determinar tema atual (respeitando sistema se "system")
    const activeTheme = theme === "system" ? systemTheme : theme;
    const isDark = activeTheme === "dark";

    // Aplicar cores primárias do tenant
    const root = document.documentElement;

    if (isDark) {
      // Dark mode
      root.style.setProperty("--primary", tenant.colors.primaryDark);
      root.style.setProperty("--primary-foreground", tenant.colors.primaryForegroundDark);
    } else {
      // Light mode
      root.style.setProperty("--primary", tenant.colors.primaryLight);
      root.style.setProperty("--primary-foreground", tenant.colors.primaryForegroundLight);
    }

    console.log(
      `[TenantThemeInjector] ✓ Cores aplicadas - ${tenant.companyName} (${isDark ? "Dark" : "Light"})`,
    );
  }, [tenant, theme, systemTheme, isLoading]);

  // Componente não renderiza nada visível
  return null;
}
