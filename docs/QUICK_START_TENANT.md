# 🚀 Guia Rápido: Adicionar Novo Tenant

## TL;DR - 5 Passos Rápidos

### 1️⃣ Configurar em `tenants.ts`

```typescript
// src/config/tenants.ts

const meuTenantConfig: TenantConfig = {
  slug: 'meutenant',           // ← identificador único
  companyName: 'Minha Empresa',
  faviconUrl: '/logos/meutenant/favicon.ico',
  logoUrl: '/logos/meutenant/logo.png',
  colors: {
    primaryLight: 'hsl(180, 100%, 45%)',     // Cyan - Light
    primaryForegroundLight: 'hsl(0, 0%, 100%)',
    primaryDark: 'hsl(180, 100%, 55%)',      // Cyan - Dark
    primaryForegroundDark: 'hsl(0, 0%, 0%)',
  },
  metadata: {
    title: 'Minha Empresa - Rastreamento',
    description: 'Sistema de rastreamento veicular',
    website: 'https://meutenant.trackcore.com',
  },
};

export const TENANTS_CONFIG: Record<string, TenantConfig> = {
  rastrear: rastrearConfig,
  transportadora: transportadoraConfig,
  logistica: logisticaConfig,
  delivery: deliveryConfig,
  meutenant: meuTenantConfig,  // ← Adicionar aqui!
};
```

### 2️⃣ Preparar Arquivo de Logo

```bash
# Criar diretório
mkdir -p public/logos/meutenant

# Copiar/Criar arquivos
cp logo.png public/logos/meutenant/logo.png
cp favicon.ico public/logos/meutenant/favicon.ico

# Estrutura final:
# public/logos/meutenant/
# ├── logo.png (400x100 recomendado)
# └── favicon.ico (32x32)
```

### 3️⃣ Configurar DNS/Subdomain

```bash
# No seu provider DNS (Cloudflare, Route53, etc)
# Criar record:
Type:  CNAME
Name:  meutenant
Value: trackcore.com

# Resultado: meutenant.trackcore.com aponta para trackcore.com
```

### 4️⃣ Testar Localmente

```bash
# Editar /etc/hosts (macOS/Linux)
echo "127.0.0.1 meutenant.localhost" >> /etc/hosts

# Ou no Windows: C:\Windows\System32\drivers\etc\hosts
# Adicionar: 127.0.0.1 meutenant.localhost

# Iniciar servidor
npm run dev

# Acessar: http://meutenant.localhost:3000
```

### 5️⃣ Fazer Build e Deploy

```bash
npm run build
git add .
git commit -m "feat: add meutenant configuration"
git push

# A aplicação carregará automaticamente com as cores corretas!
```

---

## 🎨 Escolher Cores (HSL)

### Formato HSL: `hsl(H, S%, L%)`

- **H (Hue)**: 0-360 graus (cor)
- **S (Saturation)**: 0-100% (intensidade)
- **L (Lightness)**: 0-100% (claridade)

### Paleta de Cores Sugeridas

```typescript
// Vermelhos
'hsl(0, 100%, 50%)'     // Vermelho puro
'hsl(0, 100%, 45%)'     // Vermelho forte

// Laranjas
'hsl(30, 100%, 50%)'    // Laranja puro
'hsl(30, 100%, 45%)'    // Laranja forte

// Amarelos
'hsl(60, 100%, 50%)'    // Amarelo puro
'hsl(60, 100%, 45%)'    // Amarelo forte (mais escuro)

// Verdes
'hsl(120, 100%, 50%)'   // Verde puro
'hsl(120, 70%, 45%)'    // Verde floresta

// Azuis
'hsl(240, 100%, 50%)'   // Azul puro
'hsl(240, 100%, 45%)'   // Azul forte

// Ciano (Turquesa)
'hsl(180, 100%, 50%)'   // Ciano puro
'hsl(186, 100%, 45%)'   // Ciano forte

// Roxo/Púrpura
'hsl(270, 100%, 50%)'   // Roxo puro
'hsl(270, 100%, 45%)'   // Roxo forte

// Rosa/Magenta
'hsl(300, 100%, 50%)'   // Magenta puro
'hsl(320, 100%, 45%)'   // Rosa forte
```

### Regra de Ouro para Light/Dark

