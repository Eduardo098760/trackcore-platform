# 📚 Documentação Multi-Tenant TrackCore

Bem-vindo à documentação completa do sistema de multi-tenant do TrackCore Platform.

## 📖 Guias Disponíveis

### 🎯 [MULTI_TENANT_ARCHITECTURE.md](./MULTI_TENANT_ARCHITECTURE.md)
**Visão geral e arquitetura técnica completa**

- ✅ O que é multi-tenant e como funciona
- ✅ Fluxo de detecção por subdomain
- ✅ Sistema de injeção dinâmica de CSS variables
- ✅ Componentes de branding
- ✅ Metadados e SEO
- ✅ Matriz de tenants atuais
- ✅ Diagrama de arquitetura

**Tempo de leitura:** ~15 minutos  
**Nível:** Iniciante → Intermediário

---

### ⚡ [QUICK_START_TENANT.md](./QUICK_START_TENANT.md)
**Guia rápido para adicionar novo tenant**

- ✅ 5 passos para adicionar novo tenant
- ✅ Escolher cores HSL
- ✅ Preparar logos
- ✅ Testar localmente
- ✅ Deploy em produção
- ✅ Checklist de implantação

**Tempo de leitura:** ~5 minutos  
**Nível:** Iniciante  
**Use quando:** Precisa adicionar novo cliente

---

### 🔧 [TECHNICAL_IMPLEMENTATION.md](./TECHNICAL_IMPLEMENTATION.md)
**Detalhes técnicos e implementação**

- ✅ Arquitetura em camadas
- ✅ Fluxo de dados (SSR, CSR, mudanças de tema)
- ✅ Implementação detalhada de cada função
- ✅ Code snippets prontos para copiar
- ✅ Cascata de CSS e prioridades
- ✅ Debugging avançado

**Tempo de leitura:** ~20 minutos  
**Nível:** Intermediário → Avançado  
**Use quando:** Quer entender como o código funciona

---

### ❓ [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
**FAQ e resolução de problemas**

- ✅ Perguntas frequentes (Q&A)
- ✅ Problemas comuns e soluções passo-a-passo
- ✅ Erros e como corrigi-los
- ✅ Debugging técnicas
- ✅ Checklist de validação
- ✅ Informações de suporte

**Tempo de leitura:** ~10 minutos  
**Nível:** Iniciante → Avançado  
**Use quando:** Encontrar problema ou erro

---

## 🚀 Por Onde Começar?

### Se você é **novo** no projeto:
1. Leia [MULTI_TENANT_ARCHITECTURE.md](./MULTI_TENANT_ARCHITECTURE.md) (visão geral)
2. Scan [QUICK_START_TENANT.md](./QUICK_START_TENANT.md) (conceitos)

