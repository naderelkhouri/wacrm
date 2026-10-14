# SYSTEM DESIGN DOCUMENT: WA-CRM & WHATSAPP-SAAS-API

**Documento:** Arquitetura e Engenharia de Sistema (HLD & LLD)  
**Versão:** 1.0.0  
**Data:** 16 de Setembro de 2026  
**Status:** Aprovado e Operacional em Produção  
**Autores:** Engenharia de Plataforma & Arquitetura de Sistemas ADMX Tech  
**Classificação:** Interno / Confidencial  

---

## 1. Sumário Executivo & Objetivos

O **WA-CRM** é uma plataforma SaaS enterprise de atendimento conversacional, CRM multicanal, automação e telefonia VoIP via WhatsApp. O sistema foi projetado para alta escalabilidade, isolamento rigoroso de múltiplos inquilinos (*multi-tenancy*), resiliência operacional e conformidade com as diretrizes oficiais da Meta Cloud API.

### Objetivos Arquiteturais
- **Multi-Tenancy Estrito**: Isolamento total de dados por empresa (`Company`), impedindo vazamento de informações entre organizações.
- **Transição Progressiva (Zero Downtime)**: Migração contínua dos módulos do legado Supabase para o backend proprietário Django 6 REST Framework, sem impacto nos operadores.
- **Desacoplamento Assíncrono**: Processamento de webhooks e envios em massa isolados em filas dedicadas gerenciadas por Celery e Redis.
- **Alta Disponibilidade e Segurança**: Borda protegida por Cloudflare com SSL corporativo, Proxy Reverso Nginx com TLS 1.3, e sessões em cookies HttpOnly criptografados.

---

## 2. Topologia e Arquitetura de Alto Nível (HLD)

A infraestrutura opera sobre um cluster Docker Swarm distribuído entre nós especializados, com rede overlay segura e controle estrito de ingress.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TOPOLOGIA DE ALTO NÍVEL DO SISTEMA                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   CLIENTES (Navegadores, WhatsApp Webhook, VoIP SIP/WebRTC)            │
│       │                              │                 │               │
│       ▼                              ▼                 ▼               │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ CLOUDFLARE EDGE (WAF, SSL/TLS Full Strict, DDOS, CDN Caching)│     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  │                                     │
│                     Tráfego HTTPS (Porta 443 / 80)                     │
│                                  │                                     │
│                                  ▼                                     │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ NÓ CORE-MANAGER (5.161.30.120)                               │     │
│   │                                                              │     │
│   │   Nginx Ingress Proxy (nginx_proxy_nginx-proxy)              │     │
│   │   ├── wacrm.admx.tech      ──▶ wacrm_app:3000                │     │
│   │   ├── api-crm.admx.tech    ──▶ whatsapp_saas_api:8000        │     │
│   │   └── /voip-ws             ──▶ voip_asterisk:8088/ws         │     │
│   │                                                              │     │
│   │   Rede Overlay: network_core_stack                           │     │
│   │   ├── Frontend: wacrm_app (Next.js 16 Standalone, React 19)  │     │
│   │   ├── Backend:  whatsapp_saas_api (Django 6 DRF, Gunicorn)   │     │
│   │   ├── Workers:  whatsapp_saas_worker (Celery 5.6)            │     │
│   │   ├── Beat:     whatsapp_saas_beat (Celery Beat Scheduler)   │     │
│   │   └── Cache:    redis_server_redis_server (Redis 7.2)        │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  │                                     │
│                     Rede Privada Inter-Nodes                           │
│                                  │                                     │
│                                  ▼                                     │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ NÓ CORE-DB (178.156.202.55)                                  │     │
│   │                                                              │     │
│   │   PostgreSQL Cluster (postgres_postgres:5432)                │     │
│   │   ├── Database: whatsapp_saas (Backend Django Principal)     │     │
│   │   └── Databases legados de suporte                           │     │
│   └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Subsistemas e Responsabilidades (LLD)

### 3.1. Camada de Apresentação (Frontend: `wacrm.admx.tech`)
- **Tecnologia**: Next.js 16.2.6 (Turbopack, App Router), React 19, Tailwind CSS, Lucide Icons, Radix UI.
- **Modo de Execução**: Node.js 20 Alpine Standalone Container (`wacrm_app:3000`).
- **Módulos Principais**:
  - `(auth)`: Login, Recuperação de senha, Onboarding e Convites.
  - `(dashboard)/dashboard`: Painel executivo com métricas agregadas de atendimento.
  - `(dashboard)/inbox`: Central de conversas em tempo real com suporte a mídia e notas internas.
  - `(dashboard)/contacts`: Gestão de contatos, deduplicação, paginação e campos customizados.
  - `(dashboard)/pipelines`: Funis de vendas em formato Kanban com drag-and-drop.
  - `(dashboard)/automations`: Construtor de automações e gatilhos de fluxo.
  - `(dashboard)/settings`: Configurações de IA, membros da equipe, instâncias e perfil.

