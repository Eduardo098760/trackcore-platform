# 🏢 Arquitetura Multi-Tenant

## Visão Geral

O sistema TrackCore implementa um modelo **multi-tenant dinâmico** onde diferentes clientes (empresas) acessam a aplicação através de **subdomínios únicos**, cada um com sua própria marca, cores e metadados.

### Fluxo de Funcionamento

```
┌─────────────────────────────────────────────────────────┐
│  Cliente acessa: rastrear.trackcore.com                │
│  (ou transportadora.trackcore.com, logistica.tc.com)  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────┐
        │ Detectar Subdomain      │
        │ useTenant hook / headers│
        └────────────┬────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │ Buscar Configuração           │
        │ getTenantConfig(slug)         │
        │ ↓                             │
        │ /src/config/tenants.ts        │
        └────────────┬─────────────────┘
                     │
                     ▼
        ┌───────────────────────────────────────┐
        │ Carregar Cores & Metadados do Tenant  │
        │ - Logo                                │
        │ - Cores (primaryLight/Dark)           │
        │ - Favicon                             │
        │ - Company Name                        │
        │ - Title, Description                  │
        └────────────┬──────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
        ▼                           ▼
    Server-Side (SSR)         Client-Side (CSR)
    ┌──────────────┐          ┌──────────────────┐
    │ generateTenant│          │ TenantThemeInjector
    │ Metadata()   │          │ - useEffect      │
    │ ↓            │          │ - CSS Variables  │
    │ Favicon      │          │ - Dynamic Update │
    │ Title        │          └──────────────────┘
    │ OG Tags      │
    └──────────────┘
         │
         ▼
    ┌─────────────────────┐
    │ Render com Layout   │
    │ - Tenant Branding   │
    │ - Logo + Company    │
    │ - Cores aplicadas   │
    │ - Theme correto     │
    └─────────────────────┘
```

---

## 1. Configuração de Tenants

### Arquivo: `/src/config/tenants.ts`

Define todos os tenants suportados com suas configurações:

```typescript
export interface TenantConfig {
  slug: string;                              // Identificador único (subdomain)
  companyName: string;                       // Nome da empresa
  faviconUrl: string;                        // URL do favicon
  logoUrl: string;                           // URL da logo
  colors: {
    primaryLight: string;                    // HSL color (light mode)
    primaryForegroundLight: string;
    primaryDark: string;                     // HSL color (dark mode)
    primaryForegroundDark: string;
  };
  metadata?: {
    title?: string;
    description?: string;
    website?: string;
  };
}
```

### Exemplo de Tenant:

```typescript
const rastrearConfig: TenantConfig = {
  slug: 'rastrear',
  companyName: 'Rastrear Frota',
  faviconUrl: '/logos/rastrear/favicon.ico',
  logoUrl: '/logos/rastrear/logo.png',
  colors: {
    primaryLight: 'hsl(270, 100%, 45%)',      // Purple
    primaryForegroundLight: 'hsl(0, 0%, 100%)',
    primaryDark: 'hsl(270, 100%, 65%)',
    primaryForegroundDark: 'hsl(0, 0%, 0%)',
  },
  metadata: {
    title: 'Rastrear - Sistema de Rastreamento Veicular',
    description: 'Plataforma de rastreamento em tempo real para frota de veículos',
    website: 'https://rastrear.trackcore.com',
  },
};
```

### Como Adicionar um Novo Tenant:

1. **Crie a configuração em `/src/config/tenants.ts`:**
   ```typescript
   const meuTenantConfig: TenantConfig = {
     slug: 'meuempresa',
     companyName: 'Minha Empresa',
     faviconUrl: '/logos/meuempresa/favicon.ico',
     logoUrl: '/logos/meuempresa/logo.png',
     colors: {
       primaryLight: 'hsl(30, 100%, 50%)',    // Orange
       primaryForegroundLight: 'hsl(0, 0%, 100%)',
       primaryDark: 'hsl(30, 100%, 65%)',
       primaryForegroundDark: 'hsl(0, 0%, 0%)',
     },
     metadata: {
       title: 'Minha Empresa - Rastreamento',
       description: 'Solução de rastreamento para sua frota',
     },
   };
   ```

