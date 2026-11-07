"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Layers,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radio,
  Cpu,
  Globe2,
  HardDrive,
  Trash2,
  PowerOff,
  Power,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UazapiNodeTelemetry } from "@/types";

interface ShardSummary {
  total_nodes: number;
  total_capacity: number;
  total_allocated: number;
  total_connected: number;
  total_remaining: number;
  global_occupancy_pct: number;
}

export function AdminUazapiNodesPanel() {
  const [nodes, setNodes] = useState<UazapiNodeTelemetry[]>([]);
  const [summary, setSummary] = useState<ShardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Node Dialog
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formCapacity, setFormCapacity] = useState("300");
  const [formRegion, setFormRegion] = useState("Falkenstein (Hetzner)");

  const fetchNodes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/uazapi-nodes");
      if (!res.ok) {
        throw new Error("Falha ao carregar dados dos nós");
      }
      const data = await res.json();
      setNodes(data.nodes || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar telemetria de nós Uazapi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNodes();
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) {
      toast.error("Nome e URL da API são obrigatórios");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/uazapi-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          api_url: formUrl.trim(),
          max_capacity: parseInt(formCapacity, 10) || 300,
          region: formRegion.trim(),
          is_accepting_new: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar novo bloco");
      }

      toast.success("Novo bloco de 300 instâncias cadastrado!");
      setOpenNewDialog(false);
      setFormName("");
      setFormUrl("");
      setFormCapacity("300");
      fetchNodes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleAccepting = async (node: UazapiNodeTelemetry) => {
    try {
      const nextVal = !node.is_accepting_new;
      const res = await fetch("/api/admin/uazapi-nodes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: node.id,
          is_accepting_new: nextVal,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha ao alterar status");
      }

      toast.success(
        nextVal
          ? `${node.name} agora está aceitando novos provisionamentos`
          : `${node.name} pausado para novas instâncias`
      );
      fetchNodes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleDeleteNode = async (node: UazapiNodeTelemetry) => {
    if (!confirm(`Deseja realmente remover o nó "${node.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/uazapi-nodes?id=${node.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao remover nó");
      }

      toast.success("Bloco removido com sucesso");
      fetchNodes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    }
  };

  const getCapacityColor = (pct: number) => {
    if (pct >= 90) return "text-rose-500 bg-rose-500/10 border-rose-500/30";
    if (pct >= 70) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
  };

  const getProgressBarColor = (pct: number) => {
    if (pct >= 90) return "bg-rose-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-500" />
              Gestão de Shards & Blocos Uazapi
            </h2>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">
              Blocos de 300 Slots
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Arquitetura de particionamento horizontal para até 300 contas de WhatsApp por nó com
            isolamento de falhas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={() => setOpenNewDialog(true)}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Bloco de 300
          </Button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Total de Blocos</p>
                <p className="text-2xl font-bold text-foreground mt-1">{summary.total_nodes}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Nós de processamento</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Server className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Capacidade Total</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {summary.total_capacity.toLocaleString()}
                </p>
                <p className="text-xs text-emerald-500 mt-0.5 font-medium">
                  {summary.total_remaining} slots livres
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <HardDrive className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Instâncias Alocadas</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {summary.total_allocated}
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    ({summary.total_connected} online)
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Em operação</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Radio className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Ocupação Global</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {summary.global_occupancy_pct}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Limite seguro: 85%</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Shard Nodes Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Nós Ativos de Processamento
        </h3>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Carregando nós...</div>
        ) : nodes.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-border bg-muted/20">
            <p className="text-sm text-muted-foreground">Nenhum bloco cadastrado ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nodes.map((node) => {
              const pct = Number(node.occupancy_pct) || 0;
              return (
                <Card
                  key={node.id}
                  className="border-border bg-card/70 hover:border-border/80 transition-all shadow-sm"
                >
                  <CardHeader className="pb-3 pt-4 px-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-semibold text-foreground">
                            {node.name}
                          </CardTitle>
                          <span
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-semibold border uppercase",
                              getCapacityColor(pct)
                            )}
                          >
                            {pct}% Lotação
                          </span>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground break-all">
                          {node.api_url}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleAccepting(node)}
                          title={
                            node.is_accepting_new
                              ? "Pausar recebimento de novas instâncias"
                              : "Ativar recebimento de novas instâncias"
                          }
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          {node.is_accepting_new ? (
                            <Power className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <PowerOff className="h-4 w-4 text-amber-500" />
                          )}
                        </Button>

                        {node.total_instances === 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteNode(node)}
                            title="Remover bloco vazio"
                            className="h-8 w-8 text-muted-foreground hover:text-rose-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 pb-5 space-y-4">
                    {/* Capacity Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Ocupação do Bloco</span>
                        <span className="font-semibold text-foreground">
                          {node.total_instances} / {node.max_capacity} instâncias
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full transition-all duration-500", getProgressBarColor(pct))}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta info tags */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Globe2 className="h-3.5 w-3.5 text-primary" />
                        <span>{node.region || "Hetzner Cloud"}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-500 font-medium">
                          {node.connected_instances} conectadas
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Cpu className="h-3.5 w-3.5 text-primary" />
                        <span>Vagas restantes:</span>
                        <strong className="text-foreground">{node.remaining_slots}</strong>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 text-muted-foreground">
                        <span>Status:</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            node.is_accepting_new
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-amber-500/10 text-amber-500"
                          )}
                        >
                          {node.is_accepting_new ? "Aceitando contas" : "Pausado"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog: Create New Node */}
      <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
        <DialogContent className="sm:max-w-[460px] border-border bg-card">
          <form onSubmit={handleCreateNode}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-500" />
                Cadastrar Novo Bloco Uazapi
              </DialogTitle>
              <DialogDescription>
                Adicione um novo nó ou VPS dedicada para receber até 300 instâncias do WhatsApp.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="space-y-1.5">
                <Label htmlFor="node-name">Nome do Bloco</Label>
                <Input
                  id="node-name"
                  placeholder="Ex: Bloco 02 - Expansão"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="border-border bg-muted"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="node-url">URL da API Uazapi</Label>
                <Input
                  id="node-url"
                  placeholder="https://uazapi-02.admx.tech"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="border-border bg-muted font-mono text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Endpoint público da VPS com a porta ou domínio apontado.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="node-capacity">Capacidade (Slots)</Label>
                  <Input
                    id="node-capacity"
                    type="number"
                    min="1"
                    max="1000"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    className="border-border bg-muted"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="node-region">Região / Datacenter</Label>
                  <Input
                    id="node-region"
                    placeholder="Ex: Hetzner / Contabo"
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    className="border-border bg-muted"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenNewDialog(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {creating ? "Cadastrando..." : "Confirmar & Ativar Nó"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