```typescript
// Light Mode (L: 45%)
primaryLight: 'hsl(H, 100%, 45%)'

// Dark Mode (L: 55-65%)
primaryDark: 'hsl(H, 100%, 55%)' ou 'hsl(H, 100%, 65%)'

// Foreground (sempre preto/branco)
primaryForegroundLight: 'hsl(0, 0%, 100%)' // Branco
primaryForegroundLight: 'hsl(0, 0%, 0%)'   // Preto

primaryForegroundDark: 'hsl(0, 0%, 0%)'    // Preto
primaryForegroundDark: 'hsl(0, 0%, 100%)'  // Branco
```

---

## 🔍 Preview Interativo de Cores

Acesse: https://www.rapidtables.com/web/color/hsl-color.html

1. Digite `H` (0-360) no campo
2. Digite `S` (0-100) no campo
3. Digite `L` (0-100) no campo
4. Veja o preview em tempo real
5. Teste se fica bom em light mode (L: 45%) e dark mode (L: 65%)

---

## 📝 Checklist de Implantação

- [ ] Criar configuração em `tenants.ts`
- [ ] Adicionar ao `TENANTS_CONFIG`
- [ ] Criar diretório `/public/logos/{slug}/`
- [ ] Colocar `logo.png` na pasta
- [ ] Colocar `favicon.ico` na pasta
- [ ] Testar localmente com `/etc/hosts`
- [ ] Validar cores em light e dark mode
- [ ] Fazer build: `npm run build`
- [ ] Fazer push: `git push`
- [ ] Configurar DNS no provider (CNAME)
- [ ] Testar em produção com o subdomain

---

## ❌ Problemas Comuns

### "Logo não aparece"
```
public/logos/meutenant/logo.png
                      ↑↑↑↑↑↑↑↑
Verifique se a pasta existe e está com o nome EXATO
```

### "Cores não mudam"
- Verifique o `slug` está correto em ambos os lugares
- Limpe cache: `Ctrl+Shift+R` no browser
- Verifique DevTools: Console → nenhum erro?

### "Subdomain não aponta para a app"
```bash
# Testar DNS
nslookup meutenant.trackcore.com

# Se não funcionar, suas configs de DNS estão erradas
# Contate seu provider DNS ou IT
```

### "HSL muito clara/escura"
- Light Mode com L > 50% fica muito claro
- Dark Mode com L < 50% fica muito escuro
- Use L: 45% para light, L: 55-65% para dark

---

## 🧪 Testando Diferentes Tenants

```bash
# Terminal 1: Inicia o servidor
npm run dev

# Terminal 2: Simula diferentes requests
# Para rastrear.localhost
curl -H "Host: rastrear.localhost:3000" http://localhost:3000

# Para meutenant.localhost
curl -H "Host: meutenant.localhost:3000" http://localhost:3000

# Para logistica.localhost
curl -H "Host: logistica.localhost:3000" http://localhost:3000
```

---

## 📚 Referências

- **Paleta de cores:** https://chir.ag/projects/ntc.js/ (Name That Color)
- **HSL Converter:** https://www.rapidtables.com/web/color/hsl-color.html
- **Acessibilidade de cores:** https://webaim.org/articles/contrast/
- **Documentação completa:** [MULTI_TENANT_ARCHITECTURE.md](./MULTI_TENANT_ARCHITECTURE.md)

---

## 💡 Exemplo Pronto: Tenant Green

Quer copiar um tenant existente? Use este template:

```typescript
const greenTenantConfig: TenantConfig = {
  slug: 'greentech',
  companyName: 'GreenTech Solutions',
  faviconUrl: '/logos/greentech/favicon.ico',
  logoUrl: '/logos/greentech/logo.png',
  colors: {
    primaryLight: 'hsl(120, 70%, 45%)',       // Verde floresta
    primaryForegroundLight: 'hsl(0, 0%, 100%)',
    primaryDark: 'hsl(120, 70%, 60%)',        // Verde mais claro
    primaryForegroundDark: 'hsl(0, 0%, 0%)',
  },
  metadata: {
    title: 'GreenTech - Sistema de Rastreamento',
    description: 'Solução de rastreamento sustentável',
    website: 'https://greentech.trackcore.com',
  },
};
```

---

**Pronto!** Seu novo tenant está ativo em `{slug}.trackcore.com` 🚀
