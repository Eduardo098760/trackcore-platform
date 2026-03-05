# Sistema de Notificações TrackCore

Sistema completo de notificações com suporte a múltiplos canais e notificações in-app em tempo real.

## ✨ Funcionalidades

### 📱 Notificações na Plataforma (In-App)
- ✅ Painel de notificações deslizante
- ✅ Badge com contador de não lidas no header
- ✅ Som configurável para notificações
- ✅ Notificações desktop do navegador
- ✅ Histórico de notificações (últimas 50)
- ✅ Marcar como lida individual ou em lote
- ✅ Excluir notificações
- ✅ Click para navegar para detalhes do veículo
- ✅ Indicador visual de notificações não lidas
- ✅ Atualização automática a cada 30 segundos

### 📧 Notificações por Email
- ✅ Envio de alertas por email
- ✅ Configuração de endereço de email
- ✅ Frequência configurável:
  - Instantâneo: Email imediato ao ocorrer evento
  - Horário: Resumo agrupado a cada hora
  - Diário: Resumo diário com todos os eventos

### 📱 Notificações por SMS
- ✅ Envio de SMS para eventos críticos
- ✅ Configuração de número de telefone
- 🔒 Funcionalidade premium (requer plano)

### 🔔 Notificações Push
- ✅ Preparado para integração com app móvel
- 📱 Push notifications para dispositivos móveis

## 🎯 Tipos de Eventos Configuráveis

| Evento | Descrição | Ícone | Criticidade |
|--------|-----------|-------|-------------|
| 🚨 SOS / Emergência | Botão de emergência acionado | ⚠️ | Alta |
| ⚡ Excesso de Velocidade | Veículo ultrapassou limite | 🚧 | Média |
| 📍 Entrada em Cerca | Entrou em geofence | ℹ️ | Baixa |
| 📍 Saída de Cerca | Saiu de geofence | ⚠️ | Média |
| 🔑 Ignição Ligada | Motor foi ligado | ✅ | Baixa |
| 🔑 Ignição Desligada | Motor foi desligado | ℹ️ | Baixa |
| 🔴 Dispositivo Offline | Perda de comunicação | 🚫 | Alta |
| 🟢 Dispositivo Online | Comunicação restabelecida | ✅ | Baixa |
| 🔋 Bateria Fraca | Nível crítico de bateria | 🚧 | Média |
| 🔧 Manutenção | Lembrete de manutenção | ℹ️ | Média |

## 🚀 Como Usar

### 1. Configurar Preferências
Acesse **Notificações** no menu principal para configurar:

1. **Ative os canais desejados** (in-app, email, SMS, push)
2. **Configure os detalhes** (email, telefone, frequência)
3. **Selecione os tipos de eventos** que deseja receber
4. **Clique em "Salvar Configurações"**

### 2. Receber Notificações
- **In-App**: Click no ícone 🔔 no header para ver o painel
- **Badge**: Mostra quantidade de notificações não lidas
- **Som**: Toca quando nova notificação chega (se habilitado)
- **Desktop**: Notificação do navegador (requer permissão)

### 3. Gerenciar Notificações
- **Marcar como lida**: Click na notificação
- **Marcar todas**: Botão "Marcar todas como lidas"
- **Excluir**: Hover na notificação e click no X
- **Limpar tudo**: Botão "Limpar tudo"
- **Ver detalhes**: Click na notificação para ir ao veículo

## 🔧 Arquitetura Técnica

### Componentes Criados

```
src/
├── components/
│   ├── ui/
│   │   ├── notification-badge.tsx      # Badge com contador
│   │   └── sheet.tsx                   # Modal deslizante
│   └── layout/
│       └── notification-panel.tsx      # Painel de notificações
├── lib/
│   └── notifications.ts                # Manager de notificações
└── app/(dashboard)/
    └── notifications/
        └── page.tsx                    # Página de configurações
```

### Fluxo de Dados

