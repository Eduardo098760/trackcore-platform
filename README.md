# Nova Web - Plataforma de Rastreamento Veicular

Plataforma moderna de rastreamento veicular (GPS Tracking) inspirada em sistemas profissionais como Traccar, Sascar e Omnilink.

## Tecnologias

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS** + **Shadcn/UI**
- **Mapbox** para mapas em tempo real
- **Zustand** para estado global
- **React Query** para cache e sincronização
- **API REST mockada** (pronta para integração com Traccar)

## Recursos

- ✅ Dashboard com métricas em tempo real
- ✅ Mapa interativo com rastreamento ao vivo
- ✅ Gerenciamento de veículos e frotas
- ✅ Histórico de percurso
- ✅ Eventos e alertas
- ✅ Comandos remotos (bloqueio/desbloqueio)
- ✅ Gestão de clientes e usuários
- ✅ Sistema de permissões (Admin, Operador, Cliente)
- ✅ Tema claro/escuro
- ✅ Design responsivo

## Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.local.example .env.local
# Edite .env.local e adicione seu token do Mapbox

# Executar em desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

## Credenciais de Teste (Mockado)

**Admin:**
- Email: admin@nova.com
- Senha: admin123

**Operador:**
- Email: operador@nova.com
- Senha: operador123

**Cliente:**
- Email: cliente@nova.com
- Senha: cliente123

## Estrutura do Projeto

```
src/
├── app/                    # App Router (Next.js 14)
│   ├── (auth)/            # Páginas de autenticação
│   ├── (dashboard)/       # Páginas do dashboard
│   └── api/               # API Routes (mockada)
├── components/            # Componentes React
│   ├── ui/               # Componentes Shadcn/UI
│   ├── layout/           # Layout components
│   ├── dashboard/        # Componentes do dashboard
│   └── maps/             # Componentes de mapas
├── lib/                   # Utilitários e configurações
│   ├── api/              # Serviços de API mockada
│   ├── hooks/            # Custom hooks
│   └── stores/           # Zustand stores
└── types/                 # TypeScript types
```

## API Mockada

A API está mockada e retorna dados realistas baseados no protocolo Traccar:

- `POST /api/auth/login` - Autenticação
- `GET /api/devices` - Lista de veículos
- `GET /api/positions` - Posições em tempo real
- `GET /api/events` - Eventos e alertas
- `POST /api/commands` - Comandos remotos
- `GET /api/users` - Usuários
- `GET /api/clients` - Clientes

## Próximos Passos

- [ ] Integrar com API real do Traccar
- [ ] Implementar WebSocket para atualizações em tempo real
- [ ] Adicionar notificações push
- [ ] Exportação de relatórios (PDF/Excel)
- [ ] App mobile (React Native)

## Licença

Proprietary - Todos os direitos reservados