2. **Adicione ao array `TENANTS_CONFIG`:**
   ```typescript
   export const TENANTS_CONFIG: Record<string, TenantConfig> = {
     rastrear: rastrearConfig,
     transportadora: transportadoraConfig,
     logistica: logisticaConfig,
     delivery: deliveryConfig,
     meuempresa: meuTenantConfig,  // ← Novo tenant
   };
   ```

3. **Adicione os arquivos de marca:**
   ```
   public/logos/meuempresa/
   ├── favicon.ico
   └── logo.png
   ```

---

## 2. Detecção de Tenant

### No Client (Browser)

**Hook: `/src/lib/hooks/useTenant.ts`**

```typescript
export function useTenant() {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [slug, setSlug] = useState<string>('rastrear');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Detecta subdomínio do hostname
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    let detectedSlug = 'rastrear';
    
    if (hostname !== 'localhost' && parts.length > 2) {
      detectedSlug = parts[0]; // Pega o primeiro label
    }
    
    setSlug(detectedSlug);
    setTenant(getTenantConfig(detectedSlug));
    setIsLoading(false);
  }, []);

  return { tenant, slug, isLoading };
}
```

**Exemplos de Detecção:**

| Hostname | Slug Detectado |
|----------|---|
| `rastrear.trackcore.com` | `rastrear` |
| `transportadora.trackcore.com` | `transportadora` |
| `logistica.trackcore.com` | `logistica` |
| `localhost:3000` | `rastrear` (default) |
| `127.0.0.1:3000` | `rastrear` (default) |

### No Servidor (Next.js)

**Função: `/src/lib/tenant-metadata.ts`**

```typescript
export async function extractTenantSlugFromHeaders(): Promise<string> {
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  const parts = hostname.split('.');
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'rastrear'; // Default
  }
  
  if (parts.length > 2) {
    return parts[0];   // Extrai subdomínio
  }

  return 'rastrear';   // Fallback
}
```

---

## 3. Injeção Dinâmica de CSS Variables

### Server-Side (SSR) - Evita Flash

**`/src/app/layout.tsx`:**

```typescript
import { generateTenantColorsCSS } from "@/lib/tenant-metadata";

export default function RootLayout({ children }) {
  const tenantColorsCSS = generateTenantColorsCSS();

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Injetar CSS variables do tenant imediatamente */}
        <style>{tenantColorsCSS}</style>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Saída CSS gerada:**

```css
:root {
  --primary: hsl(270, 100%, 45%);              /* Light mode */
  --primary-foreground: hsl(0, 0%, 100%);
}

