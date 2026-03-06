# 📚 Padrões de Desenvolvimento - Guia Rápido

## 🎯 Objetivo
Estabelecer padrões rigorosos de **type safety**, **validação TypeScript** e **layout consistente** em todos os arquivos do projeto.

---

## 🚨 Regra #1: Type Safety OBRIGATÓRIO

```bash
# ANTES DE QUALQUER COMMIT:
npm run build

# DEVE SER IGUAL A:
# ✓ Compiled successfully
# ✓ Generating static pages
# (Sem nenhum erro de TypeScript)
```

**Nenhum arquivo pode ser commitado com erros de tipo.**

---

## 📋 Checklist Rápido (30 segundos)

- [ ] `npm run build` passa sem erros?
- [ ] Tipos estão explícitos (nunca `any`)?
- [ ] Imports organizados (tipos → API → UI → ícones)?
- [ ] React Query mutations usam arrow functions?
- [ ] Sem acesso a propriedades indefinidas?
- [ ] Componentes têm tipo de retorno?

---

## 📁 Arquivos de Referência

| Arquivo | Conteúdo |
|---------|----------|
| **[.copilot-instructions.md](.copilot-instructions.md)** | Padrões principais para IA + code patterns |
| **[DEVELOPMENT_STANDARDS.md](DEVELOPMENT_STANDARDS.md)** | Padrões detalhados + pré-commit checklist |
| **[TYPE_SAFETY_REFERENCE.md](TYPE_SAFETY_REFERENCE.md)** | Quick reference para tipos válidos |
| **[LAYOUT_STANDARDS.md](LAYOUT_STANDARDS.md)** | Padrões CSS, componentes, dark mode |

---

## ⚡ Tipos Válidos do Projeto

```typescript
// ROLES (User)
'admin' | 'manager' | 'user' | 'readonly' | 'deviceReadonly'

// STATUS (Device)
'online' | 'offline' | 'moving' | 'stopped' | 'blocked'

// VEHICLES (Device)
'car' | 'motorcycle' | 'truck' | 'bus' | 'trailer' | 'bicycle' | 'airplane' | 'boat' | 'van'

// NOTIFICATIONS
'email' | 'sms' | 'push' | 'webhook'
```

---

## 🔧 Padrão de Estrutura de Arquivo

```typescript
// 1. Imports React/Next
// 2. External libs (react-query, etc)
// 3. Tipos (@/types)
// 4. API (@/lib/api)
// 5. UI Components (@/components/ui)
// 6. Hooks (@/lib/hooks, stores)
// 7. Utils (@/lib/utils)
// 8. Ícones (lucide-react) ← SEMPRE POR ÚLTIMO

// TYPES/INTERFACES

// MAIN COMPONENT
export default function PageName(): React.ReactElement {
  // 1. Estados
  // 2. Auth/Stores
  // 3. Queries
  // 4. Mutations
  // 5. Callbacks
  // 6. Effects
  // 7. JSX
}
```

---

## 🚀 3 Comandos Essenciais

```bash
# Validar build
npm run build

# Ver erros de TypeScript específicos
npm run build 2>&1 | grep "Type error"

# Ver últimas linhas (resultado)
npm run build 2>&1 | tail -20
```

---

## ⚠️ Erros Mais Comuns & Fixes

### "Cannot find name 'xxx'"
```typescript
// ❌ ERRADO
import { Device } from '@/types';

// ✅ CORRETO
import type { Device } from '@/types';
```

### "Property 'xxx' does not exist"
```typescript
// Verificar em types/index.ts qual propriedade usar
// Exemplo: usar item.clientId em vez de item.organizationId
```

### "Type not assignable to mutationFn"
```typescript
// ❌ ERRADO
mutationFn: createDevice

// ✅ CORRETO
mutationFn: (device) => createDevice(device)
```

### "Cannot access 'xxx' of undefined"
```typescript
// ❌ ERRADO
value = item.address

// ✅ CORRETO
value = item?.address ?? 'N/A'
```

---

## 💡 React Query Pattern

```typescript
// ✅ PADRÃO CORRETO
const mutation = useMutation({
  mutationFn: (data: TypeOfData) => apiFunction(data),
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: ['entities'] });
    toast.success('Sucesso!');
  },
  onError: (error) => {
    toast.error('Erro ao processar');
  },
});
```

---

## 📐 Layout Padrão (Componentes)

```tsx
// Card com action
<Card>
  <CardHeader className="flex justify-between">
    <CardTitle>Título</CardTitle>
    <Badge>{status}</Badge>
  </CardHeader>
  <CardContent>{/* conteúdo */}</CardContent>
</Card>

// Form em Dialog
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <form className="space-y-4">{/* campos */}</form>
    <DialogFooter>
      <Button variant="outline">Cancelar</Button>
      <Button>Salvar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Empty State
{items.length === 0 && (
  <div className="text-center py-12">
    <h3>Nenhum item</h3>
    <Button>Criar novo</Button>
  </div>
)}
```

---

## 🎨 Dark Mode Support

Sempre usar `dark:` prefix:

```tsx
<div className="
  bg-white dark:bg-slate-900
  text-gray-900 dark:text-gray-100
  border-gray-200 dark:border-slate-700
">
  Conteúdo com dark mode
</div>
```

---

## 📌 Workflow Padrão

```
1. Editar/Criar arquivo
   ↓
2. Adicionar tipos corretos
   ↓
3. Organizar imports (8 seções)
   ↓
4. npm run build
   ↓
5. Erros? Ler + Corrigir + npm run build novamente
   ↓
6. Build clean? ✅ Pronto para commit!
```

---

## 🔗 Links Rápidos

- **Types Reference**: Ver [TYPE_SAFETY_REFERENCE.md](TYPE_SAFETY_REFERENCE.md)
- **Full Development Guide**: Ver [DEVELOPMENT_STANDARDS.md](DEVELOPMENT_STANDARDS.md)  
- **Code Examples**: Ver [.copilot-instructions.md](.copilot-instructions.md)
- **UI Patterns**: Ver [LAYOUT_STANDARDS.md](LAYOUT_STANDARDS.md)

---

## ❓ FAQ Rápido

**P: Posso usar `any` como tipo?**
R: ❌ Nunca. Use tipos específicos sempre.

**P: Preciso rodar build toda vez?**
R: ✅ Sim, obrigatoriamente antes de cada commit.

**P: Qual o padrão de nome para handlers?**
R: `handle` + ação: `handleCreate`, `handleDelete`, `handleSubmit`

**P: Como saber se um tipo é válido?**
R: Ver [TYPE_SAFETY_REFERENCE.md](TYPE_SAFETY_REFERENCE.md) ou `/src/types/index.ts`

**P: E se eu não souber o tipo exato?**
R: Ler o arquivo `/src/types/index.ts` e procurar pela interface relevante.

---

## 🎓 Próximas Leituras

1. Ler [.copilot-instructions.md](.copilot-instructions.md) - entender padrões principais
2. Ler [TYPE_SAFETY_REFERENCE.md](TYPE_SAFETY_REFERENCE.md) - memorizar tipos principais
3. Ler [LAYOUT_STANDARDS.md](LAYOUT_STANDARDS.md) - padrões visuais
4. Praticar em um novo arquivo pequeno

---

**Última atualização**: 2026-03-06
**Todos os padrões devem ser seguidos rigorosamente.**
