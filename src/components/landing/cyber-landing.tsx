"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Zap,
  ShieldCheck,
  Bot,
  Workflow,
  Layers,
  MessageSquare,
  ArrowRight,
  Cpu,
  Globe,
  CheckCircle2,
  Terminal,
  Activity,
  Kanban,
  Radio,
  Lock,
  Play,
  ChevronRight,
  Send,
  RefreshCw,
} from "lucide-react";

type SupportedLocale = "pt-BR" | "en" | "es";

interface CyberLandingProps {
  initialLocale?: string;
  isAuthenticated?: boolean;
}

const COPY: Record<
  SupportedLocale,
  {
    nav: {
      surrealGallery: string;
      architecture: string;
      liveSimulator: string;
      mcpProtocol: string;
      login: string;
      signup: string;
      dashboard: string;
      inbox: string;
    };
    hero: {
      badge: string;
      titleLead: string;
      titleHighlight: string;
      titleTail: string;
      subtitle: string;
      ctaPrimary: string;
      ctaSecondary: string;
      ctaAuthed: string;
      hud1Title: string;
      hud1Sub: string;
      hud2Title: string;
      hud2Sub: string;
      hud3Title: string;
      hud3Sub: string;
    };
    metrics: Array<{ value: string; label: string; detail: string }>;
    trilogy: {
      eyebrow: string;
      heading: string;
      subheading: string;
      cards: Array<{
        id: string;
        tag: string;
        title: string;
        subtitle: string;
        description: string;
        image: string;
        accent: string;
        bullets: string[];
      }>;
    };
    simulator: {
      eyebrow: string;
      heading: string;
      subheading: string;
      tabs: Array<{
        id: string;
        label: string;
        instanceName: string;
        instanceColor: string;
        provider: string;
        contactName: string;
        contactRole: string;
        messages: Array<{
          sender: "contact" | "ai" | "system";
          text: string;
          meta: string;
        }>;
        telemetry: Array<{ label: string; value: string; status: string }>;
      }>;
    };
    bento: {
      eyebrow: string;
      heading: string;
      subheading: string;
      items: Array<{
        title: string;
        description: string;
        badge: string;
      }>;
    };
    ctaFooter: {
      badge: string;
      title: string;
      subtitle: string;
      buttonPrimary: string;
      buttonSecondary: string;
      copyright: string;
    };
  }
