# 🎨 Sistema Multi-Tenant com Temas Customizáveis

## 📋 Arquitetura Implementada

### 1. **Configuração Estática de Tenants** (`src/config/tenants.ts`)
- Arquivo único com todas as configurações por subdomínio
- Cores personalizadas (light e dark mode)
- Logo, favicon e nome da empresa
- Fallback automático para "rastrear"

### 2. **Detecção de Tenant** (`src/lib/hooks/useTenant.ts`)
- Hook que detecta o tenant pelo hostname
- Extrai subdomínio automaticamente
- Funciona em client-side (browser)

### 3. **Injector de Tema Dinâmico** (`src/components/tenant-theme-injector.tsx`)
- Componente que aplica CSS variables dinamicamente
- Respeita tema light/dark do usuário
- Automático, sem configuração manual

### 4. **Branding do Tenant** (`src/components/tenant-branding.tsx`)
- Componentes prontos para exibir logo/nome do tenant
- Diferentes variantes (compacto, full, etc)

### 5. **Metadados Server-Side** (`src/lib/tenant-metadata.ts`)
- Gera favicon, title, description baseado no tenant
- Injeta CSS no servidor para evitar "flash"

---

## 🚀 Como Usar

### A. Adicionar um Novo Tenant

**1. Editar `src/config/tenants.ts`:**

```typescript
// Adicione uma entrada em TENANTS_CONFIG
cliente-novo: {
  id: '5',
  companyName: 'Cliente Novo LTDA',
  slug: 'cliente-novo',
  logoUrl: '/logos/cliente-novo-logo.svg',
  faviconUrl: '/logos/cliente-novo-favicon.ico',
  colors: {
    primaryLight: '123 45% 67%',        // Cor desejada em HSL
    primaryForegroundLight: '210 40% 98%',
    primaryDark: '123 45% 77%',
    primaryForegroundDark: '222.2 47.4% 11.2%',
  },
  metadata: {
    title: 'Cliente Novo - Rastreamento',
    description: 'Sistema de rastreamento para Cliente Novo',
    website: 'https://cliente-novo.trackcore.com',
  },
},
```

**2. Fazer upload dos logos para `public/logos/`:**
- `cliente-novo-logo.svg` (para exibir no header)
- `cliente-novo-favicon.ico` (ícone do browser)

**3. Deploy para subdomínio:**
- A aplicação já reconhecerá `cliente-novo.trackcore.com` automaticamente

---

### B. Usar o Hook em Componentes

```typescript
'use client';

import { useTenant } from '@/lib/hooks/useTenant';

export function MyComponent() {
  const { tenant, slug, isLoading } = useTenant();

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div>
      <h1>Bem-vindo a {tenant.companyName}</h1>
      <p>Seu slug: {slug}</p>
    </div>
  );
}
```

### C. Exibir Branding do Tenant

```typescript
import { TenantBranding, TenantBrandingFull } from '@/components/tenant-branding';

export function Header() {
  return (
    <header className="flex items-center justify-between">
      <TenantBranding />  {/* Logo + nome compacto */}
      {/* ou */}
      <TenantBrandingFull />  {/* Logo + nome + slug */}
    </header>
  );
}
```

---

## 🎨 Segredo: Cores em HSL

Os valores de cor são em **HSL** (Hue, Saturation, Lightness):

```
Format: "H S% L%"
Exemplo: "221.2 83.2% 53.3%"

Onde:
- H (Hue): 0-360° (vermelho=0, verde=120, azul=240)
- S (Saturation): 0-100% (cinza=0%, cor pura=100%)
- L (Lightness): 0-100% (preto=0%, branco=100%)
```

### Paletas úteis:

```
Roxo (atual):      221.2 83.2% 53.3%
Azul:              217 100% 50%
Verde:             142 72% 43%
Vermelho:          3 100% 61%
Laranja:           24 96% 53%
Amarelo:           48 96% 53%
Rosa:              300 100% 65%
Ciano:             190 100% 50%
```

Converter cores: [https://www.rapidtables.com/convert/color/rgb-to-hsl.html](https://www.rapidtables.com/convert/color/rgb-to-hsl.html)

---

## 🔄 Fluxo Completo

```
1. Usuário acessa tenant[slug].trackcore.com
   ↓
2. next-themes detecta tema (light/dark)
   ↓
3. useTenant() extrai slug do hostname
   ↓
4. getTenantConfig(slug) retorna configuração
   ↓
5. TenantThemeInjector aplica CSS variables
   ↓
6. Tailwind usa --primary para todas as cores primárias
   ↓
7. Página renderiza com cores do tenant
```

---

## 📝 Exemplo Prático: Settings Page

```typescript
'use client';

import { useTenant } from '@/lib/hooks/useTenant';
import { TenantBrandingFull } from '@/components/tenant-branding';

export default function SettingsPage() {
  const { tenant } = useTenant();

  return (
    <div className="space-y-6">
      <h1>Configurações da Plataforma</h1>
      
      <div className="p-6 border rounded-lg bg-card">
        <h2 className="text-lg font-semibold mb-4">Informações do Tenant</h2>
        <TenantBrandingFull />
        
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Nome da Empresa</dt>
            <dd className="font-medium">{tenant.companyName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-mono">{tenant.slug}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Website</dt>
            <dd><a href={tenant.metadata?.website} target="_blank">{tenant.metadata?.website}</a></dd>
          </div>
        </dl>
      </div>

      {/* Exemplo de como as cores são aplicadas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-primary text-primary-foreground rounded-lg font-semibold">
          Cor Primária
        </div>
        <div className="p-4 bg-secondary rounded-lg">
          Cor Secundária
        </div>
        <div className="p-4 bg-accent rounded-lg">
          Cor de Destaque
        </div>
      </div>
    </div>
  );
}
```

---

## ✅ Checklist de Implementação

- [x] Arquivo de config estático (`src/config/tenants.ts`)
- [x] Hook de detecção (`src/lib/hooks/useTenant.ts`)
- [x] Injector de tema (`src/components/tenant-theme-injector.tsx`)
- [x] Componentes de branding (`src/components/tenant-branding.tsx`)
- [x] Metadados server-side (`src/lib/tenant-metadata.ts`)
- [x] Integração no layout root
- [x] Integração no providers
- [ ] Adicionar logos dos tenants em `public/logos/`
- [ ] Testar com múltiplos subdomínios
- [ ] Ajustar cores nos exemplos

---

## 🧪 Testando Localmente

### Opção 1: Modificar `/etc/hosts`
```bash
# macOS/Linux
sudo nano /etc/hosts

# Adicionar:
127.0.0.1 rastrear.localhost
127.0.0.1 transportadora.localhost
127.0.0.1 logistica.localhost

# Acessar:
http://rastrear.localhost:3000
http://transportadora.localhost:3000
```

### Opção 2: Variável de ambiente
```typescript
// Em useTenant.ts, adicionar:
if (hostname === 'localhost') {
  detectedSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || 'rastrear';
}
```

```bash
# .env.local
NEXT_PUBLIC_TENANT_SLUG=transportadora
```

---

## 🎯 Próximos Passos (Futuro)

1. **Painel Admin** - CRUD de tenants (sem reiniciar app)
2. **Database Storage** - Mover config para DB
3. **Customizações do Cliente** - Permitir upload de logo/cores
4. **Subdomínios Dinâmicos** - Suportar custom domains
5. **Analytics por Tenant** - Isolamento de dados

---

**Status**: ✅ Pronto para produção (com logos dos clientes)
