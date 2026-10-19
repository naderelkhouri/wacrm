"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  ShieldAlert,
  Building2,
  CreditCard,
  Settings,
  Users,
  MessageSquare,
  Radio,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  ExternalLink,
  Sliders,
  DollarSign,
  UserCheck,
  Lock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AdminGlobalWhatsAppPanel } from "@/components/admin/admin-global-whatsapp-panel";

interface OverviewMetrics {
  total_tenants: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  mrr_cents: number;
  total_revenue_cents: number;
  total_contacts: number;
  total_messages: number;
  total_whatsapp_connected: number;
  signup_mode: "open" | "invite_only" | "closed";
}

interface TenantItem {
  id: string;
  name: string;
  created_at: string;
  allow_member_invites: boolean;
  max_members: number;
  owner?: {
    user_id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  subscription?: {
    id: string;
    status: string;
    plan_id: string;
    current_period_end?: string | null;
    plan?: {
      name: string;
      price_cents: number;
    } | null;
  } | null;
}

interface TransactionItem {
  id: string;
  gateway: string;
  gateway_reference_id?: string | null;
  amount_cents: number;
  payment_method?: string | null;
  status: string;
  created_at: string;
  account?: {
    id: string;
    name: string;
  } | null;
}

interface PlatformSettings {
  mode: "open" | "invite_only" | "closed";
  source: "env" | "database";
  lockedByEnv: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isSuperAdmin, loading: authLoading } = useAuth();

  // Overview State
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Tenants State
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  // Edit Tenant Dialog
  const [selectedTenant, setSelectedTenant] = useState<TenantItem | null>(null);
  const [editPlan, setEditPlan] = useState<string>("starter");
  const [editStatus, setEditStatus] = useState<string>("active");
  const [editMaxMembers, setEditMaxMembers] = useState<number>(5);
  const [editDaysToAdd, setEditDaysToAdd] = useState<number>(0);
  const [savingTenant, setSavingTenant] = useState(false);

  // Transactions State
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  // Platform Settings State
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [selectedSignupMode, setSelectedSignupMode] = useState<"open" | "invite_only" | "closed">("open");
  const [savingSettings, setSavingSettings] = useState(false);

