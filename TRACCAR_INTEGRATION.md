# Integração com Traccar API

Este projeto está totalmente integrado com a API do Traccar para rastreamento de veículos em tempo real.

**📚 Documentação Oficial:** https://www.traccar.org/api-reference

## 🔧 Configuração

### 1. Servidor Traccar

Certifique-se de ter o Traccar rodando:
- **URL padrão**: `http://localhost:8082`
- **Documentação**: https://www.traccar.org/api-reference/

### 2. Configuração do Frontend

1. Copie o arquivo de exemplo:
```bash
cp .env.local.example .env.local
```

2. Edite `.env.local` com a URL do seu servidor:
```env
NEXT_PUBLIC_API_URL=http://localhost:8082/api
```

### 3. CORS (Cross-Origin Resource Sharing)

O Traccar precisa permitir requisições do frontend. Adicione no arquivo `traccar.xml`:

```xml
<entry key='web.origin'>*</entry>
```

Ou especificamente para seu domínio:
```xml
<entry key='web.origin'>http://localhost:3000</entry>
```

## 📡 Endpoints Integrados

### Autenticação
- `POST /api/session` - Login (form-encoded)
- `GET /api/session` - Obter usuário atual
- `DELETE /api/session` - Logout

### Dispositivos
- `GET /api/devices` - Listar todos os dispositivos
- `GET /api/devices/{id}` - Obter dispositivo específico
- `POST /api/devices` - Criar dispositivo
- `PUT /api/devices/{id}` - Atualizar dispositivo
- `DELETE /api/devices/{id}` - Deletar dispositivo

### Posições
- `GET /api/positions` - Obter posições atuais
- `GET /api/positions?deviceId={id}` - Posições de um dispositivo

### Geofences
- `GET /api/geofences` - Listar geofences
- `POST /api/geofences` - Criar geofence
- `PUT /api/geofences/{id}` - Atualizar geofence
- `DELETE /api/geofences/{id}` - Deletar geofence

### Comandos
- `POST /api/commands/send` - Enviar comando para dispositivo
- `GET /api/commands` - Listar comandos

### Eventos
- `GET /api/events` - Listar eventos
- Parâmetros: `deviceId`, `from`, `to`, `type`

### Relatórios
- `GET /api/reports/route` - Relatório de rota
- Parâmetros: `deviceId`, `from`, `to`

### Grupos (mapeado como Clients)
- `GET /api/groups` - Listar grupos
- `POST /api/groups` - Criar grupo
- `PUT /api/groups/{id}` - Atualizar grupo
- `DELETE /api/groups/{id}` - Deletar grupo

## 🔐 Autenticação

O Traccar usa **autenticação baseada em sessão** (cookies), não JWT:

1. **Login**: Envia credenciais via `POST /api/session` (form-encoded)
2. **Sessão**: O servidor retorna um cookie `JSESSIONID`
3. **Requisições**: Todas as requisições incluem `credentials: 'include'`

O frontend mantém um token fake no localStorage apenas para compatibilidade com o sistema existente.

## 📊 Mapeamento de Dados

### Device Status
O status é calculado baseado em:
- **online**: `lastUpdate` < 5 minutos
- **offline**: `lastUpdate` > 5 minutos
- **moving**: `speed` > 0
- **stopped**: `speed` = 0 e online
- **blocked**: `attributes.blocked` = true

### Tipos de Comando
Comandos suportados pelo Traccar:
- `positionRequest` - Solicitar posição
- `engineStop` - Bloquear motor
- `engineResume` - Desbloquear motor
- `deviceReboot` - Reiniciar dispositivo
- `custom` - Comandos customizados

### Eventos
Tipos de eventos do Traccar:
- `deviceOnline` / `deviceOffline`
- `deviceMoving` / `deviceStopped`
- `geofenceEnter` / `geofenceExit`
- `alarm` - Alarmes diversos
- `ignitionOn` / `ignitionOff`
- E mais...

## 🚀 Iniciando

1. **Inicie o Traccar**:
```bash
# Linux/Mac
sudo systemctl start traccar

# Windows
# Inicie o serviço pelo Gerenciador de Serviços
```

2. **Configure o CORS** (veja seção acima)

3. **Crie um usuário admin** no Traccar:
- Acesse: http://localhost:8082
- Registre uma conta de administrador

4. **Inicie o frontend**:
```bash
npm run dev
```

5. **Faça login** com as credenciais do Traccar

## 🔄 WebSocket (Tempo Real)

Para atualizações em tempo real, o Traccar oferece WebSocket:

```javascript
const socket = new WebSocket('ws://localhost:8082/api/socket');

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.positions) {
    // Atualizar posições
  }
  if (data.devices) {
    // Atualizar dispositivos
  }
  if (data.events) {
    // Novos eventos
  }
};
```

Já existe uma implementação em `src/lib/websocket.ts` pronta para uso.

## 🐛 Troubleshooting

### Erro de CORS
```
Access to fetch at 'http://localhost:8082/api/session' has been blocked by CORS policy
```
**Solução**: Configure `web.origin` no `traccar.xml`

### 401 Unauthorized
**Solução**: Certifique-se de que:
1. As credenciais estão corretas
2. O cookie está sendo enviado (`credentials: 'include'`)
3. O usuário existe no Traccar

### Conexão recusada
```
Failed to fetch
```
**Solução**: Verifique se o Traccar está rodando em `localhost:8082`

### Dados não aparecem
**Solução**: 
1. Verifique se há dispositivos cadastrados no Traccar
2. Confirme que os dispositivos estão enviando dados
3. Veja os logs do Traccar: `/opt/traccar/logs/tracker-server.log`

## 📚 Recursos

- **Documentação oficial**: https://www.traccar.org/documentation/
- **API Reference**: https://www.traccar.org/api-reference/
- **Fórum**: https://www.traccar.org/forums/
- **GitHub**: https://github.com/traccar/traccar

## 🎯 Próximos Passos

- [ ] Implementar WebSocket para atualizações em tempo real
- [ ] Adicionar suporte a notificações push
- [ ] Implementar relatórios personalizados
- [ ] Adicionar sistema de permissões por usuário
- [ ] Integrar com sistema de vídeo telemetria
