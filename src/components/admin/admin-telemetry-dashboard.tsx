"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Zap,
  Cpu,
  Database,
  Sparkles,
  Clock,
  ShieldCheck,
  Server,
  Layers,
  Flame,
  Radio,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  TelemetryMetricsSnapshot,
  TelemetryAnomaly,
  TelemetryEvent,
  RemediationAction,
  OptimizationRecommendation,
} from "@/lib/telemetry/types";

export function AdminTelemetryDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<TelemetryMetricsSnapshot | null>(null);
  const [anomalies, setAnomalies] = useState<TelemetryAnomaly[]>([]);
  const [recentEvents, setRecentEvents] = useState<TelemetryEvent[]>([]);
  const [remediations, setRemediations] = useState<RemediationAction[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);

  const fetchTelemetry = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setRefreshing(true);
      const res = await fetch("/api/admin/telemetry");
      if (!res.ok) {
        throw new Error("Falha ao carregar dados de telemetria");
      }
      const json = await res.json();
      if (json.success && json.data) {
        setSnapshot(json.data.snapshot);
        setAnomalies(json.data.anomalies || []);
        setRecentEvents(json.data.recent_events || []);
        setRemediations(json.data.remediation_history || []);
        setRecommendations(json.data.recommendations || []);
      }
    } catch (err: unknown) {
      if (!isSilent) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar telemetria");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Auto-refresh interval (every 10 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchTelemetry(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTelemetry]);

  // Execute an automated remediation action
  const handleExecuteAction = async (actionType: RemediationAction["action_type"], label: string) => {
    try {
      setActionInProgress(actionType);
      const res = await fetch("/api/admin/telemetry/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_type: actionType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao executar ação de remediação");
      }
      toast.success(data.message || `Ação ${label} executada com sucesso!`);
      await fetchTelemetry(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao executar ação");
    } finally {
      setActionInProgress(null);
    }
  };

  // Apply smart recommendation
  const handleApplyRecommendation = async (rec: OptimizationRecommendation) => {
    try {
      setActionInProgress(rec.id);
      const res = await fetch("/api/admin/telemetry/recommendations/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendation_id: rec.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao aplicar recomendação");
      }
      toast.success(data.message || `Melhoria "${rec.title}" aplicada com sucesso!`);
      await fetchTelemetry(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao aplicar melhoria");
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="text-sm text-muted-foreground font-medium">
          Carregando métricas de telemetria e motores de auto-cura...
        </p>
      </div>
    );
  }

  const healthIndex = snapshot?.health_index ?? 100;
  const isHealthy = healthIndex >= 85;
  const isDegraded = healthIndex >= 60 && healthIndex < 85;

  return (
    <div className="space-y-6">
      {/* Top Bar: Live Status & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg border ${
              isHealthy
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : isDegraded
                ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
            }`}
          >
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Telemetria & Auto-Cura Autônoma</h2>
              <Badge
                variant="outline"
                className={`text-xs gap-1.5 font-medium ${
                  isHealthy
                    ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : isDegraded
                    ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
                    : "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full animate-pulse ${
                    isHealthy ? "bg-emerald-500" : isDegraded ? "bg-amber-500" : "bg-rose-500"
                  }`}
                />
                {isHealthy ? "Saudável" : isDegraded ? "Degradado" : "Crítico"} ({healthIndex}%)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monitoramento ativo de latência, taxa de erros, filas WhatsApp e auto-remediação de incidentes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs h-8 ${autoRefresh ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : ""}`}
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Auto-refresh: {autoRefresh ? "10s (Ativo)" : "Desligado"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTelemetry(false)}
            disabled={refreshing}
            className="text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Latência P95 */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Latência de Requisições (P95)
            </CardTitle>
            <Clock className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {snapshot?.kpis.latency.p95 ?? 0} <span className="text-sm font-normal text-muted-foreground">ms</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span>P50: {snapshot?.kpis.latency.p50 ?? 0}ms</span>
              <span>·</span>
              <span>P99: {snapshot?.kpis.latency.p99 ?? 0}ms</span>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Sucesso Operacional */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Taxa de Sucesso Operacional
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {(100 - (snapshot?.kpis.error_rate_pct ?? 0)).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Taxa de Erro: {snapshot?.kpis.error_rate_pct ?? 0}% (últimas 1000 amostras)
            </p>
          </CardContent>
        </Card>

        {/* Ingestão Webhooks Meta */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Vazão de Webhooks Meta
            </CardTitle>
            <Radio className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {snapshot?.kpis.webhook_tps ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">req/s</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Total Hoje: {snapshot?.kpis.total_events_today ?? 0} eventos processados
            </p>
          </CardContent>
        </Card>

        {/* Auto-Remediações Realizadas */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Auto-Curas Executadas
            </CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {snapshot?.kpis.remediations_executed_count ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Memória: {snapshot?.system_resources.memory_percent ?? 0}% ({snapshot?.system_resources.memory_used_mb ?? 0}MB)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies Alert Banner (if any) */}
      {anomalies.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-sm font-semibold">
                Anomalias e Incidentes Operacionais Detectados ({anomalies.length})
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              O motor de telemetria identificou desvios de SLA operacionais. Ações de auto-remediação foram sugeridas abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {anomalies.map((anom) => (
              <div
                key={anom.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-background/80"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">{anom.title}</span>
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                      {anom.rule_id}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{anom.description}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Solução Recomendada: {anom.recommended_remediation}
                  </p>
                </div>
                {anom.auto_remediation_available && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleExecuteAction("reset_circuit_breaker", "Auto-Cura de Incidente")}
                    disabled={actionInProgress !== null}
                    className="text-xs h-8 shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Aplicar Auto-Cura
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Central de Ações de Auto-Cura (Action Bar) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-500" />
                Central de Auto-Cura e Ações Automatizadas
              </CardTitle>
              <CardDescription className="text-xs">
                Acione rotinas de recuperação autônoma com salvaguardas e logs de auditoria integrados.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => handleExecuteAction("unstick_stalled_broadcasts", "Desobstruir Filas de Envio")}
              disabled={actionInProgress !== null}
              className="justify-start h-auto p-3 text-left border-border/70 hover:border-emerald-500/40 hover:bg-emerald-500/5"
            >
              <div className="flex items-start gap-2.5">
                <Layers className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Desobstruir Filas de Envio</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Recupera campanhas travadas e destrava lotes de mensagens estagnados.
                  </p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleExecuteAction("reset_circuit_breaker", "Resetar Circuit Breakers")}
              disabled={actionInProgress !== null}
              className="justify-start h-auto p-3 text-left border-border/70 hover:border-blue-500/40 hover:bg-blue-500/5"
            >
              <div className="flex items-start gap-2.5">
                <Server className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Resetar Circuit Breakers</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Restaura circuitos abertos da Meta API, Webhook e Gateway de Pagamentos.
                  </p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleExecuteAction("purge_ephemeral_cache", "Expurgar Cache Efêmero")}
              disabled={actionInProgress !== null}
              className="justify-start h-auto p-3 text-left border-border/70 hover:border-amber-500/40 hover:bg-amber-500/5"
            >
              <div className="flex items-start gap-2.5">
                <Cpu className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Expurgar Cache & Memória</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Limpa buffers temporários e alivia a pressão de memória heap do Node.js.
                  </p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleExecuteAction("apply_meta_rate_throttle", "Throttle Adaptativo Meta")}
              disabled={actionInProgress !== null}
              className="justify-start h-auto p-3 text-left border-border/70 hover:border-purple-500/40 hover:bg-purple-500/5"
            >
              <div className="flex items-start gap-2.5">
                <Flame className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Throttle Adaptativo Meta</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Injeta espaçamento adaptativo de 150ms para blindar contra bloqueios de envio.
                  </p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleExecuteAction("optimize_database_pools", "Reciclar Pool PostgreSQL")}
              disabled={actionInProgress !== null}
              className="justify-start h-auto p-3 text-left border-border/70 hover:border-cyan-500/40 hover:bg-cyan-500/5"
            >
              <div className="flex items-start gap-2.5">
                <Database className="h-4 w-4 text-cyan-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Reciclar Pool de Conexões</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Testa a latência de round-trip do PostgreSQL e recicla conexões ociosas.
                  </p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleExecuteAction("run_diagnostic_benchmark", "Executar Benchmark Geral")}
              disabled={actionInProgress !== null}
              className="justify-start h-auto p-3 text-left border-border/70 hover:border-emerald-500/40 hover:bg-emerald-500/5"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Benchmark de Saúde Integral</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Mede a latência ponta-a-ponta de todos os microsserviços e APIs.
                  </p>
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sugestões Inteligentes de Melhoria (Smart Recommendations) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Sugestões de Otimização e Melhorias Automatizadas</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Recomendações sintetizadas com base em telemetria real para acelerar requisições, poupar recursos e prevenir incidentes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recommendations.map((rec) => {
              const isApplied = rec.status === "applied";
              return (
                <div
                  key={rec.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    isApplied ? "bg-muted/30 border-muted" : "bg-card hover:border-emerald-500/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold uppercase ${
                            rec.impact === "critical"
                              ? "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-50/30"
                              : rec.impact === "high"
                              ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50/30"
                              : "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-50/30"
                          }`}
                        >
                          Impacto: {rec.impact}
                        </Badge>
                        <h4 className="text-xs font-semibold text-foreground">{rec.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.description}</p>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ganho Estimado: {rec.estimated_gain}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isApplied ? (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30 gap-1 bg-emerald-50/50 dark:bg-emerald-950/20">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aplicado
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApplyRecommendation(rec)}
                          disabled={actionInProgress !== null}
                          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Zap className="h-3 w-3 mr-1.5" />
                          Aplicar Solução Agora
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Auto-Remediações & Auditoria */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Auditoria de Auto-Curas e Intervenções Recentes
          </CardTitle>
          <CardDescription className="text-xs">
            Registro detalhado das remediações aplicadas pelo sistema autônomo ou pelos administradores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {remediations.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Nenhuma remediação executada recentemente. O sistema está operando dentro dos parâmetros ideais.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data/Hora</TableHead>
                    <TableHead className="text-xs">Ação</TableHead>
                    <TableHead className="text-xs">Origem</TableHead>
                    <TableHead className="text-xs">Alvo</TableHead>
                    <TableHead className="text-xs">Motivo</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remediations.map((rem, idx) => (
                    <TableRow key={rem.id || idx}>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {rem.created_at ? new Date(rem.created_at).toLocaleTimeString() : "-"}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {rem.action_type}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {rem.trigger_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rem.target_service}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {rem.reason}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            rem.status === "succeeded"
                              ? "border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                              : rem.status === "running"
                              ? "border-blue-500/30 text-blue-600 bg-blue-50/50"
                              : "border-rose-500/30 text-rose-600"
                          }`}
                        >
                          {rem.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
