"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { TenantThemeInjector } from "./tenant-theme-injector";
import { getTenantServerUrl } from "@/config/tenants";

const STORAGE_KEY = "traccar-server";
const COOKIE_NAME = "traccar-server";

function normalizeServerUrl(url: string) {
  return url.replace(/\/+$|\/api\/?$/g, "");
}

function syncTenantServerUrl() {
  if (typeof window === "undefined") return;

  const tenantServerUrl = getTenantServerUrl(window.location.hostname);
  if (!tenantServerUrl) return;

  const normalizedTenantServerUrl = normalizeServerUrl(tenantServerUrl);
  const storedServerUrl = localStorage.getItem(STORAGE_KEY);
  const normalizedStoredServerUrl = storedServerUrl ? normalizeServerUrl(storedServerUrl) : null;

  if (normalizedStoredServerUrl === normalizedTenantServerUrl) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, normalizedTenantServerUrl);
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(normalizedTenantServerUrl)};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;

  if (normalizedStoredServerUrl && normalizedStoredServerUrl !== normalizedTenantServerUrl) {
    localStorage.removeItem("auth-storage");
    localStorage.removeItem("auth_token");
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    syncTenantServerUrl();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TenantThemeInjector />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