> = {
  "pt-BR": {
    nav: {
      surrealGallery: "Dimensões",
      architecture: "Arquitetura",
      liveSimulator: "Simulador Neural",
      mcpProtocol: "Protocolo MCP",
      login: "Entrar",
      signup: "Criar Conta",
      dashboard: "Abrir Painel",
      inbox: "Ir para o Inbox",
    },
    hero: {
      badge: "ARQUITETURA CYBER-NEURAL PARA WHATSAPP • META CLOUD API + UAZAPI",
      titleLead: "O Hiper-Núcleo",
      titleHighlight: "Surrealista de Conversão",
      titleTail: "e Automação no WhatsApp.",
      subtitle:
        "Unifique múltiplas contas de WhatsApp (Oficial Meta e Uazapi), agentes autônomos de IA com memória RAG, construtor visual de fluxos, funis Kanban multi-moeda e protocolo MCP nativo em uma única estação de comando.",
      ctaPrimary: "Iniciar Operação Agora",
      ctaSecondary: "Explorar Simulador Neural",
      ctaAuthed: "Acessar Estação de Comando",
      hud1Title: "Multi-Instância Ativa",
      hud1Sub: "Meta API + Uazapi em paralelo",
      hud2Title: "Oráculo IA + RAG",
      hud2Sub: "Respostas em 180ms com contexto",
      hud3Title: "Servidor MCP Nativo",
      hud3Sub: "JSON-RPC 2.0 • Claude / Cursor / n8n",
    },
    metrics: [
      {
        value: "∞ Linhas",
        label: "Multi-Instância Real",
        detail: "Conecte múltiplos números Meta e Uazapi no mesmo negócio",
      },
      {
        value: "< 180ms",
        label: "Roteamento & Webhook",
        detail: "Sincronização em tempo real via WebSockets e fila assíncrona",
      },
      {
        value: "RAG + MCP",
        label: "Cérebro Cognitivo",
        detail: "Base de conhecimento vetorial e integração direta com agentes IA",
      },
      {
        value: "100% API",
        label: "Ecossistema Aberto",
        detail: "REST API v1, Webhooks assinados via HMAC-SHA256 e SDKs",
      },
    ],
    trilogy: {
      eyebrow: "TRILOGIA DA HIPER-CONVERGÊNCIA",
      heading: "Engenharia de Ponta com Estética de Outra Dimensão",
      subheading:
        "Cada módulo do WCloudAPI foi projetado para eliminar gargalos operacionais e transformar conversas brutas em receita previsível.",
      cards: [
        {
          id: "multi-instance",
          tag: "DIMENSÃO 01 • MULTI-LINHA",
          title: "Convergência Multi-Instância",
          subtitle: "Várias contas do WhatsApp no mesmo Workspace",
          description:
            "Opere linhas comerciais, suporte e diretoria simultaneamente. Combine a estabilidade da Meta Cloud API Oficial com a flexibilidade direta do Uazapi sem trocar de tela.",
          image: "/landing/cyber-multi-instance.webp",
          accent: "from-emerald-400 via-teal-300 to-cyan-400",
          bullets: [
            "Etiquetas visuais coloridas por número diretamente no Inbox",
            "Roteamento inteligente: responde sempre pela linha de origem",
            "Filtro instantâneo por canal e escolha de linha ao criar conversa",
          ],
        },
        {
          id: "ai-oracle",
          tag: "DIMENSÃO 02 • AUTONOMIA COGNITIVA",
          title: "Oráculo de IA & Fluxos Visuais",
          subtitle: "Agentes RAG, Flow Builder & Servidor MCP",
          description:
            "Treine agentes de IA com seus documentos, PDFs e catálogos. Desenhe árvores de decisão visuais e conecte agentes externos via Model Context Protocol.",
          image: "/landing/cyber-ai-oracle.webp",
          accent: "from-cyan-400 via-sky-300 to-purple-400",
          bullets: [
            "Respostas autônomas 24/7 com transbordo humano inteligente",
            "Flow Builder visual drag-and-drop com gatilhos, delays e condições",
            "Endpoint MCP nativo (/api/mcp) para Claude, Cursor e n8n",
          ],
        },
        {
          id: "revenue-alchemy",
          tag: "DIMENSÃO 03 • ALQUIMIA DE RECEITA",
          title: "Funis Quânticos & Broadcasts",
          subtitle: "Pipelines Kanban Multi-Moeda & Disparos em Massa",
          description:
            "Visualize cada oportunidade em quadros Kanban dinâmicos ligados ao chat. Dispare campanhas segmentadas por tags e empresas com telemetria completa.",
          image: "/landing/cyber-revenue-alchemy.webp",
          accent: "from-amber-300 via-emerald-400 to-cyan-400",
          bullets: [
            "Kanban com múltiplos funis, valores, probabilidades e tags",
            "Broadcast em massa com proteção de cadência e leitura em tempo real",
            "Sincronização automática de fotos de perfil e histórico unificado",
          ],
        },
      ],
    },
    simulator: {
      eyebrow: "SIMULADOR NEURAL INTERATIVO",
      heading: "Experimente o Cérebro do WCloudAPI Ao Vivo",
      subheading:
        "Alterne entre os cenários abaixo para observar como o roteamento multi-instância, o motor RAG de IA e as automações operam em milissegundos.",
      tabs: [
        {
          id: "routing",
          label: "01. Roteamento Multi-WhatsApp",
          instanceName: "Comercial SP • Uazapi",
          instanceColor: "#10b981",
          provider: "UAZAPI DIRECT",
          contactName: "Mariana Vasconcelos",
          contactRole: "Diretora de Operações • Vórtex Tech",
          messages: [
            {
              sender: "contact",
              text: "Olá! Precisamos conectar 4 números de WhatsApp da nossa equipe comercial no mesmo CRM. É possível?",
              meta: "Recebido via Linha Comercial SP (5511914909281) • 14:02:11",
            },
            {
              sender: "system",
              text: "⚡ Roteador Multi-Instância: Conversa vinculada automaticamente à linha [Comercial SP • #10B981]. Foto de perfil sincronizada.",
              meta: "Motor de Roteamento • Latência: 14ms",
            },
            {
              sender: "ai",
              text: "Perfeitamente, Mariana! No WCloudAPI você conecta quantas instâncias desejar (Meta Oficial ou Uazapi) no mesmo Workspace, com filtros por canal e etiquetas coloridas.",
              meta: "Respondido pela mesma linha [Comercial SP] • 14:02:13",
            },
          ],
          telemetry: [
            { label: "Instância Vinculada", value: "Comercial SP (#10B981)", status: "Ativo" },
            { label: "Provedor do Canal", value: "Uazapi High-Speed", status: "Conectado" },
            { label: "Foto do Contato", value: "Sincronizada via API", status: "OK" },
          ],
        },
        {
          id: "rag",
          label: "02. Oráculo IA + Memória RAG",
          instanceName: "WhatsApp Oficial • Meta",
          instanceColor: "#06b6d4",
          provider: "META CLOUD API",
          contactName: "Dr. Henrique Alencar",
          contactRole: "CEO • BioQuantum Labs",
          messages: [
            {
              sender: "contact",
              text: "Como funciona a integração via MCP para que nosso agente no Claude consulte os negócios do funil?",
              meta: "Recebido via Meta Cloud API Oficial • 14:05:40",
            },
            {
              sender: "system",
              text: "🧠 Busca Vetorial RAG: 3 fragmentos recuperados da documentação técnica (Score: 0.96). Gerando resposta contextual...",
              meta: "Oráculo RAG • 162ms",
            },
            {
              sender: "ai",
              text: "Basta apontar seu cliente MCP para https://wcloudapi.dev/api/mcp usando sua API Key Bearer. Seu agente terá acesso imediato às tools de contatos, conversas e funis!",
              meta: "Auto-Reply IA • Confiança: 98.4%",
            },
          ],
          telemetry: [
            { label: "Motor Cognitivo", value: "RAG + Embeddings", status: "98.4% Match" },
            { label: "Janela Meta 24h", value: "23h 59m restantes", status: "Aberta" },
            { label: "Transbordo Humano", value: "Monitorando intenção", status: "Standby" },
          ],
        },
        {
          id: "pipeline",
          label: "03. Funil Kanban & Webhook",
          instanceName: "Vendas Enterprise",
          instanceColor: "#a855f7",
          provider: "HYBRID ENGINE",
          contactName: "Lucas Mendonça",
          contactRole: "Head de Growth • Hyperion SA",
          messages: [
            {
              sender: "contact",
              text: "Proposta aprovada pela diretoria! Podemos fechar o plano anual Enterprise hoje.",
              meta: "Recebido via Vendas Enterprise • 14:09:02",
            },
            {
              sender: "system",
              text: "🚀 Automação Disparada: Card movido para [Fechado / Ganho • R$ 48.000]. Webhook HMAC-SHA256 'deal.won' entregue ao ERP.",
              meta: "Flow Engine • Execução #8841",
            },
            {
              sender: "ai",
              text: "Excelente notícia, Lucas! Seu ambiente Enterprise já foi provisionado e o contrato foi enviado. Bem-vindo a bordo!",
              meta: "Fluxo de Fechamento • 14:09:04",
            },
          ],
          telemetry: [
            { label: "Estágio do Funil", value: "Ganho • R$ 48.000", status: "Convertido" },
            { label: "Webhook Outbound", value: "HTTP 200 (Assinado)", status: "Entregue" },
            { label: "Tags Aplicadas", value: "VIP, Enterprise, Anual", status: "Sincronizado" },
          ],
        },
      ],
    },
    bento: {
      eyebrow: "ARSENAL TECNOLÓGICO COMPLETO",
      heading: "Tudo o que uma Operação de Alta Escala Exige",
      subheading:
        "Zero gambiarras. Uma arquitetura sólida construída sobre Next.js 16, Supabase Realtime, criptografia AES-256-GCM e padrões enterprise.",
      items: [
        {
          title: "Criptografia Militar de Credenciais",
          description:
            "Tokens da Meta e chaves Uazapi armazenados com criptografia autenticada AES-256-GCM e isolamento multi-tenant rigoroso (RLS).",
          badge: "SEGURANÇA ZERO-TRUST",
        },
        {
          title: "Servidor MCP (Model Context Protocol)",
          description:
            "Exponha ferramentas seguras via JSON-RPC 2.0 para que agentes como Claude Desktop, Cursor e n8n operem seu CRM autonomamente.",
          badge: "AI-NATIVE PROTOCOL",
        },
        {
          title: "Diagnóstico & Simulador de Webhook",
          description:
            "Valide a saúde da sua conta Meta, qualidade do número (GREEN/YELLOW), limites de tier e simule eventos de entrada sem gastar créditos.",
          badge: "TELEMETRIA AO VIVO",
        },
        {
          title: "Equipe Multi-Agente & Presença",
          description:
            "Convide operadores, atribua conversas, acompanhe quem está online em tempo real e registre notas internas por cliente.",
          badge: "COLABORAÇÃO REALTIME",
        },
        {
          title: "Construtor Visual de Fluxos (Flow Builder)",
          description:
            "Crie jornadas automatizadas com nós de mensagem, espera, condições lógicas, aplicação de tags e chamadas HTTP externas.",
          badge: "NO-CODE AUTOMATION",
        },
        {
          title: "Internacionalização Instantânea",
          description:
            "Interface totalmente adaptada para Português, Inglês e Espanhol com atualização imediata de toda a experiência UX/UI.",
          badge: "GLOBAL READY",
        },
      ],
    },
    ctaFooter: {
      badge: "PRONTO PARA A PRÓXIMA DIMENSÃO?",
      title: "Transforme seu WhatsApp em uma Máquina Cyber-Autônoma",
      subtitle:
        "Entre agora na sua estação de comando, conecte suas instâncias Uazapi ou Meta Cloud API e escale seu atendimento com inteligência artificial.",
      buttonPrimary: "Acessar Plataforma Agora",
      buttonSecondary: "Abrir Caixa de Entrada (Inbox)",
      copyright:
        "© 2026 WCloudAPI • Plataforma Avançada de CRM, Automação e IA para WhatsApp.",
    },
  },
  en: {
    nav: {
      surrealGallery: "Dimensions",
      architecture: "Architecture",
      liveSimulator: "Neural Simulator",
      mcpProtocol: "MCP Protocol",
      login: "Sign In",
      signup: "Get Started",
      dashboard: "Open Dashboard",
      inbox: "Go to Inbox",
    },
    hero: {
      badge: "CYBER-NEURAL WHATSAPP ARCHITECTURE • META CLOUD API + UAZAPI",
      titleLead: "The Surrealist",
      titleHighlight: "Hyper-Core of Conversion",
      titleTail: "& WhatsApp Automation.",
      subtitle:
        "Unify multiple WhatsApp lines (Official Meta & Uazapi), autonomous RAG AI agents, visual workflow builders, multi-currency Kanban pipelines, and a native MCP server inside one cybernetic command station.",
      ctaPrimary: "Launch Command Station",
      ctaSecondary: "Explore Neural Simulator",
      ctaAuthed: "Enter Command Station",
      hud1Title: "Multi-Instance Active",
      hud1Sub: "Meta API + Uazapi in parallel",
      hud2Title: "AI Oracle + RAG",
      hud2Sub: "180ms context-aware replies",
      hud3Title: "Native MCP Server",
      hud3Sub: "JSON-RPC 2.0 • Claude / Cursor / n8n",
    },
    metrics: [
      {
        value: "∞ Lines",
        label: "True Multi-Instance",
        detail: "Connect multiple Meta & Uazapi numbers in one workspace",
      },
      {
        value: "< 180ms",
        label: "Routing & Webhooks",
        detail: "Real-time sync powered by WebSockets & async queues",
      },
      {
        value: "RAG + MCP",
        label: "Cognitive Brain",
        detail: "Vector knowledge base & direct AI agent protocol integration",
      },
      {
        value: "100% API",
        label: "Open Ecosystem",
        detail: "REST API v1, HMAC-SHA256 signed webhooks & developer tools",
      },
    ],
    trilogy: {
      eyebrow: "HYPER-CONVERGENCE TRILOGY",
      heading: "Bleeding-Edge Engineering Meets Otherworldly Aesthetics",
      subheading:
        "Every WCloudAPI module is engineered to eliminate operational bottlenecks and transmute raw conversations into predictable revenue.",
      cards: [
        {
          id: "multi-instance",
          tag: "DIMENSION 01 • MULTI-LINE",
          title: "Multi-Instance Convergence",
          subtitle: "Multiple WhatsApp accounts in a single Workspace",
          description:
            "Operate sales, support, and executive lines simultaneously. Combine the official Meta Cloud API with high-speed Uazapi instances without switching screens.",
          image: "/landing/cyber-multi-instance.webp",
          accent: "from-emerald-400 via-teal-300 to-cyan-400",
          bullets: [
            "Color-coded visual badges per phone line inside the Inbox",
            "Smart sticky routing: replies always exit through the origin line",
            "Instant channel filtering and line selector for new conversations",
          ],
        },
        {
          id: "ai-oracle",
          tag: "DIMENSION 02 • COGNITIVE AUTONOMY",
          title: "AI Oracle & Visual Flows",
          subtitle: "RAG Agents, Flow Builder & Native MCP Server",
          description:
            "Train AI agents on your PDFs, docs, and catalogs. Build visual decision trees and connect external AI assistants via the Model Context Protocol.",
          image: "/landing/cyber-ai-oracle.webp",
          accent: "from-cyan-400 via-sky-300 to-purple-400",
          bullets: [
            "24/7 autonomous replies with seamless human agent handoff",
            "Drag-and-drop visual Flow Builder with triggers, delays & conditions",
            "Native MCP endpoint (/api/mcp) for Claude, Cursor & n8n",
          ],
        },
        {
          id: "revenue-alchemy",
          tag: "DIMENSION 03 • REVENUE ALCHEMY",
          title: "Quantum Funnels & Broadcasts",
          subtitle: "Multi-Currency Kanban Pipelines & Mass Campaigns",
          description:
            "Track every deal across dynamic Kanban boards linked directly to threads. Launch tag-segmented broadcasts with real-time delivery telemetry.",
          image: "/landing/cyber-revenue-alchemy.webp",
          accent: "from-amber-300 via-emerald-400 to-cyan-400",
          bullets: [
            "Multi-pipeline Kanban with deal values, probabilities & tags",
            "High-velocity broadcasts with cadence protection & read receipts",
            "Automatic WhatsApp profile picture sync & unified timeline",
          ],
        },
      ],
    },
    simulator: {
      eyebrow: "INTERACTIVE NEURAL SIMULATOR",
      heading: "Experience the WCloudAPI Brain Live",
      subheading:
        "Switch between scenarios below to watch how multi-instance routing, the RAG AI engine, and pipeline automations execute in milliseconds.",
      tabs: [
        {
          id: "routing",
          label: "01. Multi-WhatsApp Routing",
          instanceName: "Sales HQ • Uazapi",
          instanceColor: "#10b981",
          provider: "UAZAPI DIRECT",
          contactName: "Mariana Vasconcelos",
          contactRole: "VP of Operations • Vortex Tech",
          messages: [
            {
              sender: "contact",
              text: "Hi! We need to connect 4 WhatsApp numbers for our sales team into the same CRM workspace. Is that supported?",
              meta: "Received via Sales HQ Line (5511914909281) • 14:02:11",
            },
            {
              sender: "system",
              text: "⚡ Multi-Instance Router: Conversation bound to [Sales HQ • #10B981]. Contact avatar synced automatically.",
              meta: "Routing Engine • Latency: 14ms",
            },
            {
              sender: "ai",
              text: "Absolutely, Mariana! In WCloudAPI you can connect unlimited instances (Official Meta or Uazapi) in one workspace with channel filters and color badges.",
              meta: "Sent via origin line [Sales HQ] • 14:02:13",
            },
          ],
          telemetry: [
            { label: "Bound Instance", value: "Sales HQ (#10B981)", status: "Active" },
            { label: "Channel Provider", value: "Uazapi High-Speed", status: "Connected" },
            { label: "Contact Avatar", value: "Synced via API", status: "OK" },
          ],
        },
        {
          id: "rag",
          label: "02. AI Oracle + RAG Memory",
          instanceName: "Official WhatsApp • Meta",
          instanceColor: "#06b6d4",
          provider: "META CLOUD API",
          contactName: "Dr. Henrique Alencar",
          contactRole: "CEO • BioQuantum Labs",
          messages: [
            {
              sender: "contact",
              text: "How does the MCP integration work so our Claude agent can query live pipeline deals?",
              meta: "Received via Official Meta Cloud API • 14:05:40",
            },
            {
              sender: "system",
              text: "🧠 RAG Vector Search: 3 chunks retrieved from technical docs (Score: 0.96). Synthesizing grounded response...",
              meta: "RAG Oracle • 162ms",
            },
            {
              sender: "ai",
              text: "Simply point your MCP client to https://wcloudapi.dev/api/mcp with your Bearer API Key. Your agent gets instant access to contacts, threads, and deals!",
              meta: "AI Auto-Reply • Confidence: 98.4%",
            },
          ],
          telemetry: [
            { label: "Cognitive Engine", value: "RAG + Embeddings", status: "98.4% Match" },
            { label: "Meta 24h Window", value: "23h 59m remaining", status: "Open" },
            { label: "Human Handoff", value: "Monitoring intent", status: "Standby" },
          ],
        },
        {
          id: "pipeline",
          label: "03. Kanban Funnel & Webhook",
          instanceName: "Enterprise Sales",
          instanceColor: "#a855f7",
          provider: "HYBRID ENGINE",
          contactName: "Lucas Mendonça",
          contactRole: "Head of Growth • Hyperion Corp",
          messages: [
            {
              sender: "contact",
              text: "The board approved the proposal! We are ready to sign the annual Enterprise plan today.",
              meta: "Received via Enterprise Sales • 14:09:02",
            },
            {
              sender: "system",
              text: "🚀 Automation Triggered: Deal moved to [Closed Won • $48,000]. HMAC-SHA256 webhook 'deal.won' dispatched to ERP.",
              meta: "Flow Engine • Run #8841",
            },
            {
              sender: "ai",
              text: "Fantastic news, Lucas! Your Enterprise workspace is provisioned and the contract is on its way. Welcome aboard!",
              meta: "Closing Workflow • 14:09:04",
            },
          ],
          telemetry: [
            { label: "Pipeline Stage", value: "Won • $48,000", status: "Converted" },
            { label: "Outbound Webhook", value: "HTTP 200 (Signed)", status: "Delivered" },
            { label: "Applied Tags", value: "VIP, Enterprise, Annual", status: "Synced" },
          ],
        },
      ],
    },
    bento: {
      eyebrow: "FULL TECHNOLOGICAL ARSENAL",
      heading: "Everything High-Velocity Operations Demand",
      subheading:
        "Zero compromises. Built on Next.js 16, Supabase Realtime, AES-256-GCM encryption, and enterprise-grade multi-tenancy.",
      items: [
        {
          title: "Military-Grade Credential Encryption",
          description:
            "Meta tokens and Uazapi keys are encrypted at rest with AES-256-GCM and protected by strict Row-Level Security (RLS).",
          badge: "ZERO-TRUST SECURITY",
        },
        {
          title: "Native MCP Server (JSON-RPC 2.0)",
          description:
            "Expose secure tools so external AI agents like Claude Desktop, Cursor, and n8n can query and operate your CRM autonomously.",
          badge: "AI-NATIVE PROTOCOL",
        },
        {
          title: "Webhook Simulator & Health Probe",
          description:
            "Inspect Meta quality ratings (GREEN/YELLOW), messaging tiers, and simulate inbound webhook events without spending credits.",
          badge: "LIVE TELEMETRY",
        },
        {
          title: "Multi-Agent Team & Presence",
          description:
            "Invite teammates, assign conversations, see live online presence indicators, and collaborate with internal contact notes.",
          badge: "REALTIME COLLABORATION",
        },
        {
          title: "Visual Drag-and-Drop Flow Builder",
          description:
            "Design automated customer journeys with message nodes, smart delays, conditional branches, tag actions, and HTTP requests.",
          badge: "NO-CODE AUTOMATION",
        },
        {
          title: "Instant Full-UI Internationalization",
          description:
            "Seamlessly switch between Portuguese, English, and Spanish with instant full-application UX/UI updates.",
          badge: "GLOBAL READY",
        },
      ],
    },
    ctaFooter: {
      badge: "READY FOR THE NEXT DIMENSION?",
      title: "Turn Your WhatsApp Into an Autonomous Cyber-Machine",
      subtitle:
        "Enter your command station now, connect your Uazapi or Meta Cloud API instances, and scale customer operations with AI.",
      buttonPrimary: "Enter Platform Now",
      buttonSecondary: "Open Live Inbox",
      copyright:
        "© 2026 WCloudAPI • Next-Gen WhatsApp CRM, AI & Automation Platform.",
    },
  },
  es: {
    nav: {
      surrealGallery: "Dimensiones",
      architecture: "Arquitectura",
      liveSimulator: "Simulador Neural",
      mcpProtocol: "Protocolo MCP",
      login: "Iniciar Sesión",
      signup: "Crear Cuenta",
      dashboard: "Abrir Panel",
      inbox: "Ir al Inbox",
    },
    hero: {
      badge: "ARQUITECTURA CYBER-NEURAL PARA WHATSAPP • META CLOUD API + UAZAPI",
      titleLead: "El Hiper-Núcleo",
      titleHighlight: "Surrealista de Conversión",
      titleTail: "y Automatización en WhatsApp.",
      subtitle:
        "Unifica múltiples cuentas de WhatsApp (Meta Oficial y Uazapi), agentes autónomos de IA con memoria RAG, constructor visual de flujos, embudos Kanban multimoneda y servidor MCP nativo en una sola estación de comando.",
      ctaPrimary: "Iniciar Operación Ahora",
      ctaSecondary: "Explorar Simulador Neural",
      ctaAuthed: "Entrar a la Estación",
      hud1Title: "Multi-Instancia Activa",
      hud1Sub: "Meta API + Uazapi en paralelo",
      hud2Title: "Oráculo IA + RAG",
      hud2Sub: "Respuestas en 180ms con contexto",
      hud3Title: "Servidor MCP Nativo",
      hud3Sub: "JSON-RPC 2.0 • Claude / Cursor / n8n",
    },
    metrics: [
      {
        value: "∞ Líneas",
        label: "Multi-Instancia Real",
        detail: "Conecta múltiples números Meta y Uazapi en el mismo negocio",
      },
      {
        value: "< 180ms",
        label: "Enrutamiento & Webhook",
        detail: "Sincronización en tiempo real vía WebSockets y colas asíncronas",
      },
      {
        value: "RAG + MCP",
        label: "Cerebro Cognitivo",
        detail: "Base de conocimiento vectorial e integración directa con agentes IA",
      },
      {
        value: "100% API",
        label: "Ecosistema Abierto",
        detail: "REST API v1, Webhooks firmados vía HMAC-SHA256 y SDKs",
      },
    ],
    trilogy: {
      eyebrow: "TRILOGÍA DE LA HIPER-CONVERGENCIA",
      heading: "Ingeniería de Vanguardia con Estética de Otra Dimensión",
      subheading:
        "Cada módulo de WCloudAPI fue diseñado para eliminar cuellos de botella y transformar conversaciones en ingresos predecibles.",
      cards: [
        {
          id: "multi-instance",
          tag: "DIMENSIÓN 01 • MULTI-LÍNEA",
          title: "Convergencia Multi-Instancia",
          subtitle: "Varias cuentas de WhatsApp en el mismo Workspace",
          description:
            "Opera líneas de ventas, soporte y dirección simultáneamente. Combina la estabilidad de Meta Cloud API Oficial con la velocidad de Uazapi sin cambiar de pantalla.",
          image: "/landing/cyber-multi-instance.webp",
          accent: "from-emerald-400 via-teal-300 to-cyan-400",
          bullets: [
            "Etiquetas visuales con colores por número directamente en el Inbox",
            "Enrutamiento inteligente: responde siempre por la línea de origen",
            "Filtro instantáneo por canal y selector de línea al crear conversación",
          ],
        },
        {
          id: "ai-oracle",
          tag: "DIMENSIÓN 02 • AUTONOMÍA COGNITIVA",
          title: "Oráculo de IA & Flujos Visuales",
          subtitle: "Agentes RAG, Flow Builder & Servidor MCP",
          description:
            "Entrena agentes de IA con tus documentos y catálogos. Diseña árboles de decisión visuales y conecta agentes externos vía Model Context Protocol.",
          image: "/landing/cyber-ai-oracle.webp",
          accent: "from-cyan-400 via-sky-300 to-purple-400",
          bullets: [
            "Respuestas autónomas 24/7 con transferencia humana inteligente",
            "Flow Builder visual drag-and-drop con disparadores y condiciones",
            "Endpoint MCP nativo (/api/mcp) para Claude, Cursor y n8n",
          ],
        },
        {
          id: "revenue-alchemy",
          tag: "DIMENSIÓN 03 • ALQUIMIA DE INGRESOS",
          title: "Embudos Cuánticos & Broadcasts",
          subtitle: "Pipelines Kanban Multimoneda & Envíos Masivos",
          description:
            "Visualiza cada oportunidad en tableros Kanban dinámicos vinculados al chat. Lanza campañas segmentadas por etiquetas con telemetría en vivo.",
          image: "/landing/cyber-revenue-alchemy.webp",
          accent: "from-amber-300 via-emerald-400 to-cyan-400",
          bullets: [
            "Kanban con múltiples embudos, valores, probabilidades y etiquetas",
            "Broadcast masivo con protección de cadencia y lectura en tiempo real",
            "Sincronización automática de fotos de perfil e historial unificado",
          ],
        },
      ],
    },
    simulator: {
      eyebrow: "SIMULADOR NEURAL INTERACTIVO",
      heading: "Experimenta el Cerebro de WCloudAPI en Vivo",
      subheading:
        "Alterna entre los escenarios para observar cómo el enrutamiento multi-instancia, el motor RAG de IA y las automatizaciones operan en milisegundos.",
      tabs: [
        {
          id: "routing",
          label: "01. Enrutamiento Multi-WhatsApp",
          instanceName: "Ventas Central • Uazapi",
          instanceColor: "#10b981",
          provider: "UAZAPI DIRECT",
          contactName: "Mariana Vasconcelos",
          contactRole: "Directora de Operaciones • Vórtex Tech",
          messages: [
            {
              sender: "contact",
              text: "¡Hola! Necesitamos conectar 4 números de WhatsApp de nuestro equipo comercial en el mismo CRM. ¿Es posible?",
              meta: "Recibido vía Ventas Central (5511914909281) • 14:02:11",
            },
            {
              sender: "system",
              text: "⚡ Enrutador Multi-Instancia: Conversación vinculada a [Ventas Central • #10B981]. Foto de perfil sincronizada.",
              meta: "Motor de Enrutamiento • Latencia: 14ms",
            },
            {
              sender: "ai",
              text: "¡Por supuesto, Mariana! En WCloudAPI conectas múltiples instancias (Meta Oficial o Uazapi) en el mismo Workspace con filtros y etiquetas de color.",
              meta: "Respondido por la misma línea [Ventas Central] • 14:02:13",
            },
          ],
          telemetry: [
            { label: "Instancia Vinculada", value: "Ventas Central (#10B981)", status: "Activo" },
            { label: "Proveedor del Canal", value: "Uazapi High-Speed", status: "Conectado" },
            { label: "Foto del Contacto", value: "Sincronizada vía API", status: "OK" },
          ],
        },
        {
          id: "rag",
          label: "02. Oráculo IA + Memoria RAG",
          instanceName: "WhatsApp Oficial • Meta",
          instanceColor: "#06b6d4",
          provider: "META CLOUD API",
          contactName: "Dr. Henrique Alencar",
          contactRole: "CEO • BioQuantum Labs",
          messages: [
            {
              sender: "contact",
              text: "¿Cómo funciona la integración MCP para que nuestro agente en Claude consulte oportunidades del embudo?",
              meta: "Recibido vía Meta Cloud API Oficial • 14:05:40",
            },
            {
              sender: "system",
              text: "🧠 Búsqueda Vectorial RAG: 3 fragmentos recuperados de la documentación (Score: 0.96). Generando respuesta...",
              meta: "Oráculo RAG • 162ms",
            },
            {
              sender: "ai",
              text: "Solo apunta tu cliente MCP a https://wcloudapi.dev/api/mcp con tu API Key Bearer. ¡Tu agente tendrá acceso inmediato a contactos, chats y negocios!",
              meta: "Auto-Reply IA • Confianza: 98.4%",
            },
          ],
          telemetry: [
            { label: "Motor Cognitivo", value: "RAG + Embeddings", status: "98.4% Match" },
            { label: "Ventana Meta 24h", value: "23h 59m restantes", status: "Abierta" },
            { label: "Transferencia Humana", value: "Monitoreando intención", status: "Standby" },
          ],
        },
        {
          id: "pipeline",
          label: "03. Embudo Kanban & Webhook",
          instanceName: "Ventas Enterprise",
          instanceColor: "#a855f7",
          provider: "HYBRID ENGINE",
          contactName: "Lucas Mendonça",
          contactRole: "Head de Growth • Hyperion SA",
          messages: [
            {
              sender: "contact",
              text: "¡Propuesta aprobada por el directorio! Podemos cerrar el plan anual Enterprise hoy mismo.",
              meta: "Recibido vía Ventas Enterprise • 14:09:02",
            },
            {
              sender: "system",
              text: "🚀 Automatización Ejecutada: Negocio movido a [Ganado • $48,000]. Webhook HMAC-SHA256 'deal.won' entregado al ERP.",
              meta: "Flow Engine • Ejecución #8841",
            },
            {
              sender: "ai",
              text: "¡Excelente noticia, Lucas! Tu entorno Enterprise ya fue aprovisionado y el contrato fue enviado. ¡Bienvenido a bordo!",
              meta: "Flujo de Cierre • 14:09:04",
            },
          ],
          telemetry: [
            { label: "Etapa del Embudo", value: "Ganado • $48,000", status: "Convertido" },
            { label: "Webhook Outbound", value: "HTTP 200 (Firmado)", status: "Entregado" },
            { label: "Etiquetas Aplicadas", value: "VIP, Enterprise, Anual", status: "Sincronizado" },
          ],
        },
      ],
    },
    bento: {
      eyebrow: "ARSENAL TECNOLÓGICO COMPLETO",
      heading: "Todo lo que una Operación de Alta Escala Exige",
      subheading:
        "Cero improvisaciones. Una arquitectura sólida construida sobre Next.js 16, Supabase Realtime, cifrado AES-256-GCM y estándares enterprise.",
      items: [
        {
          title: "Cifrado Militar de Credenciales",
          description:
            "Tokens de Meta y claves Uazapi almacenados con cifrado autenticado AES-256-GCM y aislamiento multi-tenant riguroso (RLS).",
          badge: "SEGURIDAD ZERO-TRUST",
        },
        {
          title: "Servidor MCP (Model Context Protocol)",
          description:
            "Expón herramientas seguras vía JSON-RPC 2.0 para que agentes como Claude Desktop, Cursor y n8n operen tu CRM autónomamente.",
          badge: "AI-NATIVE PROTOCOL",
        },
        {
          title: "Diagnóstico & Simulador de Webhook",
          description:
            "Valida la salud de tu cuenta Meta, calidad del número (GREEN/YELLOW), límites de tier y simula eventos sin gastar créditos.",
          badge: "TELEMETRÍA EN VIVO",
        },
        {
          title: "Equipo Multi-Agente & Presencia",
          description:
            "Invita operadores, asigna conversaciones, visualiza quién está en línea en tiempo real y registra notas internas por cliente.",
          badge: "COLABORACIÓN REALTIME",
        },
        {
          title: "Constructor Visual de Flujos (Flow Builder)",
          description:
            "Crea recorridos automatizados con nodos de mensaje, esperas, condiciones lógicas, etiquetas y llamadas HTTP externas.",
          badge: "NO-CODE AUTOMATION",
        },
        {
          title: "Internacionalización Instantánea",
          description:
            "Interfaz totalmente adaptada para Portugués, Inglés y Español con actualización inmediata de toda la experiencia UX/UI.",
          badge: "GLOBAL READY",
        },
      ],
    },
    ctaFooter: {
      badge: "¿LISTO PARA LA PRÓXIMA DIMENSIÓN?",
      title: "Transforma tu WhatsApp en una Máquina Cyber-Autónoma",
      subtitle:
        "Entra ahora a tu estación de comando, conecta tus instancias Uazapi o Meta Cloud API y escala tu operación con inteligencia artificial.",
      buttonPrimary: "Acceder a la Plataforma",
      buttonSecondary: "Abrir Bandeja de Entrada (Inbox)",
      copyright:
        "© 2026 WCloudAPI • Plataforma Avanzada de CRM, Automatización e IA para WhatsApp.",
    },
  },
};

