#!/usr/bin/env python3
"""
Generate complete Portuguese (pt-BR) and Spanish (es) translations for wacrm.
"""
import json
import os
import re

# Load base English file
with open('messages/en.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

# Comprehensive Pt-BR dictionary
pt_br = {
  "LoginPage": {
    "titleAccept": "Entre para aceitar",
    "titleWelcome": "Bem-vindo de volta",
    "descAccept": "Faça login e você será direcionado para o convite.",
    "descWelcome": "Entre na sua conta",
    "emailLabel": "E-mail",
    "emailPlaceholder": "seu@email.com",
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
    "switchMode": "Mudar para modo {mode}"
  }
}

# Add all other sections with robust mapping...