  // Load Overview Data
  const fetchOverview = useCallback(async () => {
    try {
      setLoadingMetrics(true);
      const res = await fetch("/api/admin/overview");
      if (!res.ok) throw new Error("Falha ao carregar visão geral.");
      const data = await res.json();
      setMetrics(data.metrics);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao carregar métricas da plataforma.");
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  // Load Tenants Data
  const fetchTenants = useCallback(async () => {
    try {
      setLoadingTenants(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/admin/tenants?${params.toString()}`);
      if (!res.ok) throw new Error("Falha ao carregar lista de empresas.");
      const data = await res.json();
      setTenants(data.tenants || []);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao carregar empresas.");
    } finally {
      setLoadingTenants(false);
    }
  }, [searchQuery]);

  // Load Transactions Data
  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTransactions(true);
      const res = await fetch("/api/admin/transactions");
      if (!res.ok) throw new Error("Falha ao carregar transações.");
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao carregar transações.");
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  // Load Platform Settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/platform-settings");
      if (!res.ok) throw new Error("Falha ao carregar configurações de governança.");
      const data = await res.json();
      setPlatformSettings(data);
      setSelectedSignupMode(data.mode);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao carregar configurações globais.");
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (isSuperAdmin) {
      fetchOverview();
      fetchTenants();
      fetchTransactions();
      fetchSettings();
    }
  }, [isSuperAdmin, fetchOverview, fetchTenants, fetchTransactions, fetchSettings]);

  // Save Tenant Manual Overrides
  const handleSaveTenant = async () => {
    if (!selectedTenant) return;
    try {
      setSavingTenant(true);
      const res = await fetch(`/api/admin/tenants/${selectedTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: editPlan,
          status: editStatus,
          maxMembers: Number(editMaxMembers) || 5,
          daysToAdd: editDaysToAdd > 0 ? Number(editDaysToAdd) : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Falha ao salvar alterações.");
      }

      toast.success(`Assinatura e limites de ${selectedTenant.name} atualizados com sucesso!`);
      setSelectedTenant(null);
      fetchTenants();
      fetchOverview();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar empresa.");
    } finally {
      setSavingTenant(false);
    }
  };

  // Save Global Platform Signup Mode
  const handleSaveSignupMode = async () => {
    try {
      setSavingSettings(true);
      const res = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedSignupMode }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Falha ao atualizar modo de cadastro.");
      }

      toast.success("Modo global de cadastro atualizado com sucesso!");
      fetchSettings();
      fetchOverview();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar configuração.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Open Edit Dialog
  const openTenantDialog = (tenant: TenantItem) => {
    setSelectedTenant(tenant);
    setEditPlan(tenant.subscription?.plan_id || "starter");
    setEditStatus(tenant.subscription?.status || "active");
    setEditMaxMembers(tenant.max_members || 5);
    setEditDaysToAdd(0);
  };

  // Format Currency
  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  // Filter Tenants
  const filteredTenants = tenants.filter((t) => {
    if (statusFilter !== "all") {
      const currentStatus = t.subscription?.status || "none";
      if (currentStatus !== statusFilter) return false;
    }
    if (planFilter !== "all") {
      const currentPlan = t.subscription?.plan_id || "none";
      if (currentPlan !== planFilter) return false;
    }
    return true;
  });

  if (authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-red-500" />
              <div>
                <CardTitle className="text-xl text-red-600">Acesso Restrito</CardTitle>
                <CardDescription>
                  Esta área é restrita aos Super Administradores da plataforma CRM WhatsApp.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Seu usuário atual ({user?.email}) não possui a permissão de Super Admin (`is_super_admin: true`).
            </p>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Voltar para o Painel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 lg:p-8 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
              Área Master da Plataforma
            </h1>
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 font-semibold gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              Super Admin
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão multi-tenant, controle de assinaturas PagBank e governança de cadastros.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchOverview();
              fetchTenants();
              fetchTransactions();
              fetchSettings();
              toast.info("Dados da plataforma atualizados.");
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Tenants */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Cadastradas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? "..." : metrics?.total_tenants ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics ? (
                <>
                  <span className="text-emerald-500 font-semibold">{metrics.active_subscriptions} ativas</span>
                  {" · "}
                  <span className="text-blue-500">{metrics.trialing_subscriptions} em teste</span>
                </>
              ) : (
                "Carregando..."
              )}
            </p>
          </CardContent>
        </Card>

        {/* MRR */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Estimado</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {loadingMetrics ? "..." : formatMoney(metrics?.mrr_cents || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita mensal recorrente contratada
            </p>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita PagBank Total</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? "..." : formatMoney(metrics?.total_revenue_cents || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total liquidado via PagBank Sandbox / Prod
            </p>
          </CardContent>
        </Card>

        {/* WhatsApp & Volume */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume & WhatsApp</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? "..." : metrics?.total_whatsapp_connected ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">instâncias</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics ? `${metrics.total_contacts} contatos · ${metrics.total_messages} msgs` : "..."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="tenants" className="gap-2">
            <Building2 className="h-4 w-4" />
            Empresas & Assinaturas ({filteredTenants.length})
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Transações PagBank ({transactions.length})
          </TabsTrigger>
          <TabsTrigger value="global-whatsapp" className="gap-2">
            <Radio className="h-4 w-4 text-emerald-500" />
            Conexão WhatsApp Global
          </TabsTrigger>
          <TabsTrigger value="governance" className="gap-2">
            <Settings className="h-4 w-4" />
            Governança da Plataforma
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tenants List & Management */}
        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Empresas & Organizações</CardTitle>
                  <CardDescription>
                    Gerencie o plano, limite de membros e status de cada tenant do sistema.
                  </CardDescription>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48 sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Buscar por nome ou e-mail..."
                      className="pl-8 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "all")}>
                    <SelectTrigger className="w-32 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="trialing">Em Teste</SelectItem>
                      <SelectItem value="past_due">Atrasado</SelectItem>
                      <SelectItem value="canceled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={planFilter} onValueChange={(val) => setPlanFilter(val ?? "all")}>
                    <SelectTrigger className="w-32 text-xs">
                      <SelectValue placeholder="Plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Planos</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTenants ? (
                <div className="flex h-48 items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Building2 className="h-10 w-10 mb-2 opacity-50" />
                  <p>Nenhuma empresa encontrada com os filtros aplicados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Proprietário</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Limite Assentos</TableHead>
                        <TableHead>Criada em</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.map((t) => {
                        const status = t.subscription?.status || "none";
                        const planId = t.subscription?.plan_id || "free";
                        const planName = t.subscription?.plan?.name || planId.toUpperCase();

                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">
                              <div>
                                <span className="font-semibold text-foreground">{t.name}</span>
                                <span className="block text-[11px] text-muted-foreground font-mono truncate max-w-[140px]">
                                  {t.id}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div>
                                <span className="text-sm">{t.owner?.full_name || "Sem nome"}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {t.owner?.email || "Sem e-mail"}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs uppercase">
                                {planName}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              {status === "active" && (
                                <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/30">
                                  Ativo
                                </Badge>
                              )}
                              {status === "trialing" && (
                                <Badge className="bg-blue-500/15 text-blue-500 hover:bg-blue-500/20 border-blue-500/30">
                                  Em Teste
                                </Badge>
                              )}
                              {status === "past_due" && (
                                <Badge className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/20 border-amber-500/30">
                                  Atrasado
                                </Badge>
                              )}
                              {status === "canceled" && (
                                <Badge className="bg-red-500/15 text-red-500 hover:bg-red-500/20 border-red-500/30">
                                  Cancelado
                                </Badge>
                              )}
                              {status === "none" && (
                                <Badge variant="secondary">Sem Assinatura</Badge>
                              )}
                            </TableCell>

                            <TableCell>
                              <span className="text-sm font-medium">
                                {t.max_members || 5} membros
                              </span>
                            </TableCell>

                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(t.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openTenantDialog(t)}
                                className="h-8 gap-1.5 text-xs"
                              >
                                <Sliders className="h-3.5 w-3.5" />
                                Gerenciar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Transactions */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pagamentos PagBank</CardTitle>
              <CardDescription>
                Transações processadas via checkout Pix e Cartão pela integração PagBank Sandbox.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTransactions ? (
                <div className="flex h-48 items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <CreditCard className="h-10 w-10 mb-2 opacity-50" />
                  <p>Nenhuma transação registrada até o momento.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transação / ID</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-xs">
                            <span className="font-semibold block">{tx.gateway_reference_id || tx.id.slice(0, 8)}</span>
                            <span className="text-[10px] text-muted-foreground">{tx.gateway}</span>
                          </TableCell>

                          <TableCell>
                            <span className="text-sm font-medium">
                              {tx.account?.name || "Empresa Desconhecida"}
                            </span>
                          </TableCell>

                          <TableCell className="font-semibold text-foreground">
                            {formatMoney(tx.amount_cents)}
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="uppercase text-[10px]">
                              {tx.payment_method || "PIX"}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            {tx.status === "PAID" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                                PAGO
                              </Badge>
                            ) : tx.status === "WAITING" ? (
                              <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">
                                AGUARDANDO
                              </Badge>
                            ) : (
                              <Badge variant="secondary">{tx.status}</Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString("pt-BR")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Governance & Platform Settings */}
        <TabsContent value="governance" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Signup Mode Policy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Controle Global de Novos Cadastros
                </CardTitle>
                <CardDescription>
                  Defina se novos visitantes podem se cadastrar livremente ou se a plataforma está fechada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {platformSettings?.lockedByEnv && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500 flex items-start gap-2">
                    <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      O modo está atualmente travado via variável de ambiente (<code>SIGNUP_MODE</code>).
                      Para alterar dinamicamente, remova a variável estática do ambiente.
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Modo de Cadastro</Label>
                  <Select
                    value={selectedSignupMode}
                    onValueChange={(val) => {
                      if (val === "open" || val === "invite_only" || val === "closed") {
                        setSelectedSignupMode(val);
                      }
                    }}
                    disabled={platformSettings?.lockedByEnv || savingSettings}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span>Aberto (Qualquer visitante pode criar conta)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="invite_only">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span>Apenas Convite (Apenas membros convidados)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="closed">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span>Fechado (Novos cadastros totalmente bloqueados)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSaveSignupMode}
                    disabled={platformSettings?.lockedByEnv || savingSettings}
                    className="gap-2"
                  >
                    {savingSettings && <RefreshCw className="h-4 w-4 animate-spin" />}
                    Salvar Política de Cadastro
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Platform Health & Infrastructure */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  Status da Infraestrutura
                </CardTitle>
                <CardDescription>
                  Visão dos serviços centrais da plataforma em produção.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">PostgreSQL (core-db)</p>
                    <p className="text-xs text-muted-foreground">178.156.202.55 · Supabase Multi-Tenant</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Operacional</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">App Node / Next.js (wacrm_app)</p>
                    <p className="text-xs text-muted-foreground">5.161.30.120 · Docker Swarm</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Ativo</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Gateway PagBank (PagSeguro)</p>
                    <p className="text-xs text-muted-foreground">Progredindosempre Sandbox · Pix Checkout</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Conectado</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Serviço VoIP</p>
                    <p className="text-xs text-muted-foreground">Chamadas de voz desativadas (503 Service Unavailable)</p>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">Desativado</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Global WhatsApp Connection */}
        <TabsContent value="global-whatsapp" className="space-y-4">
          <AdminGlobalWhatsAppPanel />
        </TabsContent>
      </Tabs>

      {/* Edit Tenant Dialog */}
      <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Empresa: {selectedTenant?.name}</DialogTitle>
            <DialogDescription>
              Substituição manual de plano, status de assinatura e quota de assentos para este tenant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plano de Assinatura</Label>
              <Select value={editPlan} onValueChange={(val) => setEditPlan(val ?? "starter")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (Gratuito)</SelectItem>
                  <SelectItem value="starter">Starter (R$ 97/mês)</SelectItem>
                  <SelectItem value="pro">Pro (R$ 197/mês)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (R$ 397/mês)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status da Assinatura</Label>
              <Select value={editStatus} onValueChange={(val) => setEditStatus(val ?? "active")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo (Acesso Liberado)</SelectItem>
                  <SelectItem value="trialing">Em Teste (Trial Ativo)</SelectItem>
                  <SelectItem value="past_due">Atrasado (Pagamento Pendente)</SelectItem>
                  <SelectItem value="canceled">Cancelado (Acesso Bloqueado)</SelectItem>
                  <SelectItem value="unpaid">Não Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Limite de Membros (Assentos)</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={editMaxMembers}
                  onChange={(e) => setEditMaxMembers(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Bônus de Dias (+Dias)</Label>
                <Input
                  type="number"
                  min="0"
                  max="365"
                  placeholder="Ex: 30"
                  value={editDaysToAdd || ""}
                  onChange={(e) => setEditDaysToAdd(Number(e.target.value) || 0)}
                />
                <p className="text-[10px] text-muted-foreground">Estende o current_period_end</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTenant(null)} disabled={savingTenant}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTenant} disabled={savingTenant} className="gap-2">
              {savingTenant && <RefreshCw className="h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
