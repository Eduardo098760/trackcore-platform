# Teste Completo: Dashboard com Eventos do Traccar

## Status Atual
✅ **Proxy Reversible configurado** em `/api/traccar/*`  
✅ **Endpoint de debug** em `/api/traccar-debug/*`  
✅ **Login integrado** com Traccar  
✅ **Servidor dev** rodando em `http://localhost:3000`  

## Problemas Identificados e Soluções

### 1. **Autenticação Necessária**
O Traccar requer autenticação para acessar `/api/reports/events` e `/api/positions`.

**Solução:** 
- Acesse `http://localhost:3000/login`
- Faça login com suas credenciais do Traccar (ex: admin@example.com / admin)
- O Traccar retorna um cookie de sessão que o proxy encaminha para o navegador

### 2. **Path Variants (com/sem /api/)**
O Traccar pode usar diferentes estruturas de URL.

**Status:** O proxy tenta ambas as variantes automaticamente:
- `http://sv01.rastrear.app.br/api/events`
- `http://sv01.rastrear.app.br/events`

Use `/api/traccar-debug/events` para ver qual variant funciona.

## Próximos Passos (Manual)

### 1. Testar Login
```bash
curl -X POST http://localhost:3000/api/traccar/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin"}'
```

**Esperado:** Status 200, cookie de sessão no header `set-cookie`

### 2. Testar Debug Endpoint
```bash
curl http://localhost:3000/api/traccar-debug/events
```

**Esperado:** JSON mostrando qual URL funcionou:
```json
{
  "ok": true,
  "tried": [
    {
      "url": "http://sv01.rastrear.app.br/api/events",
      "status": 401,
      "statusText": "Unauthorized"
    },
    {
      "url": "http://sv01.rastrear.app.br/events",
      "status": 401,
      "statusText": "Unauthorized"
    }
  ]
}
```

Se após login ainda der 401, pode ser que:
- Cookies não estão sendo enviados corretamente
- Sessão expirou
- Usuário não tem permissão para acessar eventos

### 3. Testar via Navegador
1. Abra `http://localhost:3000/login`
2. Faça login com seu usuário Traccar
3. Será redirecionado para `/dashboard`
4. Os eventos devem aparecer na seção "Recent Events"

## Se Não Funcionar

### 1. Verificar Logs do Dev Server
Procure por linhas com `[traccar-proxy]`:
```
[traccar-proxy] forwarding -> http://sv01.rastrear.app.br/api/events
[traccar-proxy] upstream error 401 Unauthorized
```

### 2. Verificar Cookies
No DevTools do navegador (F12 → Application → Cookies):
- Deve ter um cookie de sessão após login
- Nome pode ser `JSESSIONID` ou similar

### 3. Forçar Recalcular Path Variant
Se uma variant sempre falhar, você pode forçar a outra editando `.env.local`:
```env
TRACCAR_ADD_API=false  # Tenta sem /api/ primeiro
```
Depois reinicie o dev server com `npm run dev`.

## Arquivos Modificados

- `src/pages/api/traccar/[...path].ts` - Proxy reverso com suporte a múltiplas variantes
- `src/pages/api/traccar-debug/[...path].ts` - Endpoint de diagnóstico
- `src/pages/api/traccar/login.ts` - Endpoint de login (bonus)
- `.env.local` - Configuração com URL do Traccar

## Fluxo de Dados

```
Navegador
   ↓
[Login em /login]
   ↓
POST /api/traccar/login → Proxy → Traccar /api/session
   ↓
[Recebe cookie JSESSIONID]
   ↓
GET /api/traccar/events → Proxy → Traccar /api/events (COM cookie)
   ↓
[Dashboard exibe eventos]
```

## Dúvidas?

Se o dashboard não exibir eventos mesmo após login:

1. Verifique nos logs: `npm run dev` deve mostrar `[traccar-proxy]` linhas
2. Teste o endpoint direto: `http://sv01.rastrear.app.br/api/server` (sem auth)
3. Verifique que o usuário Traccar tem permissão para ver eventos/posições