### 3.2. Camada de Domínio e API (Backend: `api-crm.admx.tech`)
- **Tecnologia**: Python 3.12/3.13, Django 6.0.5, Django REST Framework 3.17.1, psycopg 3 (binário nativo).
- **Servidor WSGI**: Gunicorn 23.0.0 (3 workers síncronos com reciclagem por tempo de vida).
- **Aplicações Django Integradas**:
  - `accounts`: Usuários (`User`), autenticação JWT, perfis e roles de sistema.
  - `companies`: Empresas (`Company`), membros (`CompanyMember`) e convites (`CompanyInvitation`).
  - `whatsapp`: Instâncias (`WhatsAppInstance`), contatos (`Contact`), conversas (`Conversation`), mensagens (`Message`), anexos e templates.
  - `webhooks`: Ingestão segura de eventos da Meta e orquestração de bots n8n.
  - `billing`: Planos, limites de uso e controle de consumo.
  - `audit`: Trilha de auditoria para ações sensíveis de usuários.

### 3.3. Motor Assíncrono e Mensageria
- **Tecnologia**: Celery 5.6.3 + Redis 7.2 Alpine.
- **Topologia de Filas**:
  - `default`: Tarefas gerais de manutenção e sincronização periódica.
  - `whatsapp-send`: Fila prioritária de envio de mensagens (isolada para não ser bloqueada por campanhas massivas).
  - `webhook-ingest`: Processamento em lote de payloads brutos recebidos dos webhooks da Meta.
- **Celery Beat**: Agendamento de rotinas de limpeza, expiração de convites e consolidação de métricas.

---

## 4. Modelo de Dados e Multi-Tenancy

O isolamento é implementado no nível de aplicação e persistência relacional. Cada registro operacional referencia obrigatoriamente uma chave estrangeira para a entidade `Company`.

```
┌─────────────────┐       1:N       ┌────────────────────────┐
│     Company     │────────────────▶│      CompanyMember     │
└────────┬────────┘                 └───────────┬────────────┘
         │                                      │ N:1
         │ 1:N                                  ▼
         │                          ┌────────────────────────┐
         │                          │          User          │
         │                          └────────────────────────┘
         │
         ├─── 1:N ──▶ ┌────────────────────────┐
         │            │    WhatsAppInstance    │
         │            └───────────┬────────────┘
         │                        │ 1:N
         │                        ▼
         ├─── 1:N ──▶ ┌────────────────────────┐
         │            │      Conversation      │
         │            └───────────┬────────────┘
         │                        │ 1:N
         │                        ▼
         ├─── 1:N ──▶ ┌────────────────────────┐       N:1       ┌─────────────────┐
         │            │        Message         │────────────────▶│     Contact     │
         │            └────────────────────────┘                 └─────────────────┘
         │
         └─── 1:N ──▶ ┌────────────────────────┐
                      │        Template        │
                      └────────────────────────┘
```

### 4.1. Estrutura das Tabelas Principais

| Tabela | Chaves Principais | Índices de Performance | Papel no Domínio |
|---|---|---|---|
| `accounts_user` | `id`, `email`, `role` | `email`, `role` | Credenciais, timezone e empresa ativa |
| `companies_company` | `id`, `slug`, `owner_id` | `slug`, `status` | Tenant raiz da organização |
| `companies_companymember` | `id`, `company_id`, `user_id` | `[company, user]` UNIQUE | Papel do operador na empresa |
| `whatsapp_whatsappinstance` | `id`, `company_id`, `phone_id` | `api_key_instance`, `phone_id` | Conexão WhatsApp (Cloud API/Uazapi) |
| `whatsapp_contact` | `id`, `company_id`, `phone_number` | `[company, phone]` UNIQUE | Base de clientes e leads |
| `whatsapp_conversation` | `id`, `company_id`, `contact_id` | `[company, connection, contact]` | Sessão de chat e status de atendimento |
| `whatsapp_message` | `id`, `conversation_id`, `status` | `provider_message_id`, `created_at` | Mensagens trafegadas (inbound/outbound) |
| `webhooks_webhookevent` | `id`, `company_id`, `payload_hash` | `provider_event_id`, `status` | Histórico bruto de webhooks com idempotência |

---

## 5. Arquitetura de Autenticação e Segurança

### 5.1. Dual-Auth Edge Middleware

