# Projeto de Expansão Arquitetônica — WCloudAPI & WACRM
**Estratégia Progressiva de Infraestrutura, Sharding de Instâncias e Orçamento Cloud**

---

## 1. Visão Geral e Diretrizes Estratégicas

Este documento estabelece o plano formal de arquitetura e infraestrutura progressiva para o **WCloudAPI / WACRM**, permitindo o crescimento estável da plataforma a partir dos primeiros clientes até centenas de contas ativas com alta densidade de conexões WhatsApp.

### Premissas do Negócio e Sistema:
- **Limite por Bloco da API Não Oficial (Uazapi)**: Cada licença/nó da Uazapi suporta blocos de até **300 instâncias ativas**.
- **Crescimento Progressivo**: A infraestrutura deve acompanhar o número de clientes pagantes (10 → 50 → 100 → 300+ clientes), garantindo que o custo operacional seja proporcional à receita sem desperdício prematuro de recursos.
- **Isolamento de Falhas (Fault Isolation)**: Falhas ou manutenções em um bloco de instâncias não podem degradar os demais nós nem a interface central do CRM.
- **Dualidade de Canais**: Convivência nativa e transparente entre as instâncias prioritárias da **Uazapi (não oficial)** e a **Meta Cloud API (oficial)**.

---

## 2. Topologia Geral & Arquitetura de Sharding (Blocos de 300)

O particionamento de instâncias (sharding horizontal) é governado pela camada central do WCloudAPI, utilizando a coluna `api_url` da tabela `whatsapp_config` como ponte de roteamento inteligente.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                   TOPOLOGIA GERAL DO SISTEMA EM CLUSTER                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              [ INTERNET / USUÁRIOS ]                        │
│                                         │                                   │
│                                         ▼                                   │
│                        [ Nginx Proxy / Cloudflare Edge ]                    │
│                                         │                                   │
│                   ┌─────────────────────┴─────────────────────┐             │
│                   ▼                                           ▼             │
│       ┌───────────────────────┐                   ┌───────────────────────┐ │
│       │   WACRM Frontend/API  │                   │ Supabase PostgreSQL   │ │
│       │   (Next.js Standalone)│◀─────────────────▶│ (Banco Central / RLS) │ │
│       └───────────┬───────────┘                   └───────────────────────┘ │
│                   │                                           ▲             │
│    Roteamento por │                                           │             │
│    `api_url`      │                    Eventos Webhook        │             │
│                   ▼                  (Inbound / Sync fromMe)  │             │
│       ┌───────────────────────┐                               │             │
│       │ Roteador de Shards    │───────────────────────────────┘             │
│       └───────────┬───────────┘                                             │
│                   │                                                         │
│         ┌─────────┴───────────────────────┐                                 │
│         ▼                                 ▼                                 │
│  ┌─────────────────────────┐       ┌─────────────────────────┐              │
│  │    SHARD / BLOCO 01     │       │    SHARD / BLOCO 02     │              │
│  │ (Instâncias 001 a 300)  │       │ (Instâncias 301 a 600)  │              │
│  ├─────────────────────────┤       ├─────────────────────────┤              │
│  │ • Uazapi Node 01        │       │ • Uazapi Node 02        │              │
│  │ • Baileys Engine        │       │ • Baileys Engine        │              │
│  │ • Redis Local / Cache   │       │ • Redis Local / Cache   │              │
│  │ • Capacidade: 300 slots │       │ • Capacidade: 300 slots │              │
│  │ • Status: [ CHEIO ]     │       │ • Status: [ ATIVO ]     │              │
│  └─────────────────────────┘       └─────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Funcionamento do Roteador de Sharding:
1. **Provisionamento**: Ao conectar um novo WhatsApp, o sistema verifica a contagem de instâncias de cada bloco (`SELECT count(*) FROM whatsapp_config WHERE api_url = ...`). O novo canal é provisionado no bloco que possuir vagas (`count < 300`).
2. **Despacho Outbound**: Ao enviar mensagens (Inbox, Transmissão, Fluxo ou IA), o helper `resolveWhatsAppConfig()` carrega as credenciais e o `api_url` correspondente, realizando a chamada diretamente no nó correto.
3. **Ingestão Inbound (Webhooks)**: Todos os shards reportam seus eventos para o webhook unificado `https://wcloudapi.dev/api/whatsapp/webhook`. O identificador de instância (`instance_name` / `phone_number_id`) garante a associação imediata com a conta e a conversa no banco central.

---

