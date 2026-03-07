# Pre-Commit Type Validation

## Objetivo
Garantir que todo código enviado passa por validação rigorosa de TypeScript e segue padrões de layout estabelecidos.

---

## 1️⃣ Validação de TypeScript (OBRIGATÓRIO)

### Antes de qualquer `git commit`:

```bash
# Step 1: Compilar e verificar tipos
npm run build

# Step 2: Resultado esperado
# ✓ Compiled successfully in X.Xs
# ✓ Generating static pages
```

Se receber erro de TypeScript:
```
Failed to compile.
./src/app/(dashboard)/examples/page.tsx:123:45
Type error: Cannot find name 'undefinedFunction'.
```

**Ação**: 
1. Abrir arquivo indicado
2. Verificar tipo em `/src/types/index.ts` 
3. Aplicar correção
4. Reexecutar `npm run build`

---

## 2️⃣ Verificação de Tipos Comuns

### ✅ Validar estas situações SEMPRE:

#### A) Acesso a propriedades de objetos
```typescript
// ❌ ERRADO - pode causar "does not exist"
const value = item.attributes.organizationId;

// ✅ CORRETO - verificar interface de item em types/index.ts
const value = item.clientId;
```

#### B) React Query - mutationFn
```typescript
// ❌ ERRADO - tipo incompatível
mutationFn: createDevice,

// ✅ CORRETO - arrow function
mutationFn: (device) => createDevice(device),
```

#### C) Valores opcionais / nulos
```typescript
// ❌ ERRADO
const count = array.length;

// ✅ CORRETO
const count = (array || []).length;

// ✅ AINDA MELHOR
const count = array?.length ?? 0;
```

#### D) Union types / Roles
```typescript
// ❌ ERRADO - role 'operator' não existe
role: 'operator'

// ✅ CORRETO - roles válidos: 'admin' | 'manager' | 'user' | 'readonly' | 'deviceReadonly'
role: 'user'
```

#### E) Componentes com JSX
```typescript
// ❌ ERRADO - React não importado
function Component() {
  return <div>Test</div>;
}

// ✅ CORRETO
import React from 'react';
function Component(): React.ReactElement {
  return <div>Test</div>;
}
```

---

## 3️⃣ Padrão de Estrutura de Arquivo

### Pages (exemplo: src/app/(dashboard)/devices/page.tsx)

```typescript
'use client';

// SEÇÃO 1: Imports React/Next
import { useState, useEffect, useCallback, Fragment } from 'react';
import type { NextApiRequest } from 'next';

// SEÇÃO 2: Queries/Mutations
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// SEÇÃO 3: Tipos
import { Device, Position, User } from '@/types';

// SEÇÃO 4: API
import { getDevices, createDevice, updateDevice } from '@/lib/api/devices';

// SEÇÃO 5: UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';

// SEÇÃO 6: Hooks & Stores
import { useAuth } from '@/lib/stores/auth';

// SEÇÃO 7: Utils
import { cn, formatDate } from '@/lib/utils';

// SEÇÃO 8: Ícones (SEMPRE POR ÚLTIMO)
import { Plus, Trash2, Edit, Loader2 } from 'lucide-react';

// SEÇÃO 9: Toast/Notifications
import { toast } from 'sonner';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface FormData {
  name: string;
  uniqueId: string;
}

interface ComponentState {
  isOpen: boolean;
  editingId: number | null;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function DevicesPage(): React.ReactElement {
  // 1. ESTADOS
  const [isOpen, setIsOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const queryClient = useQueryClient();

  // 2. AUTH
  const { user } = useAuth();

  // 3. QUERIES
  const { 
    data: devices = [], 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['devices'],
    queryFn: () => getDevices(),
  });

  // 4. MUTATIONS
  const createMutation = useMutation({
    mutationFn: (data: Omit<Device, 'id'>) => createDevice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device criado!');
      setIsOpen(false);
    },
    onError: () => {
      toast.error('Erro ao criar device');
    },
  });

  // 5. CALLBACKS
  const handleCreate = useCallback((data: Omit<Device, 'id'>) => {
    createMutation.mutate(data);
  }, [createMutation]);

  // 6. EFFECTS (se necessário)
  useEffect(() => {
    // inicializar algo
  }, []);

  // 7. RENDER
  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro ao carregar</div>;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dispositivos" 
        action={<Button onClick={() => setIsOpen(true)}><Plus /> Novo</Button>}
      />
      
      <div className="grid gap-4">
        {devices.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface DeviceCardProps {
  device: Device;
}

function DeviceCard({ device }: DeviceCardProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{device.name}</CardTitle>
      </CardHeader>
    </Card>
  );
}
```

---

## 4️⃣ Checklist Final (Antes de Commit)

- [ ] `npm run build` executa sem erros de TypeScript
- [ ] Todos os tipos explícitos (sem `any`)
- [ ] Imports organizados em 8 seções
- [ ] Nomes seguem padrão (handle*, use*, set*, is*)
- [ ] React Query mutations usam arrow functions
- [ ] Ausência de acesso a propriedades indefinidas
- [ ] Componentes têm tipo de retorno (: React.ReactElement)
- [ ] Logs têm prefixo do nome da função: `console.log('[FunctionName]')`
- [ ] Erros tratados (try/catch or onError)
- [ ] Sem warnings do Turbopack/ESLint

---

## 5️⃣ Exemplos de Fixes Rápidos

### Issue: "Cannot find name 'xxx'"
```diff
// Verificar em types/index.ts se interface existe
- import { Device } from '@/types'; // ❌ Device não exportado
+ import type { Device } from '@/types'; // ✅ Adicionado type
```

### Issue: "Property 'xxx' does not exist"
```diff
// Verificar interface em types/index.ts
- const value = user.attributes?.superadmin;
+ const value = user.role === 'admin'; // Validar role correto
```

### Issue: "Type 'xxx' is not assignable"
```diff
// React Query mutation
- mutationFn: createDevice,
+ mutationFn: (device) => createDevice(device),
```

---

## 🚀 Fluxo Padrão de Desenvolvimento

```
1. Criar/Editar arquivo
   ↓
2. Adicionar tipos corretos de types/index.ts
   ↓
3. Organizar imports (8 seções)
   ↓
4. npm run build → Verificar erros
   ↓
5. Se erros: Ler erro → Ir para arquivo → Corrigir tipo
   ↓
6. npm run build novamente (confirmar build clean)
   ↓
7. git add . && git commit -m "..."
```

---

**NOTA**: A IA sempre verificará esses padrões ANTES de gerar código ou sugerir mudanças.
