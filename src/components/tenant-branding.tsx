"use client";

import Image from "next/image";
import { useTenant } from "@/lib/hooks/useTenant";

/**
 * Componente que exibe o branding do tenant (logo + nome)
 * Pode ser usado no header/navbar
 */
export function TenantBranding(): React.ReactElement {
  const { tenant, isLoading } = useTenant();

  if (isLoading) {
    return <div className="h-10 w-32 bg-muted animate-pulse rounded" />;
  }

  return (
    <div className="flex items-center gap-3 font-semibold text-lg">
      <div className="relative w-8 h-8">
        <Image src={tenant.faviconUrl} alt={tenant.companyName} fill className="rounded" />
      </div>
      <span className="hidden sm:inline">{tenant.companyName}</span>
    </div>
  );
}

/**
 * Versão compacta apenas com o favicon
 */
export function TenantBrandingCompact(): React.ReactElement {
  const { tenant, isLoading } = useTenant();

  if (isLoading) {
    return <div className="h-10 w-10 bg-muted animate-pulse rounded" />;
  }

  return (
    <div className="relative w-10 h-10">
      <Image
        src={tenant.faviconUrl}
        alt={tenant.companyName}
        fill
        className="rounded"
        title={tenant.companyName}
      />
    </div>
  );
}

/**
 * Versão com nome completo
 */
export function TenantBrandingFull(): React.ReactElement {
  const { tenant, isLoading } = useTenant();

  if (isLoading) {
    return <div className="h-12 w-48 bg-muted animate-pulse rounded" />;
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-12 h-12">
        <Image src={tenant.faviconUrl} alt={tenant.companyName} fill className="rounded" />
      </div>
      <div>
        <p className="font-semibold text-base">{tenant.companyName}</p>
        <p className="text-xs text-muted-foreground">{tenant.slug}</p>
      </div>
    </div>
  );
}
