# ❓ FAQ & Troubleshooting

## ❓ Perguntas Frequentes

### P: O que é um tenant?
**R:** Um tenant é um cliente/empresa com sua própria instância configurável da aplicação. No TrackCore, cada tenant tem:
- Subdomain único (ex: `rastrear.trackcore.com`)
- Cores personalizadas (tema light/dark)
- Logo e favicon próprios
- Metadados (title, description)

### P: Por que usar subdomínios ao invés de caminhos (/rastrear, /logistica)?
**R:** Subdomínios são melhores porque:
- ✅ Cada tenant tem domínio próprio para branding
- ✅ SSL/TLS funciona naturalmente (wildcards)
- ✅ Cores CSS carregam no SSR sem flash
- ✅ Favicon muda automaticamente
- ❌ Caminhos misturariam URLs de tenants diferentes

### P: Como funciona a detecção de tenant?
**R:** Em 2 etapas:
1. **Server (SSR):** `headers()` extrai o host (`rastrear.trackcore.com`) → slug é `rastrear`
2. **Client (CSR):** `window.location.hostname` detecta subdomain → confirma configuração

### P: Quando as cores mudam?
**R:** Em 3 momentos:
1. **Na primeira requisição:** SSR injeta colors no `<head>` (sem flash!)
2. **Ao mudar light/dark:** TenantThemeInjector atualiza CSS variables
3. **Ao trocar de subdomain:** Novo HTML carregado com cores do novo tenant

### P: Preciso fazer build diferente para cada tenant?
**R:** NÃO! Um único build funciona para todos os tenants. A detecção é automática via subdomain.

### P: E se o usuário digitar um subdomain inválido?
**R:** Fallback automático para tenant `'rastrear'`. Seguro e sem erros.

### P: Posso reutilizar o mesmo tenant em múltiplos domínios?
**R:** Sim! Configure seus domínios:
```
rastrear.trackcore.com → slug: 'rastrear'
trackcore.com/          → slug: 'rastrear' (mesmo tenant)
track.br/               → slug: 'rastrear' (mesmo tenant)
```

Todos apontarão para a mesma configuração.

---

## 🔧 Troubleshooting

### ❌ Problema: "Logo/Favicon não aparece"

**Passo 1: Verificar caminho da logo**
```bash
ls -la public/logos/rastrear/
# Deve aparecer:
# logo.png
# favicon.ico
```

**Passo 2: Verificar arquivo é válido**
```bash
# PNG com dimensão mínima
file public/logos/rastrear/logo.png
# Deve dizer: "PNG image data ... 400x100"

# ICO com tamanho adequado
file public/logos/rastrear/favicon.ico
# Deve dizer: "MS Windows icon resource"
```

**Passo 3: Verificar config em tenants.ts**
```typescript
const config = getTenantConfig('rastrear');
console.log(config.logoUrl);  // Deve ser '/logos/rastrear/logo.png'
console.log(config.faviconUrl); // Deve ser '/logos/rastrear/favicon.ico'
```

**Passo 4: Limpar cache**
```bash
# Hard refresh no browser
Ctrl+Shift+R (Linux/Windows)
Cmd+Shift+R (macOS)

# Ou limpar cache Next.js
rm -rf .next
npm run build
npm run start
```

---

### ❌ Problema: "Cores não mudam ao trocar tema"

**Passo 1: Verificar TenantThemeInjector no Providers**
```typescript
// src/components/providers.tsx
export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TenantThemeInjector /> {/* ← Deve estar aqui */}
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

**Passo 2: Verificar next-themes está instalado**
```bash
npm list next-themes
# Deve estar instalado e com versão recente
```

**Passo 3: Verificar CSS variables estão sendo aplicadas**
Abra DevTools → Console:
```javascript
const root = document.documentElement;
getComputedStyle(root).getPropertyValue('--primary');
// Deve retornar algo como: 'hsl(270, 100%, 45%)'

