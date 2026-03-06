# 🛠️ Guia Técnico: Implementação Detalhada

## Arquitetura Técnica Completa

### 1. Camadas da Solução

```
┌──────────────────────────────────┐
│    UI Layer (Componentes)        │
│ - TenantBranding                 │
│ - TenantThemeInjector            │
└────────────┬─────────────────────┘
             │
┌────────────▼──────────────────────┐
│  Hooks Layer                      │
│ - useTenant()                     │ Client-side detection
│ - useTenantSlug()                 │
│ - useTenantConfig()               │
└────────────┬──────────────────────┘
             │
┌────────────▼──────────────────────┐
│  Business Logic Layer             │
│ - getTenantConfig(slug)           │
│ - extractTenantSlugFromHeaders()  │ Server-side detection
│ - generateTenantMetadata()        │
│ - generateTenantColorsCSS()       │
└────────────┬──────────────────────┘
             │
┌────────────▼──────────────────────┐
│  Configuration Layer              │
│ - TENANTS_CONFIG                  │
│ - TenantConfig interface          │
└───────────────────────────────────┘
```

---

## 2. Fluxo de Dados - Detalhado

### Primeira Requisição (SSR)

```
HTTP Request: GET /dashboard
Headers: { Host: 'rastrear.trackcore.com', ... }
    │
    ▼
[Server] layout.tsx
    │
    ├─ generateTenantMetadata() 
    │  └─ Retorna metadados para <head>
    │
    ├─ generateTenantColorsCSS()
    │  └─ Gera inline CSS com cores do tenant
    │  └─ Injeta em <style> no <head>
    │
    ▼
HTML Response (com cores já injetadas)
    │
    ├─ <style>:root { --primary: hsl(270, 100%, 45%); }</style>
    ├─ <link rel="icon" href="/logos/rastrear/favicon.ico">
    ├─ <title>Dashboard | Rastrear Frota</title>
    └─ <Providers> (React components)
    
    ▼
[Browser] Renderiza HTML
    │
    ├─ CSS variables aplicadas ✓ (sem flash!)
    ├─ Favicon carregado ✓
    └─ React hidrata
    
    ▼
[Client] useEffect do useTenant()
    │
    ├─ window.location.hostname = 'rastrear.trackcore.com'
    ├─ Detecta slug: 'rastrear'
    ├─ Armazena em estado
    └─ TenantThemeInjector detecta tema do sistema
    
    ▼
[Client] useEffect do TenantThemeInjector
    │
    ├─ Deteta: theme === 'system' ? black/white : light/dark
    ├─ Atualiza CSS variables para modo noturno (se ativo)
    └─ document.documentElement.style.setProperty('--primary', ...)
    
    ▼
Página renderizada com cores corretas ✓
```

### Mudança de Tema (Light ↔ Dark)

```
User clica: "Toggle Dark Mode"
    │
    ▼
next-themes emite evento
    │
    ▼
useTheme() hook retorna novo { theme, systemTheme }
    │
    ▼
TenantThemeInjector useEffect é acionado
    │
    ├─ Lê novo theme value
    ├─ Determina isDark
    ├─ Busca cores corretas de tenant.colors
    ├─ CSS variables atualizadas:
    │  ├─ setProperty('--primary', tenant.colors.primaryDark)
    │  └─ setProperty('--primary-foreground', tenant.colors.primaryForegroundDark)
    │
    ▼
Tailwind CSS re-computa classes com novas variáveis
    │
    ▼
UI atualiza em tempo real ✓
```

### Mudança de Subdomain

```
User navega: rastrear.trackcore.com → logistica.trackcore.com
    │
    ▼
window.location.hostname muda
    │
    ▼
useTenant useEffect detecta mudança (via listener?)
Não! Apenas re-detecta ao montar.
┌─ Para rotas internas: Subdomain não muda, logo nada ocorre
└─ Para navegação real: Page reload → Novo HTML da logistica ✓
```

---

## 3. Funções Chave - Implementação

### extractTenantSlugFromHeaders()

```typescript
/**
 * Extrai slug do tenant do header Host
 * IMPORTANTE: É assíncrono! headers() retorna Promise
 */
export async function extractTenantSlugFromHeaders(): Promise<string> {
  const headersList = await headers();
  const hostname = headersList.get('host') || '';

  // Casos especiais: localhost / 127.0.0.1
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'rastrear'; // default para desenvolvimento
  }

  // Extrair subdomínio
  const parts = hostname.split('.');
  
  // Format: {subdomain}.{domain}.{tld}
  // Partes: ['rastrear', 'trackcore', 'com']
  // Se > 2 partes, primeira é o subdomain
  
  if (parts.length > 2) {
    return parts[0]; // 'rastrear' | 'transportadora' | etc
  }

  // Fallback: apenas domínio base
  return 'rastrear';
}

// Uso:
// const slug = await extractTenantSlugFromHeaders();
// const tenant = getTenantConfig(slug);
```

### getTenantConfig()

