# Quick Reference - Type Safety Checks

## 🔍 Sempre verificar ANTES de escrever código

### 1. Tipos disponíveis
```typescript
// Em /src/types/index.ts, estes tipos são VÁLIDOS:
UserRole: 'admin' | 'manager' | 'user' | 'readonly' | 'deviceReadonly'
DeviceStatus: 'online' | 'offline' | 'moving' | 'stopped' | 'blocked'
VehicleCategory: 'car' | 'motorcycle' | 'truck' | 'bus' | 'trailer' | 'bicycle' | 'airplane' | 'boat' | 'van'
NotificationType: 'email' | 'sms' | 'push' | 'webhook'
EventType: (check types/index.ts for complete list)
```

### 2. Interfaces principais
```typescript
// Device - propriedades VÁLIDAS:
Device.id, .name, .uniqueId, .plate, .status, .lastUpdate, .category,
.model, .phone, .contact, .disabled, .speedLimit, .attributes
// NÃO têm: organizationId, position, operatorName, etc.

// User - propriedades VÁLIDAS:
User.id, .name, .email, .role, .organizationId, .phone, .avatar,
.disabled, .token, .expirationTime, .createdAt, .updatedAt
// NÃO têm: attributes?.superadmin, operator, etc.

// Position - propriedades VÁLIDAS:
Position.id, .deviceId, .latitude, .longitude, .speed, .course,
.altitude, .address, .accuracy, .serverTime, .deviceTime
// NÃO têm: startAddress, endAddress, etc.

// Trip - propriedades VÁLIDAS:
Trip.id, .deviceId, .startTime, .endTime, .distance, .duration,
.averageSpeed, .maxSpeed, .startPosition, .endPosition, .positions
// NÃO têm: startAddress, endAddress, etc.
```

### 3. React Query patterns
```typescript
// ✅ SEMPRE usar arrow function em mutationFn
mutationFn: (data: TypeOfData) => apiFunction(data)

// ✅ SEMPRE tipar dados em useMutation
const mutation = useMutation<
  ReturnType,        // tipo de retorno da função
  ErrorType,         // tipo de erro
  VariableType       // tipo dos dados que serão passados
>({...})

// ✅ SEMPRE invalidar queries após mutação
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['entityKey'] });
}
```

### 4. Safe property access
```typescript
// ✅ CORRETO - usar nullish coalescing
value = item?.property ?? defaultValue
status = device?.status ?? 'offline'
count = array?.length ?? 0

// ✅ CORRETO - para arrays, sempre verificar
devices = data?.devices || []
items = (items || []).map(...)

// ✅ CORRETO - para unions
if (user.role === 'admin') { ... }
```

### 5. Imports must-haves
```typescript
// ANTES de escrever componente, adicione:
'use client'; // se for client component
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { [Interfaces] from '@/types';
import { toast } from 'sonner'; // para notificações

// E SEMPRE declare tipos de retorno:
export default function PageName(): React.ReactElement { }
function ComponentName(): React.ReactElement { }
const handleClick = useCallback((id: number): void => { }, []);
```

### 6. Common errors & fixes
```
ERROR: "Cannot find name 'xxx'"
FIX: Verificar se está importado, ou se existe em types/index.ts

ERROR: "Property 'xxx' does not exist on type 'Device'"
FIX: Verificar interface Device em types/index.ts, usar .clientId em vez de .organizationId

ERROR: "Type 'string' is not assignable to type 'UserRole'"
FIX: Usar um dos valores válidos: 'admin' | 'manager' | 'user' | 'readonly' | 'deviceReadonly'

ERROR: "Type '...' is not assignable to... mutationFn"
FIX: Envolver em arrow function: mutationFn: (data) => createFunction(data)

ERROR: "Cannot access property 'address' of undefined"
FIX: Usar nullish coalescing: item?.address ?? 'Desconhecido'
```

---

## 📋 Pre-commit checklist (30 segundos)

```bash
# 1. Build test (MUST PASS)
npm run build

# Expected output contains:
# ✓ Compiled successfully in X.Xs
# ✓ Generating static pages using X workers
```

No errors? ✅ Ready to commit!
Errors? → Fix → Run build again → Then commit

---

## File organization template

```typescript
// ========== IMPORTS (8 sections) ==========
1. React/Next imports
2. External libs (react-query, date-fns, etc)
3. Type imports
4. API imports
5. UI Component imports
6. Hooks/Stores imports
7. Utils imports
8. Icon imports

// ========== TYPES/INTERFACES ==========
interface ComponentProps { }
interface PageState { }

// ========== MAIN COMPONENT ==========
export default function ComponentName(): React.ReactElement {
  // 1. States
  // 2. Auth/Store
  // 3. Queries
  // 4. Mutations
  // 5. Callbacks
  // 6. Effects
  // 7. Render
}

// ========== SUB-COMPONENTS ==========
function SubComponent(): React.ReactElement { }
```

---

**Remember**: Build deve estar clean ANTES de qualquer commit. Não há exceções.