## 3. Fases Progressivas de Expansão

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MATRIZ DE FASES & CAPACIDADE                       │
├────────┬─────────────────┬──────────────────┬───────────────────────────────┤
│ Fase   │ Clientes Alvo   │ Instâncias WPP   │ Infraestrutura Física         │
├────────┼─────────────────┼──────────────────┼───────────────────────────────┤
│ Fase 1 │ 1 a 20 clientes │ 1 a 50 contas    │ 2 a 3 VPS (Docker Swarm atual)│
│ Fase 2 │ 20 a 100 clts   │ 50 a 200 contas  │ 3 VPS Dedicadas (1 Mgr + 2 Wk)│
│ Fase 3 │ 100 a 300+ clts │ 300+ (Multibloco)│ 4 a 6 VPS (Nós Uazapi Shards) │
└────────┴─────────────────┴──────────────────┴───────────────────────────────┘
```

### Fase 1: Fundação & Validação (1 a 20 clientes / até 50 instâncias)
- **Cenário Atual**: 2 a 3 VPS operando em Docker Swarm na produção (`5.161.30.120`).
- **Arquitetura**:
  - `VPS 01 (Swarm Manager / App)`: Aplicação WACRM Next.js Standalone, Nginx Reverse Proxy, Certbot SSL e Supabase API/DB local.
  - `VPS 02 (Worker / Uazapi)`: Instância única de Uazapi com Baileys e Redis gerenciando as primeiras conexões.
  - `VPS 03 (Worker / Auxiliar)`: Reserva de failover, cópia fria/morna do banco e workers de background (n8n/celery se aplicável).

### Fase 2: Escala Comercial (20 a 100 clientes / 50 a 200 instâncias)
- **Arquitetura**:
  - Distribuição em 3 VPS dedicadas de maior capacidade:
    - **Nó 1 (Manager & Ingress)**: WACRM App, Gateway de entrada, SSL, gerenciador do Swarm.
    - **Nó 2 (Database & Queues)**: Banco PostgreSQL / Supabase isolado com discos NVMe para suportar alto volume de mensagens e webhooks sem concorrência de I/O.
    - **Nó 3 (WhatsApp Shard 01)**: Uazapi rodando até 200 instâncias com Redis dedicado para cache de sessões.

### Fase 3: Cluster Shardado em Blocos (100 a 300+ clientes / Múltiplos Blocos de 300)
- **Arquitetura**:
  - Atingido o limite de 300 conexões no primeiro bloco, adiciona-se uma nova VPS dedicada exclusivamente para o **Bloco 02 da Uazapi** (`uazapi-node02.wcloudapi.dev`).
  - O banco central mantém a integridade relacional de todas as contas, enquanto o tráfego de WebSockets e sessões do WhatsApp fica fatiado entre as máquinas especializadas.

---

## 4. Orçamento Comparativo de Infraestrutura (Cluster 3 Nós)

Comparamos os 3 maiores players europeus reconhecidos pela excelência em custo-benefício para hospedagem de containers e servidores de mensageria:

### 4.1. Cenário de Entrada: 4 vCPUs e 8 GB de RAM por Nó (Total: 12 vCPUs / 24 GB RAM)
*Recomendado para as Fases 1 e 2 (até 150 instâncias simultâneas no cluster).*

```text
┌──────────────────────┬──────────────┬───────────────┬──────────────┬────────────────────────┐
│ Provedor             │ Config / Nó  │ Preço / Nó    │ Tráfego / Nó │ Total Mensal (3 Nós)   │
├──────────────────────┼──────────────┼───────────────┼──────────────┼────────────────────────┤
│ 1. Contabo           │ 4 vCPU, 8 GB │ € 5,50 - 6,50 │ Ilimitado    │ ~ € 18,00 (~ R$ 110)   │
│    (Maior Margem)    │ 100 GB NVMe  │ (~ $ 6,00)    │ (32 TB port) │ ★ MAIOR MARGEM         │
├──────────────────────┼──────────────┼───────────────┼──────────────┼────────────────────────┤
│ 2. Netcup            │ 4 vCPU, 8 GB │ € 10,30-12,00 │ Ilimitado    │ ~ € 36,00 (~ R$ 215)   │
│    (DDR5 / 2.5 Gbps) │ 128 GB SSD   │ (~ $ 12,50)   │ (2.5 Gbps)   │ ★ EQUILÍBRIO TÉCNICO   │
├──────────────────────┼──────────────┼───────────────┼──────────────┼────────────────────────┤
│ 3. Hetzner Cloud     │ 4 vCPU, 8 GB │ € 14,50-15,90 │ 20 TB / mês  │ ~ € 45,00 (~ R$ 270)   │
│    (Referência Dev)  │ 80 GB NVMe   │ (~ $ 16,00)   │              │ ★ MELHOR API & REDE    │
└──────────────────────┴──────────────┴───────────────┴──────────────┴────────────────────────┘
```

### 4.2. Cenário Intermediário: 6 a 8 vCPUs e 16 GB de RAM por Nó (Total: 24 vCPUs / 48 GB RAM)
*Recomendado para atingir a meta de 300 instâncias ativas no primeiro bloco com alta folga de CPU.*

```text
┌──────────────────────┬──────────────┬───────────────┬──────────────┬────────────────────────┐
│ Provedor             │ Config / Nó  │ Preço / Nó    │ Tráfego / Nó │ Total Mensal (3 Nós)   │
├──────────────────────┼──────────────┼───────────────┼──────────────┼────────────────────────┤
│ 1. Contabo (Cloud 6) │ 6 vCPU, 16 GB│ € 10,50 / mês │ Ilimitado    │ ~ € 31,50 (~ R$ 190)   │
├──────────────────────┼──────────────┼───────────────┼──────────────┼────────────────────────┤
│ 2. Netcup (VPS 2000) │ 8 vCPU, 16 GB│ € 19,20 / mês │ Ilimitado    │ ~ € 57,60 (~ R$ 345)   │
├──────────────────────┼──────────────┼───────────────┼──────────────┼────────────────────────┤
│ 3. Hetzner (CX42)    │ 8 vCPU, 16 GB│ € 28,50 / mês │ 20 TB / mês  │ ~ € 85,50 (~ R$ 515)   │
└──────────────────────┴──────────────┴───────────────┴──────────────┴────────────────────────┘
```

---

## 5. Prós, Contras e Parecer Técnico dos Provedores

### Contabo (Alemanha / EUA / Ásia)
- **Pontos Fortes**: Preço imbatível no mercado global. Permite alocar servidores com grande quantidade de RAM e vCPU por uma fração do preço dos concorrentes. Tráfego ilimitado.
- **Pontos de Atenção**: O I/O de disco em planos básicos compartilha storage; recomenda-se selecionar o addon de **NVMe storage** puro durante o checkout para garantir alta velocidade nas sessões do SQLite/Redis.
- **Veredito**: **Ideal para o estágio atual**. Com 3 nós de 16 GB por apenas ~R$ 190/mês, maximiza a lucratividade inicial.

### Netcup (Alemanha)
- **Pontos Fortes**: Infraestrutura germânica moderna baseada em processadores AMD EPYC e memórias DDR5. Rede interna com porta de 2.5 Gbps sem franquia restritiva. Excelente estabilidade e histórico de uptime.
- **Pontos de Atenção**: Contratos anuais oferecem descontos significativos (plano mensal flexível tem leve acréscimo).
- **Veredito**: Excelente alternativa à Hetzner com performance bruta de processamento superior e 30% a 40% de economia.

### Hetzner Cloud (Alemanha / Finlândia / EUA)
- **Pontos Fortes**: API de automação e gerenciamento líder de mercado, integração nativa com Docker Swarm, redes virtuais privadas gratuitas (vSwitch de 10 Gbps entre nós) e provisionamento em segundos.
- **Pontos de Atenção**: Sofreu reajustes de preço em 2026 nas linhas AMD (CPX). O custo mensal por nó de 16 GB é sensivelmente superior ao da Contabo.
- **Veredito**: A melhor escolha corporativa se o foco for automação contínua de infraestrutura e baixa latência de rede.

---

## 6. Roteiro de Implementação Técnica

1. **Passo 1 (Imediato)**: Adição do 3º nó ao Docker Swarm atual na Hetzner/VPS disponível (`docker swarm join --token worker`).
2. **Passo 2**: Configuração de label de nós no Swarm (`docker node update --label-add role=whatsapp node3`).
3. **Passo 3**: Isolamento dos serviços de mensageria da Uazapi no Nó 3, aliviando o Nó 1 (Manager/DB).
4. **Passo 4**: Ativação do monitoramento de métricas (Dozzle / Node Exporter / Prometheus) para acompanhar o consumo por instância conectada.
5. **Passo 5 (Ao atingir 250 instâncias)**: Provisionamento automático ou manual da VPS do **Bloco 02**, registrando seu `api_url` no painel administrativo do WCloudAPI.

---
*Documento registrado em 07 de Novembro de 2026.*  
*Projeto WCloudAPI / WACRM — Infraestrutura e Engenharia de Sistemas.*