function normalizeLocale(raw?: string): SupportedLocale {
  if (!raw) return "pt-BR";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("es")) return "es";
  return "pt-BR";
}

export function CyberLanding({
  initialLocale = "pt-BR",
  isAuthenticated = false,
}: CyberLandingProps) {
  const router = useRouter();
  const [locale, setLocale] = useState<SupportedLocale>(() =>
    normalizeLocale(initialLocale)
  );
  const [activeSimTab, setActiveSimTab] = useState<number>(0);
  const [activeCardId, setActiveCardId] = useState<string>("multi-instance");
  const [pointer, setPointer] = useState<{ x: number; y: number }>({
    x: 50,
    y: 25,
  });
  const [simStep, setSimStep] = useState<number>(3);

  const t = COPY[locale];
  const currentSim = t.simulator.tabs[activeSimTab] ?? t.simulator.tabs[0];

  const handleLocaleChange = useCallback(
    async (next: SupportedLocale) => {
      setLocale(next);
      try {
        await fetch("/api/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        });
        router.refresh();
      } catch {
        // Ignore network error; client state already updated
      }
    },
    [router]
  );

  // Replay animation when switching simulator tab
  const handleSelectSimTab = (idx: number) => {
    setActiveSimTab(idx);
    setSimStep(1);
  };

  useEffect(() => {
    if (simStep < 3) {
      const timer = setTimeout(() => setSimStep((s) => s + 1), 420);
      return () => clearTimeout(timer);
    }
  }, [simStep]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPointer({ x, y });
  }, []);

  const bentoIcons = [
    <Lock key="lock" className="h-5 w-5 text-emerald-400" />,
    <Cpu key="cpu" className="h-5 w-5 text-cyan-400" />,
    <Activity key="act" className="h-5 w-5 text-purple-400" />,
    <MessageSquare key="msg" className="h-5 w-5 text-emerald-400" />,
    <Workflow key="wf" className="h-5 w-5 text-amber-400" />,
    <Globe key="glb" className="h-5 w-5 text-cyan-400" />,
  ];

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative min-h-screen w-full overflow-x-hidden bg-[#02050e] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200"
    >
      {/* Dynamic Cyber-Surrealist Ambient Spotlight & Perspective Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
        style={{
          background: `
            radial-gradient(850px circle at ${pointer.x}% ${pointer.y}%, rgba(16, 185, 129, 0.11), rgba(6, 182, 212, 0.06) 40%, transparent 75%),
            radial-gradient(650px circle at 85% 15%, rgba(139, 92, 246, 0.12), transparent 65%),
            radial-gradient(700px circle at 15% 80%, rgba(6, 182, 212, 0.10), transparent 65%)
          `,
        }}
      />

      {/* Subtle Cyber Matrix Grid Overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.14]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(52, 211, 153, 0.16) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.16) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, #000 35%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, #000 35%, transparent 100%)",
        }}
      />

      {/* ======================== TOP CYBER NAVBAR ======================== */}
      <header className="sticky top-0 z-50 border-b border-emerald-500/15 bg-[#02050e]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/25 via-cyan-500/15 to-purple-600/25 shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-transform duration-300 group-hover:scale-105">
              <Zap className="h-5 w-5 text-emerald-300" />
              <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-white via-emerald-200 to-cyan-300 bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
                  WCloudAPI
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                  CYBER OS
                </span>
              </div>
              <p className="hidden text-[11px] text-slate-400 sm:block">
                Omnichannel Neural WhatsApp Platform
              </p>
            </div>
          </Link>

          {/* Center Nav Links */}
          <nav className="hidden items-center gap-7 text-xs font-medium text-slate-300 md:flex">
            <a
              href="#trilogy"
              className="transition-colors hover:text-emerald-300"
            >
              {t.nav.surrealGallery}
            </a>
            <a
              href="#simulator"
              className="transition-colors hover:text-cyan-300"
            >
              {t.nav.liveSimulator}
            </a>
            <a
              href="#arsenal"
              className="transition-colors hover:text-purple-300"
            >
              {t.nav.architecture}
            </a>
          </nav>

          {/* Right Controls: Language Switcher + Auth CTAs */}
          <div className="flex items-center gap-2.5">
            {/* Instant Language Switcher */}
            <div
              role="group"
              aria-label="Idioma / Language"
              className="flex items-center rounded-lg border border-slate-800 bg-slate-950/90 p-0.5 text-[11px]"
            >
              {(
                [
                  { code: "pt-BR", label: "PT" },
                  { code: "en", label: "EN" },
                  { code: "es", label: "ES" },
                ] as const
              ).map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLocaleChange(lang.code)}
                  className={`rounded-md px-2 py-1 font-mono font-semibold transition-all ${
                    locale === lang.code
                      ? "bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/inbox"
                  className="hidden items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-200 transition-all hover:border-cyan-400/60 hover:bg-cyan-500/20 sm:inline-flex"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {t.nav.inbox}
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_0_24px_rgba(16,185,129,0.45)] transition-all hover:brightness-110"
                >
                  <span>{t.nav.dashboard}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-lg border border-slate-800 bg-slate-900/70 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-500/40 hover:text-white"
                >
                  {t.nav.login}
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_0_24px_rgba(16,185,129,0.45)] transition-all hover:brightness-110"
                >
                  <span>{t.nav.signup}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ======================== HERO SECTION ======================== */}
      <main className="relative z-10">
        <section className="relative mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pt-16">
          {/* Top Eyebrow Badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-950/40 px-4 py-1.5 text-xs font-medium text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.2)] backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono tracking-wider">{t.hero.badge}</span>
            </div>
          </div>

          {/* Main Surrealist Cyber Headline */}
          <div className="mx-auto mt-6 max-w-4xl text-center">
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl lg:leading-[1.06]">
              {t.hero.titleLead}{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(16,185,129,0.35)]">
                {t.hero.titleHighlight}
              </span>{" "}
              {t.hero.titleTail}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              {t.hero.subtitle}
            </p>

            {/* Hero CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={isAuthenticated ? "/dashboard" : "/signup"}
                className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 px-7 py-4 text-sm font-extrabold text-slate-950 shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_55px_rgba(6,182,212,0.7)]"
              >
                <Zap className="h-4 w-4 fill-slate-950" />
                <span>
                  {isAuthenticated ? t.hero.ctaAuthed : t.hero.ctaPrimary}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <a
                href="#simulator"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-6 py-4 text-sm font-semibold text-slate-200 backdrop-blur-md transition-all hover:border-cyan-400/50 hover:bg-slate-900 hover:text-cyan-200"
              >
                <Play className="h-4 w-4 text-cyan-400" />
                <span>{t.hero.ctaSecondary}</span>
              </a>

              <Link
                href="/inbox"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/25 px-5 py-4 text-sm font-semibold text-emerald-300 backdrop-blur-md transition-all hover:border-emerald-400/60 hover:bg-emerald-950/50"
              >
                <MessageSquare className="h-4 w-4" />
                <span>{t.nav.inbox}</span>
              </Link>
            </div>
          </div>

          {/* SURREALIST HERO MASTERPIECE SHOWCASE WITH FLOATING TELEMETRY CARDS */}
          <div className="relative mx-auto mt-12 max-w-6xl">
            {/* Outer Neon Halo */}
            <div
              aria-hidden="true"
              className=" -inset-1 absolute rounded-3xl bg-gradient-to-r from-emerald-500/40 via-cyan-500/40 to-purple-600/40 opacity-75 blur-2xl"
            />

            <div className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-slate-950/90 shadow-[0_25px_90px_rgba(0,0,0,0.85)]">
              {/* Top Cyber Window Bar */}
              <div className="flex items-center justify-between border-b border-slate-800/90 bg-slate-950/95 px-4 py-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                  <span className="ml-2 font-mono text-[11px] text-slate-400">
                    wcloudapi://neural-nexus/quantum-core.v4
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-emerald-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    ONLINE • 99.98%
                  </span>
                  <span className="hidden rounded bg-slate-900 px-2 py-0.5 text-cyan-300 sm:inline">
                    AES-256-GCM
                  </span>
                </div>
              </div>

              {/* Hero Surrealist Cyber Artwork */}
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <Image
                  src="/landing/cyber-hero-nexus.webp"
                  alt="WCloudAPI Surrealist Cyber Neural Nexus"
                  fill
                  priority
                  sizes="(max-width: 1280px) 100vw, 1200px"
                  className="object-cover object-center transition-transform duration-1000 hover:scale-105"
                />

                {/* Bottom Gradient Vignette for HUD Readability */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#02050e] via-transparent to-[#02050e]/30" />

                {/* Levitating HUD Card 1 — Left */}
                <div className="absolute left-4 top-4 hidden max-w-xs rounded-2xl border border-emerald-400/35 bg-slate-950/80 p-3.5 backdrop-blur-xl sm:block lg:left-7 lg:top-7">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-white">
                          {t.hero.hud1Title}
                        </p>
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                          LIVE
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {t.hero.hud1Sub}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Levitating HUD Card 2 — Right */}
                <div className="absolute right-4 top-4 hidden max-w-xs rounded-2xl border border-cyan-400/35 bg-slate-950/80 p-3.5 backdrop-blur-xl sm:block lg:right-7 lg:top-7">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {t.hero.hud2Title}
                      </p>
                      <p className="text-[11px] text-slate-300">
                        {t.hero.hud2Sub}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Levitating HUD Card 3 — Bottom Center Bar */}
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-400/30 bg-slate-950/85 px-4 py-3 backdrop-blur-xl lg:bottom-6 lg:left-7 lg:right-7">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                      <Terminal className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {t.hero.hud3Title}
                      </p>
                      <p className="text-[11px] text-slate-300">
                        {t.hero.hud3Sub}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      WhatsApp Principal • Uazapi
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-300">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      Comercial SP • Meta API
                    </span>
                    <span className="hidden items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-300 md:inline-flex">
                      <span className="h-2 w-2 rounded-full bg-purple-400" />
                      Suporte VIP • Híbrido
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Key Cyber Metrics Bar */}
          <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.metrics.map((m, idx) => (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/60 p-5 backdrop-blur-lg transition-all duration-300 hover:border-emerald-400/40 hover:bg-slate-900/70"
              >
                <div className="font-mono text-2xl font-black tracking-tight text-emerald-300 sm:text-3xl">
                  {m.value}
                </div>
                <div className="mt-1 text-sm font-bold text-white">
                  {m.label}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {m.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ======================== SURREALIST TRILOGY GALLERY ======================== */}
        <section
          id="trilogy"
          className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
              {t.trilogy.eyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">
              {t.trilogy.heading}
            </h2>
            <p className="mt-4 text-base text-slate-300">
              {t.trilogy.subheading}
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {t.trilogy.cards.map((card) => {
              const isSelected = activeCardId === card.id;
              return (
                <article
                  key={card.id}
                  onMouseEnter={() => setActiveCardId(card.id)}
                  className={`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-500 ${
                    isSelected
                      ? "border-emerald-400/60 bg-slate-900/85 shadow-[0_0_50px_rgba(16,185,129,0.2)]"
                      : "border-slate-800/80 bg-slate-950/75 hover:border-cyan-500/40"
                  }`}
                >
                  {/* Surrealist Artwork Header */}
                  <div className="relative aspect-[3/2] w-full overflow-hidden bg-slate-950">
                    <Image
                      src={card.image}
                      alt={card.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 400px"
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-slate-950/80 px-3 py-1 font-mono text-[10px] font-bold tracking-wider text-emerald-300 backdrop-blur-md">
                      {card.tag}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <h3
                        className={`bg-gradient-to-r ${card.accent} bg-clip-text text-2xl font-extrabold text-transparent`}
                      >
                        {card.title}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-slate-300">
                        {card.subtitle}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-slate-300">
                        {card.description}
                      </p>

                      <ul className="mt-5 space-y-2.5 border-t border-slate-800/80 pt-4">
                        {card.bullets.map((b, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2.5 text-xs text-slate-200"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 pt-2">
                      <Link
                        href={isAuthenticated ? "/settings" : "/signup"}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 transition-colors group-hover:text-cyan-300"
                      >
                        <span>Explorar dimensão</span>
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ======================== INTERACTIVE NEURAL SIMULATOR ======================== */}
        <section
          id="simulator"
          className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-400">
              {t.simulator.eyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">
              {t.simulator.heading}
            </h2>
            <p className="mt-4 text-base text-slate-300">
              {t.simulator.subheading}
            </p>
          </div>

          {/* Scenario Selector Tabs */}
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {t.simulator.tabs.map((tab, idx) => {
              const active = idx === activeSimTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectSimTab(idx)}
                  className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
                    active
                      ? "border-emerald-400 bg-emerald-500/15 text-white shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tab.instanceColor }}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Cockpit Console */}
          <div className="mt-8 grid grid-cols-1 gap-6 rounded-3xl border border-emerald-500/30 bg-slate-950/90 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.75)] backdrop-blur-xl lg:grid-cols-[1fr_340px] lg:p-8">
            {/* Simulated Thread Window */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#050b18] p-4 sm:p-6">
              {/* Thread Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-sm font-black text-slate-950">
                    {currentSim.contactName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        {currentSim.contactName}
                      </h3>
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: currentSim.instanceColor }}
                        />
                        {currentSim.instanceName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {currentSim.contactRole}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-300">
                    {currentSim.provider}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSimStep(1)}
                    title="Replay Simulation"
                    className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="my-6 space-y-4">
                {currentSim.messages.slice(0, simStep).map((m, i) => {
                  if (m.sender === "contact") {
                    return (
                      <div
                        key={i}
                        className="max-w-xl rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900/90 p-4"
                      >
                        <p className="text-sm text-slate-100">{m.text}</p>
                        <p className="mt-1.5 font-mono text-[10px] text-slate-400">
                          {m.meta}
                        </p>
                      </div>
                    );
                  }
                  if (m.sender === "system") {
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-3 font-mono text-xs text-cyan-200"
                      >
                        <p>{m.text}</p>
                        <p className="mt-1 text-[10px] text-cyan-400/80">
                          {m.meta}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="ml-auto max-w-xl rounded-2xl rounded-tr-sm border border-emerald-500/40 bg-emerald-950/40 p-4 text-right"
                    >
                      <p className="text-sm text-emerald-50">{m.text}</p>
                      <p className="mt-1.5 font-mono text-[10px] text-emerald-300/80">
                        {m.meta}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Simulated Composer Bar */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-xs text-slate-400">
                <span>
                  Respondendo automaticamente via{" "}
                  <strong className="text-slate-200">
                    {currentSim.instanceName}
                  </strong>
                  ...
                </span>
                <Link
                  href="/inbox"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-500/30"
                >
                  <Send className="h-3 w-3" />
                  <span>Abrir Inbox Real</span>
                </Link>
              </div>
            </div>

            {/* Right Telemetry Panel */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                    TELEMETRIA NEURAL
                  </span>
                  <Radio className="h-4 w-4 animate-pulse text-emerald-400" />
                </div>

                <div className="mt-4 space-y-3">
                  {currentSim.telemetry.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-3.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{item.label}</span>
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs font-bold text-white">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-purple-500/30 bg-purple-950/25 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-200">
                  <Kanban className="h-4 w-4 text-purple-400" />
                  <span>Pronto para operar ao vivo?</span>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  Conecte suas instâncias em Configurações e acompanhe tudo em
                  tempo real.
                </p>
                <Link
                  href="/settings"
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-500/25 px-3 py-2 text-xs font-bold text-purple-200 transition-colors hover:bg-purple-500/40"
                >
                  <span>Configurar Instâncias</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ======================== BENTO TECHNOLOGICAL ARSENAL ======================== */}
        <section
          id="arsenal"
          className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-purple-400">
              {t.bento.eyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">
              {t.bento.heading}
            </h2>
            <p className="mt-4 text-base text-slate-300">
              {t.bento.subheading}
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {t.bento.items.map((item, idx) => (
              <div
                key={idx}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-slate-950/75 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/45 hover:bg-slate-900/80"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
                      {bentoIcons[idx % bentoIcons.length]}
                    </div>
                    <span className="rounded-full border border-slate-800 bg-slate-900/90 px-2.5 py-1 font-mono text-[10px] font-semibold text-slate-300">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white group-hover:text-emerald-300">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ======================== FINAL CYBER PORTAL CTA ======================== */}
        <section className="relative mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-emerald-950/60 via-slate-950 to-purple-950/60 p-8 text-center shadow-[0_0_70px_rgba(16,185,129,0.2)] sm:p-14">
            <div className="mx-auto max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1 font-mono text-xs font-bold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t.ctaFooter.badge}
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
                {t.ctaFooter.title}
              </h2>
              <p className="mt-4 text-base text-slate-300">
                {t.ctaFooter.subtitle}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href={isAuthenticated ? "/dashboard" : "/login"}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 px-7 py-4 text-sm font-extrabold text-slate-950 shadow-[0_0_35px_rgba(16,185,129,0.45)] transition-all hover:brightness-110"
                >
                  <span>{t.ctaFooter.buttonPrimary}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/inbox"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-4 text-sm font-bold text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-200"
                >
                  <MessageSquare className="h-4 w-4 text-cyan-400" />
                  <span>{t.ctaFooter.buttonSecondary}</span>
                </Link>
              </div>
            </div>
          </div>

          <footer className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800/80 pt-8 text-xs text-slate-400 sm:flex-row">
            <p>{t.ctaFooter.copyright}</p>
            <div className="flex items-center gap-5">
              <Link href="/dashboard" className="hover:text-emerald-300">
                Dashboard
              </Link>
              <Link href="/inbox" className="hover:text-emerald-300">
                Inbox
              </Link>
              <Link href="/pipelines" className="hover:text-emerald-300">
                Pipelines
              </Link>
              <Link href="/flows" className="hover:text-emerald-300">
                Flows
              </Link>
              <Link href="/settings" className="hover:text-emerald-300">
                Settings
              </Link>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