.dark {
  --primary: hsl(270, 100%, 65%);              /* Dark mode */
  --primary-foreground: hsl(0, 0%, 0%);
}
```

### Client-Side (CSR) - Atualização Dinâmica

**Componente: `/src/components/tenant-theme-injector.tsx`**

```typescript
export function TenantThemeInjector() {
  const { tenant, isLoading } = useTenant();
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    if (isLoading || !tenant) return;

    const activeTheme = theme === 'system' ? systemTheme : theme;
    const isDark = activeTheme === 'dark';
    const root = document.documentElement;

    if (isDark) {
      root.style.setProperty('--primary', tenant.colors.primaryDark);
      root.style.setProperty('--primary-foreground', tenant.colors.primaryForegroundDark);
    } else {
      root.style.setProperty('--primary', tenant.colors.primaryLight);
      root.style.setProperty('--primary-foreground', tenant.colors.primaryForegroundLight);
    }
  }, [tenant, theme, systemTheme, isLoading]);

  return null; // Componente invisível, apenas aplica estilos
}
```

**Fluxo de Aplicação:**
1. SSR carrega cores default no `<head>` → Sem flash
2. Cliente detecta tema (light/dark) → Atualiza CSS variables
3. Mudança de tema? → TenantThemeInjector atualiza dinamicamente
4. Mudança de subdomain? → Hook re-detecta novo tenant + aplica cores

---

## 4. Metadados e SEO

### Server-Side Metadata

**Função: `/src/lib/tenant-metadata.ts`**

```typescript
export function generateTenantMetadata(slug: string = 'rastrear'): Metadata {
  const tenant = getTenantConfig(slug);

  return {
    title: {
      template: `%s | ${tenant.companyName}`,
      default: tenant.metadata?.title || `${tenant.companyName} - Rastreamento Veicular`,
    },
    description: tenant.metadata?.description || `Sistema de rastreamento de frota`,
    icons: {
      icon: tenant.faviconUrl,
      shortcut: tenant.faviconUrl,
      apple: tenant.faviconUrl,
    },
    openGraph: {
      title: tenant.metadata?.title || `${tenant.companyName} - Rastreamento`,
      description: tenant.metadata?.description || `Sistema de rastreamento de frota`,
      url: tenant.metadata?.website || 'https://trackcore.com',
      siteName: tenant.companyName,
      type: 'website',
    },
  };
}
```

**Exemplo de Saída para `rastrear.trackcore.com`:**

```html
<title>Dashboard | Rastrear Frota</title>
<meta name="description" content="Sistema de rastreamento de frota Rastrear Frota">
<meta property="og:title" content="Rastrear - Sistema de Rastreamento Veicular">
<meta property="og:description" content="Plataforma de rastreamento em tempo real para frota">
<link rel="icon" href="/logos/rastrear/favicon.ico">
```

---

## 5. Componentes de Branding

### Uso no Layout

**Componente: `/src/components/tenant-branding.tsx`**

```typescript
// Variante Compacta (Header)
<TenantBrandingCompact />
// Renderiza: [logo] Rastrear

// Variante Completa (Sidebar)
<TenantBrandingFull />
// Renderiza: 
// [logo]
// Rastrear Frota
// (com espaçamento e alinhamento)

// Variante Simples
<TenantBranding variant="icon" /> // Só logo
<TenantBranding variant="text" /> // Só texto
<TenantBranding variant="full" /> // Logo + texto
```

**Implementação no Sidebar:**

```typescript
import { TenantBrandingFull } from '@/components/tenant-branding';

export function Sidebar() {
  return (
    <aside className="w-64 bg-background border-r">
      <div className="p-4">
        <TenantBrandingFull />
      </div>
      {/* resto do sidebar */}
    </aside>
  );
}
```

---

## 6. Sistema de Cores Tailwind

### Configuração em `tailwind.config.ts`

```typescript
export default {
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
      },
    },
  },
};
```

### Uso na Aplicação

```tsx
// Estes componentes mudam de cor dinamicamente com o tenant
<button className="bg-primary text-primary-foreground">
  Enviar
</button>

<div className="border-l-4 border-primary bg-primary/10">
  Alert box com cor do tenant
</div>

// Dark mode automático
<div className="dark:bg-primary dark:text-primary-foreground">
  Adapta à cor do tenant em dark mode