```
Evento Traccar
    ↓
NotificationManager.addNotification()
    ↓
localStorage (persistência)
    ↓
React Query (cache + sync)
    ↓
UI (Badge + Panel)
```

### Armazenamento

**LocalStorage Keys:**
- `inAppNotifications` - Lista de notificações
- `notificationSettings` - Configurações do usuário

**Estrutura de Notificação:**
```typescript
{
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  deviceId?: number;
  deviceName?: string;
  eventType?: string;
}
```

## 🎨 Customização

### Adicionar Novo Tipo de Evento

1. **Atualizar tipos** em `src/app/(dashboard)/notifications/page.tsx`:
```typescript
events: {
  ...existing,
  newEvent: boolean,
}
```

2. **Adicionar label** no eventLabels:
```typescript
newEvent: { 
  label: 'Novo Evento', 
  icon: Icon, 
  color: 'text-color' 
}
```

3. **Disparar notificação**:
```typescript
import { notificationManager } from '@/lib/notifications';

notificationManager.addNotification({
  type: 'warning',
  title: 'Novo Evento',
  message: 'Descrição do evento',
  deviceId: 123,
  deviceName: 'ABC-1234',
  eventType: 'newEvent'
});
```

## 🔌 Integração com Traccar

Para integrar com eventos reais do Traccar:

1. **WebSocket Connection** (futuro):
```typescript
const ws = new WebSocket('ws://traccar-server/api/socket');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.events) {
    data.events.forEach(event => {
      notificationManager.simulateEvent(
        event.type,
        device.name,
        device.id,
        event.attributes?.message
      );
    });
  }
};
```

2. **Polling** (atual):
```typescript
// Verificar eventos periodicamente
useQuery({
  queryKey: ['events'],
  queryFn: getEvents,
  refetchInterval: 30000,
  onSuccess: (events) => {
    events.forEach(event => {
      // Processar e criar notificação
    });
  }
});
```

## 📊 Performance

- **Limite de notificações**: 50 mais recentes
- **Intervalo de atualização**: 30 segundos
- **Persistência**: LocalStorage (offline-first)
- **Som**: AudioContext API (sem arquivos externos)
- **Desktop**: Notification API do navegador

## 🔒 Segurança

- ✅ Notificações isoladas por usuário (localStorage)
- ✅ Sem dados sensíveis em localStorage
- ✅ Permissões de navegador respeitadas
- ✅ Validação de tipos e eventos

## 📱 Responsividade

- ✅ Mobile: Panel full-screen
- ✅ Tablet: Panel lateral (440px)
- ✅ Desktop: Panel lateral (440px)
- ✅ Touch-friendly controls

## 🎯 Próximos Passos

1. ✅ Sistema básico implementado
2. 🔄 Integrar com WebSocket do Traccar
3. 🔄 Implementar envio real de emails (via API)
4. 🔄 Integrar serviço de SMS
5. 🔄 App móvel com push notifications
6. 🔄 Analytics de notificações
7. 🔄 Templates personalizáveis
8. 🔄 Agrupamento inteligente de notificações

## 🧪 Testando

### Simular Notificação (Console do Navegador):
```javascript
// Importar o manager
const { notificationManager } = await import('/src/lib/notifications');

// Criar notificação de teste
notificationManager.simulateEvent(
  'speedLimit',
  'ABC-1234',
  1,
  'excedeu 100 km/h na Marginal Tietê'
);
```

### Testar Som:
```javascript
const settings = JSON.parse(localStorage.getItem('notificationSettings'));
settings.inApp.sound = true;
localStorage.setItem('notificationSettings', JSON.stringify(settings));
```

### Testar Desktop Notification:
```javascript
if ('Notification' in window) {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      new Notification('Teste', {
        body: 'Notificação de teste',
        icon: '/favicon.ico'
      });
    }
  });
}
```

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique o console do navegador
2. Verifique as configurações em `/notifications`
3. Teste com diferentes tipos de eventos
4. Limpe o localStorage se necessário

---

**Desenvolvido com ❤️ para TrackCore Platform**
