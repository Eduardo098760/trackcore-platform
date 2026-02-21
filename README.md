# TrackCore — Plataforma de Rastreamento Veicular

> Plataforma profissional de rastreamento GPS integrada ao **Traccar**, com painel em tempo real, cercas eletrônicas, relatórios, auditoria e gestão completa de frotas.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 16** (App Router + Turbopack) |
| Linguagem | **TypeScript** |
| UI | **TailwindCSS** + **Shadcn/UI** |
| Mapas | **React-Leaflet** (OSM, Carto, Satelite) |
| Estado global | **Zustand** |
| Cache / sync | **React Query (TanStack Query)** |
| Backend GPS | **Traccar** (API REST + WebSocket) |
| Tempo real | **WebSocket nativo** (posicoes ao vivo) |

---

## Funcionalidades

### Mapa em Tempo Real
- Rastreamento ao vivo de todos os veiculos da frota
- Estilos de mapa: Escuro, Claro, Ruas e Satelite
- Painel lateral com detalhes do veiculo (velocidade, status, endereco)
- Seguir veiculo automaticamente no mapa
- Replay de percurso historico com controle de velocidade
- **Cercas eletronicas visiveis no mapa** com toggle de exibicao
- Rota planejada sobreposta ao mapa

### Cercas Eletronicas (Geofences)
- Criacao de cercas por desenho no mapa (poligono e circulo)
- Edicao e exclusao de cercas
- **Vinculacao de cercas a veiculos especificos**
- Visualizacao colorida no mapa principal
- Integracao nativa com a API do Traccar

### Dashboard
- Metricas em tempo real: veiculos online, em movimento, parados, offline
- Grafico de status da frota
- Eventos recentes da frota
- Cards de estatisticas

### Relatorios
- Relatorio de viagens (trips)
- Relatorio de paradas (stops)
- Relatorio de eventos
- Relatorio de resumo por veiculo
- Exportacao em **PDF** e **Excel**

### Gestao de Frota
- Veiculos: cadastro, edicao, status em tempo real
- Motoristas: vinculacao a dispositivos
- Grupos de veiculos
- Organizacoes / multi-tenant

### Notificacoes e Eventos
- Sistema de notificacoes em tempo real via WebSocket
- Templates de notificacao configuraveis
- Historico de eventos por veiculo
- Alertas de video

### Seguranca e Auditoria
- **Log de auditoria** de todas as acoes do sistema
- Comandos remotos (bloqueio/desbloqueio de veiculo)
- Sistema de permissoes: Admin, Operador, Cliente
- Autenticacao integrada com Traccar

### Outros Recursos
- Historico de percurso com mapa interativo
- Atributos computados
- Manutencao preventiva
- OBD (diagnostico veicular)
- Cameras e video ao vivo
- Calendarios
- Rotas planejadas
- Estatisticas avancadas
- Configuracoes de conta
- Tema claro/escuro
- Design responsivo (mobile-first)

---

## Instalacao

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variaveis de ambiente
cp .env.local.example .env.local
# Edite .env.local com as credenciais do seu servidor Traccar

# 3. Executar em desenvolvimento (com Turbopack)
npm run dev
```

### Variaveis de ambiente necessarias

```env
NEXT_PUBLIC_TRACCAR_URL=http://seu-servidor-traccar:8082
TRACCAR_ADMIN_USER=admin
TRACCAR_ADMIN_PASSWORD=sua-senha
```

---

## Estrutura do Projeto

```
src/
├── app/
│   ├── (auth)/                # Login, recuperacao de senha
│   ├── (dashboard)/           # Todas as paginas do painel
│   │   ├── map/               # Mapa em tempo real
│   │   ├── geofences/         # Cercas eletronicas
│   │   ├── vehicles/          # Gestao de veiculos
│   │   ├── drivers/           # Motoristas
│   │   ├── reports/           # Relatorios
│   │   ├── history/           # Historico / Replay
│   │   ├── events/            # Eventos e alertas
│   │   ├── commands/          # Comandos remotos
│   │   ├── notifications/     # Notificacoes
│   │   ├── audit/             # Log de auditoria
│   │   └── ...
│   └── api/                   # API Routes internas
├── pages/api/                 # Proxy para Traccar + APIs auxiliares
│   ├── traccar/               # Proxy reverso para Traccar
│   ├── reports/               # APIs de relatorios (PDF/Excel)
│   └── audit/                 # API de auditoria
├── components/
│   ├── ui/                    # Shadcn/UI base components
│   ├── layout/                # Header, Sidebar, Notification Panel
│   └── dashboard/             # Cards, graficos, paineis
├── lib/
│   ├── api/                   # Servicos: devices, geofences, reports...
│   ├── hooks/                 # Custom hooks (WebSocket, auth, etc.)
│   ├── stores/                # Zustand stores
│   └── server/                # Utilitarios server-side
└── types/                     # TypeScript types globais
```

---

## Licenca

Proprietario — Todos os direitos reservados © TrackCore
