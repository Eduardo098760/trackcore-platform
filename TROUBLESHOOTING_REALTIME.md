# Troubleshooting: Atualizações em Tempo Real do Mapa

## ✅ Verificação Rápida

### 1. **Abrir o Console do Navegador**
- Pressione `F12` → Aba "Console"
- Recarregue a página (`Ctrl+R` ou `Cmd+R`)

### 2. **Procurar pelos Logs de Debug**
Você deve ver mensagens assim:

```
[Map] WebSocket conectando...
[Map Render] 5 devices, 5 positions, 12 trail points total
[WS] Posições recebidas: 5
[Map] Processando 5 posições para 5 veículos
```

### 3. **Se VER `[WS] Posições recebidas`:**
✅ WebSocket está funcionando e recebendo dados para **TODOS** os veículos.

**O que você vai ver:**
- Ícones de caminhão aparecem no mapa
- Trilhas azuis conectando pontos recentes
- Setas rotacionadas no ícone indicando direção
- Atualizações contínuas (sem travar)

### 4. **Se NÃO VER nenhum log WebSocket:**
- Vai apareecer: `[Map] Iniciando polling de emergência...`
- Isso significa WebSocket não conectou, mas o **polling de emergência** vai atualizar as posições a cada 3 segundos
- Observe `[Polling] Atualizando com X posições`

---

## 🔧 Verificações Específicas

### **Caso A: Markers não aparecem**
```javascript
// No console, execute:
console.table([...positionMap.entries()])
```
- Se vazio: verifique se a API está retornando posições
- Teste: `await getPositions()` no console

### **Caso B: Trilhas não aparecem (linha azul)**
```javascript
// No console, execute:
console.table(Array.from(deviceTrails.entries()))
```
- Cada dispositivo deve ter um array de pontos `{lat, lng, ts}`
- Se vazio: WebSocket não está atualizando as trilhas

### **Caso C: Veículo específico não atualiza**
1. Abra DevTools → Network → WS (WebSocket)
2. Procure por mensagens tipo `positions`
3. Expanda a mensagem e procure pelo `deviceId` do veículo que não atualiza

---

## 📊 O que Esperamos Ver

### Estrutura de Dados do Estado Interno:

**deviceTrails (Map):**
```typescript
deviceTrails = new Map([
  [1, [{lat: -23.550, lng: -46.633, ts: 1706...}, {lat: -23.551, lng: -46.634, ts: 1706...}]],
  [2, [{lat: -23.555, lng: -46.640, ts: 1706...}]],
  [3, [{lat: -23.560, lng: -46.645, ts: 1706...}, ...]],
  ...
])
```

**deviceRecentDistance (Map):**
```typescript
deviceRecentDistance = new Map([
  [1, 0.234], // 234 metros nos últimos 5 min
  [2, 0.156],
  [3, 0.789],
  ...
])
```

---

## 🚀 Como Confirmar Que Está Funcionando

### **Teste 1: Movimento em Tempo Real**
1. Na página do mapa, selecione um veículo
2. Veja o painel lateral com:
   - ✅ Velocidade atualiza
   - ✅ Heading (ângulo) muda
   - ✅ Distância aumenta
   - ✅ Lista de trilha preenche

### **Teste 2: Múltiplos Veículos**
1. Abra o console
2. Procure por: `[Map Render] X devices`
3. Verifique que todos aparecem:
   - Ícones coloridos no mapa
   - Cada um com sua trilha
   - Cada um com sua seta de direção

### **Teste 3: Sem Parar**
1. Deixe a página aberta por 5+ minutos
2. Observe que trilhas continuam atualizando
3. Se parar, verifique console para erros

---

## 🐛 Debug Avançado

### Habilitar Logs Mais Detalhados

Edite `src/app/(dashboard)/map/page.tsx` e procure por `console.debug` para:
- Alterar de `.debug()` para `.log()` (mais visível)
- Adicionar `console.warn()` para erros

### Verificar Servidor WebSocket

No terminal/linha de comando:
```bash
# Verifique se o WebSocket está disponível
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:3001
```

### Verificar Traccar API

```bash
# Teste se /positions retorna dados
curl http://localhost:8082/api/positions \
  -H "Cookie: JSESSIONID=..."
```

---

## 📋 Checklist de Implementação

- [x] WebSocket client com normalização de mensagens
- [x] Polling fallback se WebSocket cair
- [x] Trilhas para TODOS os veículos (não só um)
- [x] Batch updates (todos os veículos de uma vez)
- [x] Debug logging em cada etapa
- [x] Renderização de polylines + arrows
- [x] Painel lateral com distância e heading
- [x] Marcadores com cores por status

---

## 💡 Próximas Melhorias (Opcional)

1. **Smooth Animation:** Animar marcador entre pontos em vez de pular
2. **Clustering:** Se houver 100+ veículos, agrupar próximos
3. **Heatmap:** Mostrar densidade de movimento por área
4. **Replay:** Reproduzir trajeto histórico acelerado
5. **Alertas:** Notificações quando veículo ultrapassa velocidade