### Se precisa **adicionar novo tenant**:
1. Vá para [QUICK_START_TENANT.md](./QUICK_START_TENANT.md)
2. Se tiver dúvida, consulte [MULTI_TENANT_ARCHITECTURE.md](./MULTI_TENANT_ARCHITECTURE.md#6-matriz-de-tenants-atuais)

### Se precisa **entender o código**:
1. Leia [TECHNICAL_IMPLEMENTATION.md](./TECHNICAL_IMPLEMENTATION.md)
2. Use [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) para debugging

### Se encontrou **um problema**:
1. Procure em [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Se não resolver, verifique [TECHNICAL_IMPLEMENTATION.md](./TECHNICAL_IMPLEMENTATION.md#10-debugging)

---

## 📋 Resumo Rápido

### Como funciona?

```
1. Usuário acessa: rastrear.trackcore.com/dashboard

2. Servidor detecta: Hostname = 'rastrear.trackcore.com'
   ↓ Extrai subdomain: 'rastrear'
   ↓ Busca config em TENANTS_CONFIG['rastrear']
   ↓ Aplica cores/favicon do tenant

3. HTML enviado com:
   - Favicon: /logos/rastrear/favicon.ico
   - Colors CSS: --primary: hsl(270, 100%, 45%)
   - Title: Dashboard | Rastrear Frota

4. Browser renderiza:
   ✅ Sem flash de cor errada (cor já no SSR)
   ✅ Com logo do tenant
   ✅ Com colors correct
   ✅ Responsive a mudanças de tema
```

### Arquivos Importantes

| Arquivo | Função |
|---------|--------|
| `/src/config/tenants.ts` | Define configurações de cada tenant |
| `/src/lib/hooks/useTenant.ts` | Hook para detectar tenant no cliente |
| `/src/lib/tenant-metadata.ts` | Funções server-side para metadados |
| `/src/components/tenant-theme-injector.tsx` | Injeta CSS variables dinamicamente |
| `/src/components/tenant-branding.tsx` | Componentes para exibir logo/nome |
| `/src/app/layout.tsx` | Root layout com CSS SSR |
| `/src/components/providers.tsx` | Wrappers de contexto |

---

## 🎨 Cores Disponíveis

| Tenant | Slug | Cor Light | Cor Dark |
|--------|------|-----------|----------|
| Rastrear Frota | `rastrear` | 🟣 `hsl(270, 100%, 45%)` | 🟣 `hsl(270, 100%, 65%)` |
| Transportadora Express | `transportadora` | 🟠 `hsl(30, 100%, 50%)` | 🟠 `hsl(30, 100%, 65%)` |
| Logística Premium | `logistica` | 🟢 `hsl(120, 70%, 45%)` | 🟢 `hsl(120, 70%, 60%)` |
| Delivery Fast | `delivery` | 🔴 `hsl(0, 100%, 50%)` | 🔴 `hsl(0, 100%, 65%)` |

---

## 🔗 Links Úteis

### Ferramentas Online
- **HSL Color Picker:** https://www.rapidtables.com/web/color/hsl-color.html
- **Color Name Generator:** https://chir.ag/projects/ntc.js/
- **Contraste Checker:** https://webaim.org/resources/contrastchecker/

### Documentação
- **Next.js Headers:** https://nextjs.org/docs/app/api-reference/functions/headers
- **Next.js Metadata:** https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- **Tailwind CSS:** https://tailwindcss.com/docs
- **CSS Variables:** https://developer.mozilla.org/en-US/docs/Web/CSS/--*
- **next-themes:** https://github.com/pacocoursey/next-themes

---

## 📊 Estatísticas do Projeto

- **Tenants implementados:** 4 (rastrear, transportadora, logistica, delivery)
- **Componentes customizados:** 3 (TenantBranding, TenantThemeInjector, etc)
- **Hooks criados:** 1 (useTenant com variantes)
- **Funções server-side:** 4 (extractTenantSlugFromHeaders, getTenantConfig, etc)
- **Arquivos de config:** 1 (tenants.ts)
- **Cores por tenant:** 4 (primaryLight, primaryDark, etc)

---

## 🐛 Reportar Problemas

Se encontrar um bug ou tiver sugestões:

1. Verifique [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Se persistir, abra uma issue with:
   - Descrição do problema
   - Passos para reproduzir
   - Screenshots (se aplicável)
   - Output de erro

---

## 📝 Histórico de Atualizações

| Data | Mudança |
|------|---------|
| 5 Mar 2026 | ✅ Documentação completa criada |
| | - MULTI_TENANT_ARCHITECTURE.md |
| | - QUICK_START_TENANT.md |
| | - TECHNICAL_IMPLEMENTATION.md |
| | - TROUBLESHOOTING.md |
| | - README.md (este arquivo) |

---

## ✅ Validação

Antes de fazer deploy, verifique:

- [ ] Todos os tenants estão em `TENANTS_CONFIG`
- [ ] Logos estão em `/public/logos/{slug}/`
- [ ] Build compila: `npm run build`
- [ ] Sem erros de TypeScript
- [ ] Colors funcionam em light e dark mode
- [ ] Favicon muda por tenant
- [ ] Tests passam (se existirem)

---

## 🎓 Aprenda Mais

### Iniciantes
1. Leia [visão geral](./MULTI_TENANT_ARCHITECTURE.md#visão-geral)
2. Entenda o [fluxo básico](./MULTI_TENANT_ARCHITECTURE.md#fluxo-de-funcionamento)
3. Experimente [adicionar novo tenant](./QUICK_START_TENANT.md)

### Intermediários
1. Estude [arquitetura técnica](./TECHNICAL_IMPLEMENTATION.md#1-camadas-da-solução)
2. Entenda o [fluxo de dados](./TECHNICAL_IMPLEMENTATION.md#2-fluxo-de-dados---detalhado)
3. Practice com debugging ([TROUBLESHOOTING.md](./TROUBLESHOOTING.md#🔧-troubleshooting))

### Avançados
1. Customize [CSS variables](./TECHNICAL_IMPLEMENTATION.md#9-cascata-de-css)
2. Estenda com [novos recursos](./TECHNICAL_IMPLEMENTATION.md#8-integração-em-providersts)
3. Otimize [performance](./MULTI_TENANT_ARCHITECTURE.md#2-detecção-de-tenant)

---

## 📞 Suporte

- 📖 **Documentação:** Veja os guias acima
- 🐛 **Bugs:** Consulte [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- 💡 **Ideias:** Abra uma discussion no repositório

---

**Última atualização:** 5 de março de 2026  
**Versão:** 1.0  
**Status:** ✅ Produção
