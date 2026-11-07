"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  ShieldAlert,
  Building2,
  CreditCard,
  Settings,
  Radio,
  Activity,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Sliders,
  DollarSign,
  UserCheck,
  Lock,
  TrendingUp,
  Layers,
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
import { AdminTelemetryDashboard } from "@/components/admin/admin-telemetry-dashboard";
import { AdminUazapiNodesPanel } from "@/components/admin/admin-uazapi-nodes-panel";

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
  const t = useTranslations("Admin");
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
      toast.error(t("errLoadOverview"));
    } finally {
      setLoadingMetrics(false);
    }
  }, [t]);

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
      toast.error(t("errLoadTenants"));
    } finally {
      setLoadingTenants(false);
    }
  }, [searchQuery, t]);

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
      toast.error(t("errLoadTransactions"));
    } finally {
      setLoadingTransactions(false);
    }
  }, [t]);

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
      toast.error(t("errLoadSettings"));
    }
  }, [t]);

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

      toast.success(t("tenantUpdated", { name: selectedTenant.name }));
      setSelectedTenant(null);
      fetchTenants();
      fetchOverview();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("errLoadTenants"));
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

      toast.success(t("signupModeUpdated"));
      fetchSettings();
      fetchOverview();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("errLoadSettings"));
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
                <CardTitle className="text-xl text-red-600">{t("accessRestricted")}</CardTitle>
                <CardDescription>
                  {t("accessRestrictedDesc")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("noSuperAdminPermission", { email: user?.email || "" })}
            </p>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              {t("backToDashboard")}
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
              {t("title")}
            </h1>
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 font-semibold gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              {t("superAdminBadge")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
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
              toast.info(t("dataRefreshed"));
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t("refresh")}
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Tenants */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("tenantsKpiTitle")}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? "..." : metrics?.total_tenants ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics ? (
                <>
                  <span className="text-emerald-500 font-semibold">
                    {t("activeCount", { count: metrics.active_subscriptions })}
                  </span>
                  {" · "}
                  <span className="text-blue-500">
                    {t("trialingCount", { count: metrics.trialing_subscriptions })}
                  </span>
                </>
              ) : (
                t("loading")
              )}
            </p>
          </CardContent>
        </Card>

        {/* MRR */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("mrrKpiTitle")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {loadingMetrics ? "..." : formatMoney(metrics?.mrr_cents || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("mrrKpiDesc")}
            </p>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("revenueKpiTitle")}</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? "..." : formatMoney(metrics?.total_revenue_cents || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("revenueKpiDesc")}
            </p>
          </CardContent>
        </Card>

        {/* WhatsApp & Volume */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("volumeKpiTitle")}</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? "..." : metrics?.total_whatsapp_connected ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {t("instancesCount", { count: "" }).trim()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics ? t("volumeStats", { contacts: metrics.total_contacts, messages: metrics.total_messages }) : "..."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="tenants" className="gap-2">
            <Building2 className="h-4 w-4" />
            {t("tabTenants", { count: filteredTenants.length })}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <CreditCard className="h-4 w-4" />
            {t("tabTransactions", { count: transactions.length })}
          </TabsTrigger>
          <TabsTrigger value="global-whatsapp" className="gap-2">
            <Radio className="h-4 w-4 text-emerald-500" />
            {t("tabGlobalWhatsapp")}
          </TabsTrigger>
          <TabsTrigger value="uazapi-shards" className="gap-2">
            <Layers className="h-4 w-4 text-emerald-500" />
            Shards Uazapi (300)
          </TabsTrigger>
          <TabsTrigger value="telemetry" className="gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            {t("tabTelemetry")}
          </TabsTrigger>
          <TabsTrigger value="governance" className="gap-2">
            <Settings className="h-4 w-4" />
            {t("tabGovernance")}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tenants List & Management */}
        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t("tenantsTitle")}</CardTitle>
                  <CardDescription>
                    {t("tenantsDesc")}
                  </CardDescription>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48 sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder={t("searchPlaceholder")}
                      className="pl-8 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "all")}>
                    <SelectTrigger className="w-32 text-xs">
                      <SelectValue placeholder={t("statusPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allStatuses")}</SelectItem>
                      <SelectItem value="active">{t("statusActive")}</SelectItem>
                      <SelectItem value="trialing">{t("statusTrialing")}</SelectItem>
                      <SelectItem value="past_due">{t("statusPastDue")}</SelectItem>
                      <SelectItem value="canceled">{t("statusCanceled")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={planFilter} onValueChange={(val) => setPlanFilter(val ?? "all")}>
                    <SelectTrigger className="w-32 text-xs">
                      <SelectValue placeholder={t("planPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allPlans")}</SelectItem>
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
                  <p>{t("noTenantsFound")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("tableCompany")}</TableHead>
                        <TableHead>{t("tableOwner")}</TableHead>
                        <TableHead>{t("tablePlan")}</TableHead>
                        <TableHead>{t("tableStatus")}</TableHead>
                        <TableHead>{t("tableSeatLimit")}</TableHead>
                        <TableHead>{t("tableCreatedAt")}</TableHead>
                        <TableHead className="text-right">{t("tableAction")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.map((tItem) => {
                        const status = tItem.subscription?.status || "none";
                        const planId = tItem.subscription?.plan_id || "free";
                        const planName = tItem.subscription?.plan?.name || planId.toUpperCase();

                        return (
                          <TableRow key={tItem.id}>
                            <TableCell className="font-medium">
                              <div>
                                <span className="font-semibold text-foreground">{tItem.name}</span>
                                <span className="block text-[11px] text-muted-foreground font-mono truncate max-w-[140px]">
                                  {tItem.id}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div>
                                <span className="text-sm">{tItem.owner?.full_name || t("noName")}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {tItem.owner?.email || t("noEmail")}
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
                                  {t("statusActive")}
                                </Badge>
                              )}
                              {status === "trialing" && (
                                <Badge className="bg-blue-500/15 text-blue-500 hover:bg-blue-500/20 border-blue-500/30">
                                  {t("statusTrialing")}
                                </Badge>
                              )}
                              {status === "past_due" && (
                                <Badge className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/20 border-amber-500/30">
                                  {t("statusPastDue")}
                                </Badge>
                              )}
                              {status === "canceled" && (
                                <Badge className="bg-red-500/15 text-red-500 hover:bg-red-500/20 border-red-500/30">
                                  {t("statusCanceled")}
                                </Badge>
                              )}
                              {status === "none" && (
                                <Badge variant="secondary">{t("statusNone")}</Badge>
                              )}
                            </TableCell>

                            <TableCell>
                              <span className="text-sm font-medium">
                                {t("membersCount", { count: tItem.max_members || 5 })}
                              </span>
                            </TableCell>

                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(tItem.created_at).toLocaleDateString()}
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openTenantDialog(tItem)}
                                className="h-8 gap-1.5 text-xs"
                              >
                                <Sliders className="h-3.5 w-3.5" />
                                {t("manage")}
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
              <CardTitle>{t("txHistoryTitle")}</CardTitle>
              <CardDescription>
                {t("txHistoryDesc")}
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
                  <p>{t("noTxFound")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("tableTxId")}</TableHead>
                        <TableHead>{t("tableCompany")}</TableHead>
                        <TableHead>{t("tableTxAmount")}</TableHead>
                        <TableHead>{t("tableTxMethod")}</TableHead>
                        <TableHead>{t("tableStatus")}</TableHead>
                        <TableHead>{t("tableTxDate")}</TableHead>
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
                              {tx.account?.name || t("unknownCompany")}
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
                                {t("txStatusPaid")}
                              </Badge>
                            ) : tx.status === "WAITING" ? (
                              <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">
                                {t("txStatusWaiting")}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">{tx.status}</Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString()}
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
                  {t("signupControlTitle")}
                </CardTitle>
                <CardDescription>
                  {t("signupControlDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {platformSettings?.lockedByEnv && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500 flex items-start gap-2">
                    <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {t("signupLockedNotice")}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t("signupModeLabel")}</Label>
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
                          <span>{t("modeOpen")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="invite_only">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span>{t("modeInviteOnly")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="closed">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span>{t("modeClosed")}</span>
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
                    {t("saveSignupPolicy")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Platform Health & Infrastructure */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  {t("infraStatusTitle")}
                </CardTitle>
                <CardDescription>
                  {t("infraStatusDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">PostgreSQL (core-db)</p>
                    <p className="text-xs text-muted-foreground">178.156.202.55 · Supabase Multi-Tenant</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">{t("statusOperational")}</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">App Node / Next.js (wacrm_app)</p>
                    <p className="text-xs text-muted-foreground">5.161.30.120 · Docker Swarm</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">{t("statusActiveBadge")}</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Gateway PagBank (PagSeguro)</p>
                    <p className="text-xs text-muted-foreground">Progredindosempre Sandbox · Pix Checkout</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">{t("statusConnected")}</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Serviço VoIP</p>
                    <p className="text-xs text-muted-foreground">{t("voipDesc")}</p>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">{t("statusDisabled")}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Global WhatsApp Connection */}
        <TabsContent value="global-whatsapp" className="space-y-4">
          <AdminGlobalWhatsAppPanel />
        </TabsContent>

        {/* Tab 5: Uazapi Sharding Pools & 300-Slot Nodes */}
        <TabsContent value="uazapi-shards" className="space-y-4">
          <AdminUazapiNodesPanel />
        </TabsContent>

        {/* Tab 6: Telemetry & Autonomous Self-Healing */}
        <TabsContent value="telemetry" className="space-y-4">
          <AdminTelemetryDashboard />
        </TabsContent>
      </Tabs>

      {/* Edit Tenant Dialog */}
      <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("manageTenantTitle", { name: selectedTenant?.name || "" })}</DialogTitle>
            <DialogDescription>
              {t("manageTenantDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("planLabel")}</Label>
              <Select value={editPlan} onValueChange={(val) => setEditPlan(val ?? "starter")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("subscriptionStatusLabel")}</Label>
              <Select value={editStatus} onValueChange={(val) => setEditStatus(val ?? "active")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("statusActive")}</SelectItem>
                  <SelectItem value="trialing">{t("statusTrialing")}</SelectItem>
                  <SelectItem value="past_due">{t("statusPastDue")}</SelectItem>
                  <SelectItem value="canceled">{t("statusCanceled")}</SelectItem>
                  <SelectItem value="unpaid">{t("statusUnpaid")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("memberLimitLabel")}</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={editMaxMembers}
                  onChange={(e) => setEditMaxMembers(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("daysToAddLabel")}</Label>
                <Input
                  type="number"
                  min="0"
                  max="365"
                  placeholder="Ex: 30"
                  value={editDaysToAdd || ""}
                  onChange={(e) => setEditDaysToAdd(Number(e.target.value) || 0)}
                />
                <p className="text-[10px] text-muted-foreground">{t("daysToAddHint")}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTenant(null)} disabled={savingTenant}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveTenant} disabled={savingTenant} className="gap-2">
              {savingTenant && <RefreshCw className="h-4 w-4 animate-spin" />}
              {t("saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
