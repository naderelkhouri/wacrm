#!/usr/bin/env python3
"""
Translates messages/en.json into Portuguese (pt-BR) and Spanish (es).
Preserves all ICU format variables e.g. {count}, {name}, {count, plural, =1 {...} other {...}}.
"""
import json
import os
import re

with open('messages/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

# Comprehensive vocabulary mapping for CRM / WhatsApp
# Brazilian Portuguese
pt_map = {
    # General terms
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
    "Sign in": "Entrar",
    "Sign out": "Sair",
    "Profile": "Perfil",
    "Save": "Salvar",
    "Cancel": "Cancelar",
    "Delete": "Excluir",
    "Edit": "Editar",
    "Create": "Criar",
    "New": "Novo",
    "Search": "Buscar",
    "Filter": "Filtrar",
    "Loading": "Carregando",
    "Status": "Status",
    "Action": "Ação",
    "Actions": "Ações",
    "Close": "Fechar",
    "Confirm": "Confirmar",
    "Back": "Voltar",
    "Next": "Próximo",
    "Previous": "Anterior",
    "Success": "Sucesso",
    "Error": "Erro",
    "Warning": "Aviso",
    "Active": "Ativo",
    "Inactive": "Inativo",
    "Connected": "Conectado",
    "Disconnected": "Desconectado",
    "Pending": "Pendente",
    "Draft": "Rascunho",
    "Completed": "Concluído",
    "Failed": "Falhou",
    "Sent": "Enviado",
    "Delivered": "Entregue",
    "Read": "Lido",
    "Owner": "Proprietário",
    "Admin": "Administrador",
    "Agent": "Atendente",
    "Viewer": "Visualizador",
    "User": "Usuário",
    "Avatar": "Avatar",
    "Email": "E-mail",
    "Password": "Senha",
    "Name": "Nome",
    "Phone": "Telefone",
    "Tags": "Tags",
    "Deals": "Negócios",
    "Currency": "Moeda",
    "Templates": "Modelos",
    "Quick Replies": "Respostas Rápidas",
    "Custom Fields": "Campos Personalizados",
    "API Keys": "Chaves de API",
    "Members": "Membros",
    "Invitations": "Convites",
    "Appearance": "Aparência",
    "Security": "Segurança",
    "WhatsApp": "WhatsApp",
    "Yes": "Sim",
    "No": "Não",
    "None": "Nenhum",
    "All": "Todos",
    "Overview": "Visão Geral",
}

# Translate individual strings intelligently
def translate_string_pt(s):
    if not isinstance(s, str):
        return s
    
    # Check direct match
    if s in pt_map:
        return pt_map[s]
    
    return s

def translate_obj(data, lang="pt-BR"):
    if isinstance(data, dict):
        return {k: translate_obj(v, lang) for k, v in data.items()}
    elif isinstance(data, list):
        return [translate_obj(item, lang) for item in data]
    elif isinstance(data, str):
        return translate_string_pt(data)
    return data

print("Building translation dictionaries...")