</div>
```

---

## 7. Guia de Implantação

### Pré-requisitos

- ✅ Subdomínios configurados (exemplo: `rastrear.trackcore.com`)
- ✅ TenantThemeInjector no Providers
- ✅ Arquivo de cores no Tailwind config
- ✅ Logos no diretório `/public/logos/{slug}/`

### Passos para Produção

1. **Validar DNS:**
   ```bash
   nslookup rastrear.trackcore.com
   nslookup transportadora.trackcore.com
   ```

2. **Testar Build:**
   ```bash
   npm run build
   npm run start
   ```

3. **Testar com Diferentes Subdomínios:**
   ```bash
   # Terminal 1: Inicia server
   npm run start
   
   # Terminal 2: Testa diferentes hosts
   curl -H "Host: rastrear.localhost" http://localhost:3000
   curl -H "Host: transportadora.localhost" http://localhost:3000
   ```

4. **Verificar no Browser (local):**
   - Edite `/etc/hosts`:
   ```
   127.0.0.1 rastrear.localhost
   127.0.0.1 transportadora.localhost
   127.0.0.1 logistica.localhost
   ```
   - Acesse: http://rastrear.localhost:3000

### Environment Variables

Não necessário! A detecção é automática via subdomain. Mas você pode adicionar logs:

```typescript
// .env.local
NEXT_PUBLIC_TENANT_DEBUG=true
```

---

## 8. Troubleshooting

### Problema: Cores não mudam ao trocar tenant

**Solução:**
1. Verifique se `TenantThemeInjector` está em `Providers`
2. Confirme se Tailwind tem as variáveis CSS
3. Limpe cache: `npm run build && npm run start`

### Problema: Flash de cor errada no carregamento

**Solução:**
- ✅ CSS já injetado no SSR (`layout.tsx`)
- Se ainda houver flash, mova `TenantThemeInjector` para o topo do `Providers`

### Problema: Tenant não detectado no localhost

**Solução:**
- Use `/etc/hosts` ou variável de ambiente:
```typescript
// Temporário, apenas para debug
const mockTenant = process.env.NEXT_PUBLIC_MOCK_TENANT || 'rastrear';
```

### Problema: Cores HSL inválidas

**Solução:**
- Valide formato: `hsl(270, 100%, 45%)`
- Use sites como: https://www.rapidtables.com/web/color/hsl-color.html

---

## 9. Exemplo Completo: Fluxo de Usuário

```
1. Usuário acessa: https://transportadora.trackcore.com/dashboard

2. Servidor:
   - Extrai 'host' do header: 'transportadora.trackcore.com'
   - Detecta slug: 'transportadora'
   - Busca config em TENANTS_CONFIG['transportadora']
   - Gera CSS: --primary: hsl(30, 100%, 50%) [Orange]
   - Gera metadata com favicon/title da transportadora

3. HTML enviado com:
   <style>:root { --primary: hsl(30, 100%, 50%); }</style>
   <link rel="icon" href="/logos/transportadora/favicon.ico">
   <title>Dashboard | Transportadora XYZ</title>

4. Browser carrega:
   - HTML renderizado → Cor laranja aplicada (sem flash!)
   - React hidrata
   - TenantThemeInjector detecta tema do sistema
   - Se dark mode ativo → Atualiza para hsl(30, 100%, 65%)

5. Resultado Visual:
   - Favicon laranja
   - Logo da Transportadora XYZ no sidebar
   - Botões e elementos em laranja (light/dark conforme tema)
   - Title na aba: "Dashboard | Transportadora XYZ"
```

---

## 10. Matriz de Tenants Atuais

| Slug | Empresa | Cor | Logo |
|------|---------|-----|------|
| `rastrear` | Rastrear Frota | Purple `hsl(270, 100%, 45%)` | `/logos/rastrear/logo.png` |
| `transportadora` | Transportadora Express | Orange `hsl(30, 100%, 50%)` | `/logos/transportadora/logo.png` |
| `logistica` | Logística Premium | Green `hsl(120, 70%, 45%)` | `/logos/logistica/logo.png` |
| `delivery` | Delivery Fast | Red `hsl(0, 100%, 50%)` | `/logos/delivery/logo.png` |

---

## Referências de Código

| Arquivo | Responsabilidade |
|---------|---|
| `/src/config/tenants.ts` | 📋 Configuración de tenants |
| `/src/lib/hooks/useTenant.ts` | 🪝 Hook client-side para detecção |
| `/src/lib/tenant-metadata.ts` | 📝 Funções server-side e metadados |
| `/src/components/tenant-theme-injector.tsx` | 🎨 Injetor dinâmico de CSS |
| `/src/components/tenant-branding.tsx` | 🏢 Componentes de branding |
| `/src/app/layout.tsx` | 🎯 Root layout com CSS SSR |
| `/src/components/providers.tsx` | 🔗 Wrappers de contexto |

---

**Última atualização:** 5 de março de 2026  
**Status:** ✅ Em Produção
