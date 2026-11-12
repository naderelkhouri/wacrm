import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Layers,
  Radio,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type AdminMasterSection =
  | 'overview'
  | 'tenants'
  | 'transactions'
  | 'uazapi-shards'
  | 'global-whatsapp'
  | 'telemetry'
  | 'governance';

export type AdminRailGroup = 'general' | 'business' | 'infrastructure' | 'system';

export interface AdminSectionMeta {
  group: AdminRailGroup;
  icon: LucideIcon;
  titleKey: string;
  defaultTitle: string;
  desc: string;
}

export const ADMIN_SECTIONS: AdminMasterSection[] = [
  'overview',
  'tenants',
  'transactions',
  'uazapi-shards',
  'global-whatsapp',
  'telemetry',
  'governance',
];

export const ADMIN_SECTION_META: Record<AdminMasterSection, AdminSectionMeta> = {
  overview: {
    group: 'general',
    icon: LayoutDashboard,
    titleKey: 'tabOverview',
    defaultTitle: 'Visão Geral',
    desc: 'Centro de comando, métricas vitais e status operacional',
  },
  tenants: {
    group: 'business',
    icon: Building2,
    titleKey: 'tabTenants',
    defaultTitle: 'Empresas',
    desc: 'Gerenciamento de assinaturas, planos e limites de membros',
  },
  transactions: {
    group: 'business',
    icon: CreditCard,
    titleKey: 'tabTransactions',
    defaultTitle: 'Transações',
    desc: 'Auditoria de cobranças Asaas/Stripe e conciliação financeira',
  },
  'uazapi-shards': {
    group: 'infrastructure',
    icon: Layers,
    titleKey: 'tabUazapiShards',
    defaultTitle: 'Shards Uazapi',
    desc: 'Cluster de instâncias dedicadas, balanceamento e failover',
  },
  'global-whatsapp': {
    group: 'infrastructure',
    icon: Radio,
    titleKey: 'tabGlobalWhatsapp',
    defaultTitle: 'WhatsApp Global',
    desc: 'Conexões corporativas Meta Cloud API e roteamento global',
  },
  telemetry: {
    group: 'system',
    icon: Sparkles,
    titleKey: 'tabTelemetry',
    defaultTitle: 'Uso & Melhorias',
    desc: 'Monitoramento de uso LGPD, captura de bugs silenciosos e backlog 0-5★',
  },
  governance: {
    group: 'system',
    icon: Settings,
    titleKey: 'tabGovernance',
    defaultTitle: 'Governança',
    desc: 'Controle de cadastro, travas de segurança e flags de sistema',
  },
};

export const ADMIN_RAIL_GROUPS: { group: AdminRailGroup; label: string }[] = [
  { group: 'general', label: 'Visão Geral' },
  { group: 'business', label: 'Clientes & Vendas' },
  { group: 'infrastructure', label: 'Infraestrutura' },
  { group: 'system', label: 'Sistema & Segurança' },
];

export function resolveAdminSection(tab: string | null | undefined): AdminMasterSection {
  if (!tab) return 'overview';
  if ((ADMIN_SECTIONS as readonly string[]).includes(tab)) {
    return tab as AdminMasterSection;
  }
  return 'overview';
}