```typescript
/**
 * Obtém configuração do tenant com fallback
 * Se não encontrar, usa tenant default
 */
export function getTenantConfig(slug?: string): TenantConfig {
  if (!slug || !(slug in TENANTS_CONFIG)) {
    return TENANTS_CONFIG['rastrear']; // default
  }
  return TENANTS_CONFIG[slug];
}

// Uso:
// getTenantConfig('rastrear') → retorna config purple
// getTenantConfig('logistica') → retorna config green
// getTenantConfig('invalido') → retorna config purple (default)
// getTenantConfig() → retorna config purple (default)
```

### generateTenantColorsCSS()

```typescript
/**
 * Gera string CSS com variáveis do tenant
 * Sícrono porque não precisa de dados externos
 */
export function generateTenantColorsCSS(slug: string = 'rastrear'): string {
  const tenant = getTenantConfig(slug);

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

// Retorna:
// :root {
//   --primary: hsl(270, 100%, 45%);
//   --primary-foreground: hsl(0, 0%, 100%);
// }
// .dark {
//   --primary: hsl(270, 100%, 65%);
//   --primary-foreground: hsl(0, 0%, 0%);
// }
```

---

## 4. Component: TenantThemeInjector

```typescript
'use client'; // Client component

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useTenant } from '@/lib/hooks/useTenant';

/**
 * Injeta CSS variables do tenant dinâmicamente
 * Responde a mudanças de tema (light/dark)
 * 
 * Workflow:
 * 1. useTenant detecta subdomain → loads tenant config
 * 2. useTheme detecta preferência do usuário (system/light/dark)
 * 3. useEffect combina ambos e aplica cores
 */
export function TenantThemeInjector() {
  const { tenant, isLoading } = useTenant();
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    // Aguarda carregamento do tenant
    if (isLoading || !tenant) return;

    // Determina qual tema efetivamente está ativo
    // Se usuário escolheu 'system', usa a preferência do SO
    const activeTheme = theme === 'system' ? systemTheme : theme;
    const isDark = activeTheme === 'dark';

    // Acessa elemento raiz do HTML
    const root = document.documentElement;

    // Aplica cores corretas baseado no tema ativo
    if (isDark) {
      root.style.setProperty('--primary', tenant.colors.primaryDark);
      root.style.setProperty('--primary-foreground', tenant.colors.primaryForegroundDark);
    } else {
      root.style.setProperty('--primary', tenant.colors.primaryLight);
      root.style.setProperty('--primary-foreground', tenant.colors.primaryForegroundLight);
    }
  }, [tenant, theme, systemTheme, isLoading]);

  // Este componente não renderiza nada, apenas aplica estilos
  return null;
}

// Uso em Providers:
// <QueryClientProvider>
//   <ThemeProvider>
//     <TenantThemeInjector /> ← Coloca aqui
//     {children}
//   </ThemeProvider>
// </QueryClientProvider>
```

---

## 5. Hook: useTenant

```typescript
'use client';

import { useEffect, useState } from 'react';
import { TenantConfig, getTenantConfig } from '@/config/tenants';

interface UseTenantReturn {
  tenant: TenantConfig | null;
  slug: string;
  isLoading: boolean;
}

export function useTenant(): UseTenantReturn {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [slug, setSlug] = useState<string>('rastrear');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      // Obtém hostname do navegador
      const hostname = window.location.hostname;
      const parts = hostname.split('.');

      let detectedSlug = 'rastrear'; // default

      // Se não é localhost, tenta extrair subdomínio
      if (hostname !== 'localhost' && hostname !== '127.0.0.1' && parts.length > 2) {
        detectedSlug = parts[0];
      }

      // console.log(`[TENANT] Detected: ${detectedSlug} from ${hostname}`);

      setSlug(detectedSlug);
      setTenant(getTenantConfig(detectedSlug));
    } catch (error) {
      console.error('[TENANT] Error detecting tenant:', error);
      setSlug('rastrear');
      setTenant(getTenantConfig('rastrear'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { tenant, slug, isLoading };
}

// Hooks auxiliares
export function useTenantSlug(): string {
  const { slug } = useTenant();
  return slug;
}

export function useTenantConfig(): TenantConfig | null {
  const { tenant } = useTenant();
  return tenant;
}

// Uso em componentes:
// function MyComponent() {
//   const { tenant, slug, isLoading } = useTenant();
//
//   if (isLoading) return <div>Carregando...</div>;
//   if (!tenant) return <div>Erro ao carregar tenant</div>;
//
//   return (
//     <div style={{ --primary: tenant.colors.primaryLight }}>
//       Logo: {tenant.logoUrl}
//       Empresa: {tenant.companyName}
//     </div>
//   );
// }
```

---

## 6. Component: TenantBranding