// Se mudar manualmente de tema, deve mudar:
root.style.setProperty('--primary', 'hsl(0, 100%, 50%)');
// Agora deve retornar: 'hsl(0, 100%, 50%)'
```

**Passo 4: Verificar classe .dark está sendo adicionada**
Abra DevTools → Elements:
```html
<html class="dark">  {/* Deve ter 'dark' class */}
```

Se não tiver, next-themes não está funcionando. Reinstale:
```bash
npm uninstall next-themes
npm install next-themes
```

---

### ❌ Problema: "Flash de cor errada ao carregar página"

**Causa:** CSS variables não foram injetadas no SSR (servidor).

**Solução: Verificar generateTenantColorsCSS**

```typescript
// src/app/layout.tsx
const tenantColorsCSS = generateTenantColorsCSS();

return (
  <html>
    <head>
      <style>{tenantColorsCSS}</style> {/* ← DEVE estar aqui! */}
    </head>
    ...
  </html>
);
```

A `<style>` deve estar ANTES de `<body>` para aplicar imediatamente.

---

### ❌ Problema: "Subdomain não é detectado (sempre fica 'rastrear')"

**Passo 1: Verificar se hostname está correto**

Abra DevTools Console:
```javascript
window.location.hostname
// Deve retornar: 'rastrear.trackcore.com' ou 'localhost'
// Se retornar IP (ex: 127.0.0.1), use /etc/hosts
```

**Passo 2: Se for localhost, adicionar em /etc/hosts**

macOS/Linux:
```bash
sudo nano /etc/hosts
# Adicionar:
127.0.0.1 rastrear.localhost
127.0.0.1 transportadora.localhost
127.0.0.1 logistica.localhost
```

Windows (C:\Windows\System32\drivers\etc\hosts):
```
127.0.0.1 rastrear.localhost
127.0.0.1 transportadora.localhost
127.0.0.1 logistica.localhost
```

**Passo 3: Acessar com novo hostname**
```bash
http://rastrear.localhost:3000
http://transportadora.localhost:3000
```

**Passo 4: Verificar logs do useTenant**

Adicione log temporário:
```typescript
// src/lib/hooks/useTenant.ts
useEffect(() => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  const detectedSlug = parts.length > 2 ? parts[0] : 'rastrear';
  
  console.log('[TENANT] Hostname:', hostname);
  console.log('[TENANT] Parts:', parts);
  console.log('[TENANT] Detected slug:', detectedSlug);
  
  // resto do código...
}, []);
```

Verifique output no console do navegador.

---

### ❌ Problema: "Favicon é genérico, não muda por tenant"

**Causa:** Favicon está definido globalmente em `next.config.js`.

**Solução: Usar dynamic favicon**

```typescript
// src/app/layout.tsx
export const metadata: Metadata = generateTenantMetadata();
// Isso já coloca favicon correto no <head>
```

Se ainda não funcionar, remova favicon estático:
```javascript
// next.config.js
// remover: favicon: '/favicon.ico'

// Use metadata dinâmico ao invés
export const metadata: Metadata = generateTenantMetadata();
```

---

### ❌ Problema: "TypeError: headers is not a function"

**Causa:** `headers()` foi importado incorretamente ou chamado fora de async context.

**Solução:**
```typescript
// ✅ CORRETO
import { headers } from 'next/headers';

export async function minhaFuncao() {
  const headersList = await headers(); // ← await necessário!
  const host = headersList.get('host');
}

// ❌ ERRADO
export function minhaFuncao() {
  const headersList = headers(); // ← falta await!
  const host = headersList.get('host'); // TypeError
}
```

---

### ❌ Problema: "HSL Color muito clara/escura"

**Diagrama de Lightness:**
```
L: 0%   = Preto
L: 25%  = Muito escuro  ❌ Difícil ler em tela
L: 45%  = Escuro        ✅ Bom para light mode
L: 50%  = Neutro
L: 55%  = Claro         ✅ Bom para dark mode  
L: 65%  = Mais claro    ✅ Também bom para dark mode
L: 75%  = Muito claro   ❌ Difícil ler em tela
L: 100% = Branco
```

**Regra de Ouro:**
```typescript
// Light mode
primaryLight: 'hsl(H, 100%, 45%)'