Para garantir transição transparente entre o legado Supabase e o Django DRF, o Edge Middleware do Next.js ([`src/middleware.ts`](file:///home/nader/wacrm-local/src/middleware.ts)) opera com inspeção unificada:

```
Requisição de Entrada
         │
         ▼
Edge Middleware (Next.js)
         │
         ├────────────────────────────────────────┐
         ▼                                        ▼
Cookie django_access_token?               Sessão Supabase Auth?
         │                                        │
    [Válido / Não expirado]                  [Sessão Ativa]
         │                                        │
         └───────────────────┬────────────────────┘
                             │
                      Autenticado?
                      ├── SIM ──▶ Permite acesso a /dashboard, /contacts, /inbox
                      └── NÃO ──▶ Redireciona 307 para /login
```

### 5.2. Ciclo de Vida do Token JWT
- **Access Token**: Validade de 60 minutos, armazenado em cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- **Refresh Token**: Validade de 14 dias com rotação automática via endpoint `/api/auth/refresh/`.
- **Prevenção de XSS**: Os tokens brutos não são expostos ao `localStorage` ou acessíveis via JavaScript no cliente.

### 5.3. Matriz de Permissões (RBAC)

| Papel (`role`) | Ver Painel | Responder Chats | Criar Contatos | Editar Configurações | Gerenciar Membros |
|---|:---:|:---:|:---:|:---:|:---:|
| **Superadmin** | Sim | Sim | Sim | Sim | Sim |
| **Owner** | Sim | Sim | Sim | Sim | Sim |
| **Admin** | Sim | Sim | Sim | Sim | Sim |
| **Operator** | Sim | Sim | Sim | Não | Não |
| **Viewer** | Sim | Não (Read-only) | Não | Não | Não |

---

## 6. Pipeline de Mensagens e Webhooks

### 6.1. Fluxo de Ingestão (Inbound Message)
1. A Meta envia requisição `POST` com payload assinado para `https://api-crm.admx.tech/api/webhooks/meta/whatsapp/`.
2. O endpoint valida o cabeçalho `X-Hub-Signature-256` contra o `META_APP_SECRET` usando HMAC-SHA256 em tempo constante (`hmac.compare_digest`).
3. O payload bruto é registrado em `webhooks_webhookevent` com status `received`.
4. Uma tarefa Celery (`process_meta_webhook`) é enfileirada na fila `webhook-ingest` e responde `HTTP 200` para a Meta em menos de 200ms.
5. O worker Celery localiza o `Contact`, resolve a `Conversation`, insere a `Message` e notifica os operadores conectados.

### 6.2. Fluxo de Envio (Outbound Message)
1. O operador envia uma mensagem pela interface web ou automação.
2. A API valida permissões do operador na `Company`.
3. A mensagem é gravada no PostgreSQL com status `queued`.
4. A tarefa `send_whatsapp_message` é enviada para a fila `whatsapp-send`.
5. O Celery executa a chamada HTTP à Graph API da Meta (`https://graph.facebook.com/v21.0/{phone_number_id}/messages`).
6. Ao receber o ID da mensagem da Meta, o status evolui: `queued` ──▶ `sent` ──▶ `delivered` ──▶ `read`.

---

## 7. Infraestrutura de Rede e Ingress

### 7.1. Configuração de Rede Docker Swarm
- **`network_core_stack`**: Rede overlay privada que conecta os serviços de aplicação (`wacrm_app`, `whatsapp_saas_api`, `whatsapp_saas_worker`, `redis_server`, `postgres`).
- **`proxy`**: Rede overlay de ingress dedicada à comunicação entre o `nginx-proxy` e os serviços web.
- **Portas Públicas Abertas**: Apenas portas 80 (HTTP) e 443 (HTTPS) expostas no nó `core-manager`. Todas as portas de banco de dados e filas são estritamente internas ou vinculadas a rede local protegida.

---

## 8. Roadmap de Migração Supabase ──▶ Django

A migração vertical ocorre sem interrupção de produção seguindo as etapas:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      MATRIZ DE MIGRAÇÃO PROGRESSIVA                    │
├────────────────────────────────────────────────────────────────────────┤
│ Módulo                 Backend Django        Frontend Next.js  Status  │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Infra & Banco       PostgreSQL 16         Swarm Stack       [CONCLUÍDO]
│ 2. Autenticação JWT    /api/auth/login/      Auth Bridge/Edge  [CONCLUÍDO]
│ 3. Gestão de Contatos  /api/contacts/        /api/contacts     [CONCLUÍDO]
│ 4. Conversas & Inbox   /api/conversations/   Inbox View        [EM ANDAMENTO]
│ 5. Instâncias WhatsApp /api/instances/       Settings View     [PLANEJADO]
│ 6. Templates Meta      /api/templates/       Templates View    [PLANEJADO]
│ 7. Campanhas / Celery  /api/campaigns/       Broadcast View    [PLANEJADO]
│ 8. Desativação Supabase Limpeza pacotes      Remoção SSR       [FINAL]
└────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Procedimentos de Operação e Comandos Úteis

### Verificação de Saúde da API
```bash
curl -s https://api-crm.admx.tech/api/health/ | jq .
```

### Logs dos Serviços no Docker Swarm
```bash
# API Django
ssh root@5.161.30.120 "docker service logs --tail 50 -f whatsapp_saas_api"

# Worker Celery
ssh root@5.161.30.120 "docker service logs --tail 50 -f whatsapp_saas_worker"

# Frontend Next.js
ssh root@5.161.30.120 "docker service logs --tail 50 -f wacrm_app"
```

### Execução de Migrações Manuais
```bash
ssh root@5.161.30.120 "docker exec \$(docker ps -q -f name=whatsapp_saas_api.1) python manage.py migrate"
```
