'use client';

import { useTranslations } from 'next-intl';
import {
  ShieldAlert,
  ChevronRight,
  Building2,
  CreditCard,
  Layers,
  Radio,
  Activity,
  Settings,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import type { AdminMasterSection } from './admin-master-sections';

interface OverviewMetrics {
  total_tenants: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  mrr_cents: number;
  total_revenue_cents: number;
  total_contacts: number;
  total_messages: number;
  total_whatsapp_connected: number;
  signup_mode: 'open' | 'invite_only' | 'closed';
}

interface PlatformSettings {
  mode: 'open' | 'invite_only' | 'closed';
  source: 'env' | 'database';
  lockedByEnv: boolean;
}

export function AdminMasterOverview({
  metrics,
  loadingMetrics,
  platformSettings,
  onSelect,
  onRefresh,
}: {
  metrics: OverviewMetrics | null;
  loadingMetrics: boolean;
  platformSettings: PlatformSettings | null;
  onSelect: (section: AdminMasterSection) => void;
  onRefresh: () => void;
}) {
  const t = useTranslations('Admin');
  const { user, profile } = useAuth();

  const displayName = profile?.full_name || profile?.email || user?.email || 'SuperAdmin';
  const initial = (profile?.full_name || user?.email || 'S').charAt(0).toUpperCase();

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const tiles: {
    section: AdminMasterSection;
    title: string;
    icon: typeof Building2;
    iconTone: string;
    subtitle: string;
    badge?: string;
  }[] = [
    {
      section: 'tenants',
      title: 'Empresas & Contas',
      icon: Building2,
      iconTone: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      subtitle: `${metrics?.total_tenants ?? 0} cadastradas · ${metrics?.active_subscriptions ?? 0} ativas`,
      badge: `${metrics?.total_tenants ?? 0} orgs`,
    },
    {
      section: 'transactions',
      title: 'Transações & Faturamento',
      icon: CreditCard,
      iconTone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      subtitle: `${formatMoney(metrics?.total_revenue_cents ?? 0)} processados na plataforma`,
      badge: 'Asaas & Stripe',
    },
    {
      section: 'uazapi-shards',
      title: 'Shards Uazapi (300)',
      icon: Layers,
      iconTone: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      subtitle: 'Cluster de 300 instâncias · Balanceamento dinâmico & failover',
      badge: '300 Shards',
    },
    {
      section: 'global-whatsapp',
      title: 'WhatsApp Global',
      icon: Radio,
      iconTone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      subtitle: `${metrics?.total_whatsapp_connected ?? 0} conexões ativas na rede corporativa`,
      badge: 'Cloud API',
    },
    {
      section: 'telemetry',
      title: 'Telemetria & Auto-Heal',
      icon: Activity,
      iconTone: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      subtitle: 'Monitoramento contínuo (cron 2 min) · Auto-recuperação ativa',
      badge: 'Health 100%',
    },
    {
      section: 'governance',
      title: 'Governança da Plataforma',
      icon: Settings,
      iconTone: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
      subtitle: `Modo de cadastro: ${platformSettings?.mode ?? 'open'} ${
        platformSettings?.lockedByEnv ? '(Trava de ambiente ativa)' : ''
      }`,
      badge: platformSettings?.mode ?? 'Ativo',
    },
  ];

  return (
    <section className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Identity Card */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-card border-border">
        <div className="flex items-center gap-4">
          <Avatar className="size-14 border border-amber-500/30">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-amber-500/10 text-xl font-bold text-amber-500">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-semibold text-foreground">
                {displayName}
              </span>
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-[11px] font-semibold gap-1 shrink-0"
              >
                <ShieldAlert className="size-3" />
                Super Administrador
              </Badge>
            </div>
            <div className="truncate text-xs text-muted-foreground mt-0.5">
              {profile?.email || user?.email} · Nível de Acesso Root
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="text-xs gap-1.5 border-border"
          >
            <RefreshCw className={cn('size-3.5', loadingMetrics ? 'animate-spin' : '')} />
            Atualizar Métricas
          </Button>
        </div>
      </Card>

      {/* Platform Health / Status Card */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              Status da Plataforma: Operacional
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Todos os subsistemas saudáveis · Shards ativos · Telemetria automática executando a cada 2 min.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelect('telemetry')}
            className="text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 shrink-0"
          >
            Ver Telemetria
          </Button>
        </div>
      </Card>

      {/* 4 Top KPI Cards Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Tenants */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total de Empresas
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? '...' : metrics?.total_tenants ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-emerald-500 font-semibold">
                {metrics?.active_subscriptions ?? 0} ativas
              </span>
              {' · '}
              <span className="text-blue-500">
                {metrics?.trialing_subscriptions ?? 0} teste
              </span>
            </p>
          </CardContent>
        </Card>

        {/* MRR */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              MRR Mensal
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {loadingMetrics ? '...' : formatMoney(metrics?.mrr_cents || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita recorrente estimada
            </p>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Faturamento Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? '...' : formatMoney(metrics?.total_revenue_cents || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Histórico acumulado
            </p>
          </CardContent>
        </Card>

        {/* WhatsApp & Volume */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Conexões WhatsApp
            </CardTitle>
            <Radio className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? '...' : metrics?.total_whatsapp_connected ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics ? `${metrics.total_contacts} contatos` : '...'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2x3 Interactive Quick-Navigation Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(({ section, title, icon: Icon, iconTone, subtitle, badge }) => (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            className={cn(
              'group flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 text-left transition-all',
              'hover:border-primary-soft-2 hover:bg-card-2 hover:shadow-sm',
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg border',
                iconTone,
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-1">
                <span className="block text-sm font-semibold text-foreground">
                  {title}
                </span>
                {badge && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                    {badge}
                  </Badge>
                )}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground line-clamp-2">
                {subtitle}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 mt-0.5" />
          </button>
        ))}
      </div>
    </section>
  );
}