// Dark mode (mais claro para contrastar com fundo preto)
primaryDark: 'hsl(H, 100%, 60%)'
```

**Testar Contraste:**
https://webaim.org/resources/contrastchecker/

1. Digite cor em HSL
2. Verifique se passa em "AAA" (mais rigoroso)

---

### ❌ Problema: "Mudança de tenant não funciona ao navegar"

**Causa:** useTenant hook não detecta mudanças de subdomain (useEffect roda só na montagem).

**Isso é esperado!** Porque:
- Se muda de `rastrear.trackcore.com` → `logistica.trackcore.com`
- É uma navegação para URL diferente
- Novo HTML é carregado do servidor
- Novo layout.tsx executa com novo slug
- Cores corretas já estão no SSR

**Se quer forçar re-detecção:**
```typescript
// Forçar page refresh
window.location.reload();

// Ou usar effect que monitora hostname
useEffect(() => {
  const handleLocationChange = () => {
    // Re-detectar tenant
    setSlug(detectSlugFromHostname());
  };

  window.addEventListener('popstate', handleLocationChange);
  return () => window.removeEventListener('popstate', handleLocationChange);
}, []);
```

---

### ❌ Problema: "Qual é a prioridade de CSS?"

**Cascata de aplicação:**
1. **Browser defaults** (menor prioridade)
2. **CSS global** (globals.css)
3. **CSS injected no SSR** (`generateTenantColorsCSS`)
4. **Tailwind utilities** (classes)
5. **Inline styles** (setProperty, style={})
6. **!important** (máxima prioridade)

Se cor não muda:
- Verifique se há `!important` em algum lugar
- Use DevTools → inspecione elemento → veja estilos aplicados

---

## 🚨 Erros Comuns

### "Parsing error: import outside root"

**Causa:** Tentar importar componentes client em server context.

**Solução:**
```typescript
// ✅ CORRETO
'use client'; // Adicionar no topo do arquivo
import { useTenant } from '@/lib/hooks';

// ❌ ERRADO
import { useTenant } from '@/lib/hooks'; // sem 'use client'
// Erro ao compilar
```

---

### "Property 'x' does not exist on type Promise"

**Causa:** headers() é async mas está sendo usada como sync.

**Solução:**
```typescript
// ✅ CORRETO
const headersList = await headers();

// ❌ ERRADO  
const headersList = headers();
```

---

### "Cannot find module '/logos/meutenant/logo.png'"

**Causa:** Arquivo de logo não existe no diretório public.

**Solução:**
```bash
# Criar diretório
mkdir -p public/logos/meutenant

# Copiar logo
cp ~/Downloads/logo.png public/logos/meutenant/

# Verificar
ls public/logos/meutenant/logo.png
```

---

## ✅ Checklist de Validação

Antes de fazer deploy:

- [ ] Todos os tenants estão em `TENANTS_CONFIG`
- [ ] Arquivos de logo existem em `public/logos/{slug}/`
- [ ] `npm run build` compila sem erros
- [ ] Testes locais funcionam: `npm run dev`
- [ ] Cores HSL são válidas (0-360, 0-100%, 0-100%)
- [ ] Subdomínios estão configurados em DNS
- [ ] CSS variables estão aplicando (DevTools)
- [ ] Light mode aparece corretamente
- [ ] Dark mode aparece corretamente
- [ ] Favicon muda por tenant
- [ ] Title muda por tenant
- [ ] Logo aparece corretamente
- [ ] Sem erros no console do browser
- [ ] Sem erros no terminal (npm run dev)

---

## 📞 Suporte

Se não encontrou a solução aqui:

1. **Verificar logs:**
   ```bash
   npm run dev 2>&1 | tee debug.log
   ```

2. **Procurar no código:**
   ```bash
   grep -r "generateTenantMetadata" src/
   grep -r "useTenant" src/
   grep -r "TenantThemeInjector" src/
   ```

3. **Testar manualmente:**
   ```javascript
   // No console do browser
   const slug = window.location.hostname.split('.')[0];
   const config = getTenantConfig(slug); // Deve funcionar
   ```

4. **Consultar documentação:**
   - [MULTI_TENANT_ARCHITECTURE.md](./MULTI_TENANT_ARCHITECTURE.md)
   - [TECHNICAL_IMPLEMENTATION.md](./TECHNICAL_IMPLEMENTATION.md)
   - [QUICK_START_TENANT.md](./QUICK_START_TENANT.md)

---

**Última atualização:** 5 de março de 2026