```typescript
'use client';

import Image from 'next/image';
import { useTenant } from '@/lib/hooks/useTenant';
import { Skeleton } from '@/components/ui/skeleton';

type BrandingVariant = 'icon' | 'text' | 'full';

interface TenantBrandingProps {
  variant?: BrandingVariant;
}

export function TenantBranding({ variant = 'full' }: TenantBrandingProps) {
  const { tenant, isLoading } = useTenant();

  if (isLoading) return <Skeleton className="h-8 w-32" />;
  if (!tenant) return <div className="text-xs text-muted-foreground">Erro ao carregar</div>;

  // Renderiza apenas logo
  if (variant === 'icon') {
    return (
      <Image
        src={tenant.logoUrl}
        alt={tenant.companyName}
        width={40}
        height={40}
        className="h-8 w-8"
      />
    );
  }

  // Renderiza apenas texto
  if (variant === 'text') {
    return <span className="text-sm font-semibold">{tenant.companyName}</span>;
  }

  // Renderiza logo + texto (full)
  return (
    <div className="flex items-center gap-2">
      <Image
        src={tenant.logoUrl}
        alt={tenant.companyName}
        width={40}
        height={40}
        className="h-8 w-8"
      />
      <span className="text-sm font-semibold">{tenant.companyName}</span>
    </div>
  );
}

// Variantes compactas
export function TenantBrandingCompact() {
  return <TenantBranding variant="icon" />;
}

export function TenantBrandingFull() {
  const { tenant, isLoading } = useTenant();

  if (isLoading) return <Skeleton className="h-10 w-40" />;
  if (!tenant) return null;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <Image
        src={tenant.logoUrl}
        alt={tenant.companyName}
        width={60}
        height={60}
        className="h-12 w-12"
      />
      <span className="font-bold text-center text-sm">{tenant.companyName}</span>
    </div>
  );
}

// Uso:
// <header>
//   <TenantBrandingCompact /> {/* Só logo no header */}
// </header>
//
// <aside>
//   <TenantBrandingFull /> {/* Logo + texto no sidebar */}
// </aside>
```

---

## 7. Integração no layout.tsx

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "@/components/providers";
import { generateTenantMetadata, generateTenantColorsCSS } from "@/lib/tenant-metadata";

const inter = Inter({ subsets: ["latin"] });

// Metadados dinâmicos (favicon, title, description)
export const metadata: Metadata = generateTenantMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // CSS variables do tenant (evita flash de cor errada)
  const tenantColorsCSS = generateTenantColorsCSS();

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* CSS variables injetados aqui - SSR */}
        <style>{tenantColorsCSS}</style>
      </head>
      <body className={inter.className}>
        {/* Providers incluem TenantThemeInjector */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## 8. Integração em providers.tsx

```typescript
'use client';

import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { queryClient } from '@/lib/query-client';
import { TenantThemeInjector } from '@/components/tenant-theme-injector';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="theme-preference"
      >
        {/* Injeta CSS variables do tenant dinamicamente */}
        <TenantThemeInjector />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

---

## 9. Cascata de CSS

### Como os CSS variables funcionam

```css
/* 1. Definidos no SSR (aplicados imediatamente) */
:root {
  --primary: hsl(270, 100%, 45%);
  --primary-foreground: hsl(0, 0%, 100%);
}

.dark {
  --primary: hsl(270, 100%, 65%);
  --primary-foreground: hsl(0, 0%, 0%);
}

/* 2. Usados no Tailwind (input) */
.bg-primary {
  background-color: hsl(var(--primary));
}

.text-primary-foreground {
  color: hsl(var(--primary-foreground));
}

/* 3. Dinamicamente atualizados pelo TenantThemeInjector */
document.documentElement.style.setProperty('--primary', 'hsl(120, 70%, 45%)');

/* 4. Resultado final (CSS compilado) */
.bg-primary {
  background-color: hsl(120, 70%, 45%); ← Cor do logistica tenant
}
```

---

## 10. Debugging

### Verificar Tenant Detectado

```javascript
// No DevTools Console
window.location.hostname
// 'rastrear.trackcore.com'

// Extrair manualmente
const parts = window.location.hostname.split('.');
parts[0]; // 'rastrear'
```

### Verificar CSS Variables

```javascript
// No DevTools Console
const root = document.documentElement;
getComputedStyle(root).getPropertyValue('--primary');
// 'hsl(270, 100%, 45%)'

// Mudar dinamicamente
root.style.setProperty('--primary', 'hsl(0, 100%, 50%)');
// Vermelha agora!
```

### Verificar Tema Ativo

```javascript
// Com next-themes
const html = document.documentElement;
html.classList.contains('dark'); // true | false

// Manualmente checar preferência do SO
window.matchMedia('(prefers-color-scheme: dark)').matches;
// true = dark mode, false = light mode
```

### Logs de Debug

Adicione em `.env.local`:
```
NEXT_PUBLIC_TENANT_DEBUG=true
```

Use em hooks:
```typescript
if (process.env.NEXT_PUBLIC_TENANT_DEBUG) {
  console.log(`[TENANT] Detected: ${slug} from ${hostname}`);
  console.log(`[TENANT] Colors:`, tenant.colors);
}
```

---

## Referências

- **Next.js Headers:** https://nextjs.org/docs/app/api-reference/functions/headers
- **Next.js Metadata:** https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- **Tailwind CSS Variables:** https://tailwindcss.com/docs/customizing-colors
- **next-themes:** https://github.com/pacocoursey/next-themes
- **CSS Variables (MDN):** https://developer.mozilla.org/en-US/docs/Web/CSS/--*

---

**Última atualização:** 5 de março de 2026
