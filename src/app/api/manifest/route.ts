import { NextRequest, NextResponse } from "next/server";
import { getTenantConfig, normalizeHostname } from "@/config/tenants";

/**
 * Gera o manifest.json dinamicamente baseado no tenant.
 * Rota: /api/manifest
 */
export async function GET(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const normalized = normalizeHostname(hostname);
  const tenant = getTenantConfig(normalized);

  // Converter cor HSL do tenant para hex para o manifest
  const themeColor = hslToHex(tenant.colors.primaryLight);

  const manifest = {
    name: `${tenant.companyName} - ${tenant.metadata?.title || "Rastreamento Veicular"}`,
    short_name: tenant.companyName,
    description:
      tenant.metadata?.description || `Sistema de rastreamento de frota ${tenant.companyName}`,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#1a1a2e",
    theme_color: themeColor,
    orientation: "any",
    scope: "/",
    launch_handler: {
      client_mode: "navigate-existing",
    },
    handle_links: "preferred",
    icons: [
      {
        src: tenant.pwaIcon192 || "/logos/rastrear-pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: tenant.pwaIcon512 || "/logos/rastrear-pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: tenant.pwaIcon512 || "/logos/rastrear-pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["business", "utilities"],
    lang: "pt-BR",
    prefer_related_applications: false,
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

/** Converte HSL string ("221 100% 50%") para hex */
function hslToHex(hslStr: string): string {
  try {
    const parts = hslStr.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return "#2563eb";
    const h = parseFloat(parts[0]) / 360;
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } catch {
    return "#2563eb";
  }
}
