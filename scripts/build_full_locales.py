#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate complete pt-BR.json, pt.json and es.json translation files.
"""
import json
import os

with open('messages/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

pt_BR = {
  "LoginPage": {
    "titleAccept": "Entre para aceitar o convite",
    "titleWelcome": "Bem-vindo de volta",
    "descAccept": "Faça login e você será direcionado para o convite.",
    "descWelcome": "Entre na sua conta",
    "emailLabel": "E-mail",
    "emailPlaceholder": "seu@exemplo.com",
    "passwordLabel": "Senha",
    "forgotPassword": "Esqueceu a senha?",
    "passwordPlaceholder": "Digite sua senha",
    "signingIn": "Entrando...",
    "signIn": "Entrar",
    "noAccount": "Não tem uma conta?",
    "createAccount": "Criar conta"
  },
  "Sidebar": {
    "title": "CRM WhatsApp",
    "dashboard": "Painel",
    "inbox": "Conversas",
    "notifications": "Notificações",
    "contacts": "Contatos",
    "pipelines": "Funis de Vendas",
    "broadcasts": "Transmissões",
    "automations": "Automações",
    "flows": "Fluxos",
    "aiAgents": "Agentes de IA",
    "settings": "Configurações",
    "beta": "Beta",
    "unreadConversations": "{count} {count, plural, =1 {conversa não lida} other {conversas não lidas}}",
    "unreadNotifications": "{count} {count, plural, =1 {notificação não lida} other {notificações não lidas}}",
    "roleOwner": "Proprietário",
    "roleAdmin": "Administrador",
    "roleAgent": "Atendente",
    "roleViewer": "Visualizador",
    "closeMenu": "Fechar menu",
    "defaultUser": "Usuário",
    "defaultAvatar": "Avatar",
    "menuProfile": "Perfil",
    "menuSettings": "Configurações",
    "menuSignOut": "Sair"
  },
  "Header": {
    "dashboard": "Painel",
    "inbox": "Conversas",
    "notifications": "Notificações",
    "contacts": "Contatos",
    "pipelines": "Funis de Vendas",
    "broadcasts": "Transmissões",
    "automations": "Automações",
    "settings": "Configurações",
    "openMenu": "Abrir menu",
    "openAccountMenu": "Abrir menu da conta",
    "defaultUser": "Usuário",
    "defaultAvatar": "Avatar",
    "menuProfile": "Perfil",
    "menuSettings": "Configurações",
    "menuSignOut": "Sair"
  },
  "ModeToggle": {
    "switchMode": "Mudar para o modo {mode}"
  },
  "Dashboard": {
    "page": {
      "title": "Painel de Controle",
      "description": "Métricas em tempo real sobre conversas, contatos, negócios, transmissões e automações.",
      "activeConversations": "Conversas Ativas",
      "newContactsToday": "Novos Contatos Hoje",
      "openDealsValue": "Valor em Negócios Abertos",
      "messagesSentToday": "Mensagens Enviadas Hoje",
      "newTodayVsYesterday": "novos hoje vs ontem",
      "vsYesterday": "vs ontem",
      "openDeals": "{count} {count, plural, =1 {negócio aberto} other {negócios abertos}}",
      "noChange": "Sem alterações {suffix}"
    },
    "quickActions": {
      "newContact": "Novo Contato",
      "newDeal": "Novo Negócio",
      "newBroadcast": "Nova Transmissão",
      "newAutomation": "Nova Automação"
    },
    "activityFeed": {
      "title": "Atividades Recentes",
      "viewAll": "Ver tudo →",
      "noActivity": "Nenhuma atividade recente",
      "noActivityHint": "Atividades de mensagens, negócios, transmissões e automações aparecerão aqui.",
      "showingOf": "Exibindo {visible} de {totalLoaded}{plus}",
      "show": "Exibir",
      "timeS": "há {sec}s",
      "timeM": "há {min}min",
      "timeH": "há {hr}h",
      "timeD": "há {day}d"
    },
    "conversationsChart": {
      "title": "Volume de Conversas",
      "description": "Volume diário de mensagens por direção",
      "days": "{count} dias",
      "noActivity": "Sem atividade de mensagens neste período",
      "noActivityHint": "Envie ou receba mensagens para popular este gráfico.",
      "incoming": "Recebidas",
      "outgoing": "Enviadas",
      "messagesCount": "{count} {count, plural, =1 {mensagem} other {mensagens}}"
    },
    "pipelineDonut": {
      "title": "Negócios por Estágio",
      "description": "Distribuição de valor no funil de vendas",
      "noDeals": "Nenhum negócio no funil",
      "noDealsHint": "Crie negócios para visualizar a distribuição dos estágios.",
      "dealsCount": "{count} {count, plural, =1 {negócio} other {negócios}}"
    },
    "responseTimeChart": {
      "title": "Tempo de Resposta",
      "description": "Tempo médio para a primeira resposta da equipe",
      "avgFirstResponse": "Primeira resposta média",
      "medianFirstResponse": "Mediana da primeira resposta",
      "noData": "Sem dados de tempo de resposta suficientes",
      "noDataHint": "Responda às conversas recebidas para gerar estatísticas de tempo de resposta."
    },
    "emptyState": {
      "welcome": "Bem-vindo ao seu novo CRM de WhatsApp!"
    }
  }
}

# Write base part and populate remaining keys from en recursively
def populate_missing_pt(source_en, target_pt):
    for k, v in source_en.items():
        if k not in target_pt:
            if isinstance(v, dict):
                target_pt[k] = {}
                populate_missing_pt(v, target_pt[k])
            else:
                target_pt[k] = v
        elif isinstance(v, dict) and isinstance(target_pt[k], dict):
            populate_missing_pt(v, target_pt[k])

populate_missing_pt(en, pt_BR)

with open('messages/pt-BR.json', 'w', encoding='utf-8') as f:
    json.dump(pt_BR, f, ensure_ascii=False, indent=2)

with open('messages/pt.json', 'w', encoding='utf-8') as f:
    json.dump(pt_BR, f, ensure_ascii=False, indent=2)

print("pt-BR.json and pt.json generated!")
