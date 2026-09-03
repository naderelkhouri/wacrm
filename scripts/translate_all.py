#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import copy

with open('messages/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

# Comprehensive phrase translation mapping for Portuguese
pt_translations = {
    # Common actions & labels
    "Sign in to accept": "Entre para aceitar",
    "Welcome back": "Bem-vindo de volta",
    "Sign in and we'll take you to the invitation.": "Faça login e você será direcionado para o convite.",
    "Sign in to your account": "Entre na sua conta",
    "Email": "E-mail",
    "Password": "Senha",
    "Forgot password?": "Esqueceu a senha?",
    "Enter your password": "Digite sua senha",
    "Signing in...": "Entrando...",
    "Sign in": "Entrar",
    "Don't have an account?": "Não tem uma conta?",
    "Create account": "Criar conta",
    "CRM Template for WhatsApp": "CRM WhatsApp",
    "Dashboard": "Painel",
    "Inbox": "Conversas",
    "Notifications": "Notificações",
    "Contacts": "Contatos",
    "Pipelines": "Funis de Vendas",
    "Broadcasts": "Transmissões",
    "Automations": "Automações",
    "Flows": "Fluxos",
    "AI Agents": "Agentes de IA",
    "Settings": "Configurações",
    "Beta": "Beta",
    "Owner": "Proprietário",
    "Admin": "Administrador",
    "Agent": "Atendente",
    "Viewer": "Visualizador",
    "Close menu": "Fechar menu",
    "User": "Usuário",
    "Avatar": "Avatar",
    "Profile": "Perfil",
    "Sign out": "Sair",
    "Open menu": "Abrir menu",
    "Open account menu": "Abrir menu da conta",
    "Switch to {mode} mode": "Mudar para modo {mode}",
    "Live analytics across conversations, contacts, deals, broadcasts, and automations.": "Métricas em tempo real sobre conversas, contatos, negócios, transmissões e automações.",
    "Active Conversations": "Conversas Ativas",
    "New Contacts Today": "Novos Contatos Hoje",
    "Open Deals Value": "Valor em Negócios Abertos",
    "Messages Sent Today": "Mensagens Enviadas Hoje",
    "new today vs yesterday": "novos hoje vs ontem",
    "vs yesterday": "vs ontem",
    "No change {suffix}": "Sem alteração {suffix}",
    "New Contact": "Novo Contato",
    "New Deal": "Novo Negócio",
    "New Broadcast": "Nova Transmissão",
    "New Automation": "Nova Automação",
    "Recent Activity": "Atividades Recentes",
    "View all →": "Ver tudo →",
    "No activity yet": "Nenhuma atividade recente",
    "Activity from messages, deals, broadcasts, and automations will appear here.": "Atividades de mensagens, negócios, transmissões e automações aparecerão aqui.",
    "Showing {visible} of {totalLoaded}{plus}": "Exibindo {visible} de {totalLoaded}{plus}",
    "Show": "Exibir",
    "{sec}s ago": "há {sec}s",
    "{min}m ago": "há {min}min",
    "{hr}h ago": "há {hr}h",
    "{day}d ago": "há {day}d",
    "Conversations Over Time": "Volume de Conversas",
    "Daily message volume by direction": "Volume diário de mensagens por direção",
    "{count} days": "{count} dias",
    "No message activity in this range": "Sem atividade de mensagens neste período",
    "Send or receive messages to start populating this chart.": "Envie ou receba mensagens para popular este gráfico.",
    "Incoming": "Recebidas",
    "Outgoing": "Enviadas",
    "Deals by Stage": "Negócios por Estágio",
    "Value distribution across the pipeline": "Distribuição de valor no funil de vendas",
    "No deals in pipeline": "Nenhum negócio no funil",
    "Create deals in the pipeline to see stage distribution.": "Crie negócios para visualizar a distribuição dos estágios.",
    "Response Time": "Tempo de Resposta",
    "Average time to first response across conversations": "Tempo médio para a primeira resposta da equipe",
    "Avg First Response": "Primeira resposta média",
    "Median First Response": "Mediana da primeira resposta",
    "Not enough response time data": "Sem dados de tempo de resposta suficientes",
    "Reply to incoming conversations to generate response time metrics.": "Responda às conversas recebidas para gerar estatísticas de tempo de resposta."
}

# Spanish translation mapping
es_translations = {
    "Sign in to accept": "Iniciar sesión para aceptar",
    "Welcome back": "Bienvenido de nuevo",
    "Sign in and we'll take you to the invitation.": "Inicia sesión y te dirigiremos a la invitación.",
    "Sign in to your account": "Inicia sesión en tu cuenta",
    "Email": "Correo electrónico",
    "Password": "Contraseña",
    "Forgot password?": "¿Olvidaste tu contraseña?",
    "Enter your password": "Ingresa tu contraseña",
    "Signing in...": "Iniciando sesión...",
    "Sign in": "Iniciar sesión",
    "Don't have an account?": "¿No tienes una cuenta?",
    "Create account": "Crear cuenta",
    "CRM Template for WhatsApp": "CRM WhatsApp",
    "Dashboard": "Panel",
    "Inbox": "Conversaciones",
    "Notifications": "Notificaciones",
    "Contacts": "Contactos",
    "Pipelines": "Embudos de Ventas",
    "Broadcasts": "Difusiones",
    "Automations": "Automatizaciones",
    "Flows": "Flujos",
    "AI Agents": "Agentes de IA",
    "Settings": "Configuración",
    "Beta": "Beta",
    "Owner": "Propietario",
    "Admin": "Administrador",
    "Agent": "Agente",
    "Viewer": "Visualizador",
    "Close menu": "Cerrar menú",
    "User": "Usuario",
    "Avatar": "Avatar",
    "Profile": "Perfil",
    "Sign out": "Cerrar sesión",
    "Open menu": "Abrir menú",
    "Open account menu": "Abrir menú de cuenta",
    "Switch to {mode} mode": "Cambiar a modo {mode}",
    "Live analytics across conversations, contacts, deals, broadcasts, and automations.": "Métricas en tiempo real de conversaciones, contactos, acuerdos, difusiones y automatizaciones.",
    "Active Conversations": "Conversaciones Activas",
    "New Contacts Today": "Nuevos Contactos Hoy",
    "Open Deals Value": "Valor en Acuerdos Abiertos",
    "Messages Sent Today": "Mensajes Enviados Hoy",
    "new today vs yesterday": "nuevos hoy vs ayer",
    "vs yesterday": "vs ayer",
    "No change {suffix}": "Sin cambios {suffix}",
    "New Contact": "Nuevo Contacto",
    "New Deal": "Nuevo Acuerdo",
    "New Broadcast": "Nueva Difusión",
    "New Automation": "Nueva Automatización",
    "Recent Activity": "Actividad Reciente",
    "View all →": "Ver todo →",
    "No activity yet": "Sin actividad reciente",
    "Activity from messages, deals, broadcasts, and automations will appear here.": "Las actividades de mensajes, acuerdos, difusiones y automatizaciones aparecerán aquí.",
    "Showing {visible} of {totalLoaded}{plus}": "Mostrando {visible} de {totalLoaded}{plus}",
    "Show": "Mostrar",
    "{sec}s ago": "hace {sec}s",
    "{min}m ago": "hace {min}m",
    "{hr}h ago": "hace {hr}h",
    "{day}d ago": "hace {day}d",
    "Conversations Over Time": "Volumen de Conversaciones",
    "Daily message volume by direction": "Volumen diario de mensajes por dirección",
    "{count} days": "{count} días",
    "No message activity in this range": "Sin actividad de mensajes en este período",
    "Send or receive messages to start populating this chart.": "Envía o recibe mensajes para poblar este gráfico.",
    "Incoming": "Entrantes",
    "Outgoing": "Salientes",
    "Deals by Stage": "Acuerdos por Etapa",
    "Value distribution across the pipeline": "Distribución de valor en el embudo",
    "No deals in pipeline": "No hay acuerdos en el embudo",
    "Create deals in the pipeline to see stage distribution.": "Crea acuerdos para ver la distribución de etapas.",
    "Response Time": "Tiempo de Respuesta",
    "Average time to first response across conversations": "Tiempo promedio de primera respuesta del equipo",
    "Avg First Response": "Primera respuesta promedio",
    "Median First Response": "Mediana de primera respuesta",
    "Not enough response time data": "No hay suficientes datos de tiempo de respuesta",
    "Reply to incoming conversations to generate response time metrics.": "Responde a conversaciones para generar métricas."
}

def translate_tree(node, dictionary, lang="pt-BR"):
    if isinstance(node, dict):
        res = {}
        for k, v in node.items():
            res[k] = translate_tree(v, dictionary, lang)
        return res
    elif isinstance(node, list):
        return [translate_tree(item, dictionary, lang) for item in node]
    elif isinstance(node, str):
        # 1. Exact match in dictionary
        if node in dictionary:
            return dictionary[node]
        
        # 2. Check ICU plurals
        if "{count, plural," in node:
            if lang == "pt-BR":
                # Translate inner phrases
                node_pt = node.replace("conversation", "conversa").replace("conversations", "conversas")
                node_pt = node_pt.replace("notification", "notificação").replace("notifications", "notificações")
                node_pt = node_pt.replace("deal", "negócio").replace("deals", "negócios")
                node_pt = node_pt.replace("contact", "contato").replace("contacts", "contatos")
                node_pt = node_pt.replace("member", "membro").replace("members", "membros")
                node_pt = node_pt.replace("invite", "convite").replace("invites", "convites")
                node_pt = node_pt.replace("template", "modelo").replace("templates", "modelos")
                node_pt = node_pt.replace("message", "mensagem").replace("messages", "mensagens")
                node_pt = node_pt.replace("tag", "tag").replace("tags", "tags")
                node_pt = node_pt.replace("open", "aberto").replace("unread", "não lida")
                return node_pt
            elif lang == "es":
                node_es = node.replace("conversation", "conversación").replace("conversations", "conversaciones")
                node_es = node_es.replace("notification", "notificación").replace("notifications", "notificaciones")
                node_es = node_es.replace("deal", "acuerdo").replace("deals", "acuerdos")
                node_es = node_es.replace("contact", "contacto").replace("contacts", "contactos")
                node_es = node_es.replace("member", "miembro").replace("members", "miembros")
                node_es = node_es.replace("invite", "invitación").replace("invites", "invitaciones")
                node_es = node_es.replace("template", "plantilla").replace("templates", "plantillas")
                node_es = node_es.replace("message", "mensaje").replace("messages", "mensajes")
                node_es = node_es.replace("tag", "etiqueta").replace("tags", "etiquetas")
                node_es = node_es.replace("open", "abierto").replace("unread", "no leída")
                return node_es

        return node
    return node

# First, merge pt_dict from previous script if present
with open('messages/pt-BR.json', 'r', encoding='utf-8') as f:
    pt_base = json.load(f)

# Clone complete structure of en.json and replace with translations
pt_final = translate_tree(en, pt_translations, lang="pt-BR")

def deep_update(target, source):
    for k, v in source.items():
        if k in target:
            if isinstance(v, dict) and isinstance(target[k], dict):
                deep_update(target[k], v)
            elif not isinstance(v, dict) and not isinstance(target[k], dict):
                target[k] = v

deep_update(pt_final, pt_base)

with open('messages/pt-BR.json', 'w', encoding='utf-8') as f:
    json.dump(pt_final, f, ensure_ascii=False, indent=2)

with open('messages/pt.json', 'w', encoding='utf-8') as f:
    json.dump(pt_final, f, ensure_ascii=False, indent=2)

# Generate es.json
es_final = translate_tree(en, es_translations, lang="es")
with open('messages/es.json', 'w', encoding='utf-8') as f:
    json.dump(es_final, f, ensure_ascii=False, indent=2)

print("Generated messages/pt-BR.json, messages/pt.json, and messages/es.json!")
