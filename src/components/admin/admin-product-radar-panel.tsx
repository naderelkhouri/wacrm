'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  BarChart3,
  Bug,
  Sparkles,
  Rocket,
  Star,
  Plus,
  Download,
  RefreshCw,
  Smartphone,
  Monitor,
  Globe,
  Clock,
  CheckCircle2,
  Trash2,
  Save,
  Layers,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface UsageKpis {
  today: number;
  last7d: number;
  last30d: number;
  total: number;
  mobilePct: number;
}

interface HistogramDay {
  date: string;
  label: string;
  count: number;
  isPeak: boolean;
}

interface ModuleRank {
  path: string;
  module_name: string;
  count: number;
  pct: number;
}

interface RecentView {
  id: string;
  path: string;
  module_name: string;
  referrer: string | null;
  device: string;
  browser: string | null;
  city: string | null;
  account_name: string | null;
  created_at: string;
}

export interface ProductBacklogItem {
  id: string;
  type: 'bug' | 'melhoria' | 'oportunidade';
  source: 'manual' | 'auto_detector' | 'usage_heuristic' | 'auto_heal';
  title: string;
  description: string;
  module_path: string;
  status: 'novo' | 'analise' | 'desenvolvimento' | 'concluido' | 'arquivado';
  rating: number;
  notes: string;
  occurrence_count: number;
  last_seen_at: string;
  created_at: string;
}

const STATUS_META: Record<
  ProductBacklogItem['status'],
  { label: string; badgeClass: string }
> = {
  novo: {
    label: 'Novo',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  analise: {
    label: 'Em Análise',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  desenvolvimento: {
    label: 'Em Desenvolvimento',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  concluido: {
    label: 'Concluído',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  arquivado: {
    label: 'Arquivado',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
};

const TYPE_META: Record<
  ProductBacklogItem['type'],
  { label: string; icon: typeof Bug; badgeClass: string }
> = {
  bug: {
    label: 'Bug',
    icon: Bug,
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  melhoria: {
    label: 'Melhoria UX/UI',
    icon: Sparkles,
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  oportunidade: {
    label: 'Oportunidade IA',
    icon: Rocket,
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
};

const SOURCE_LABELS: Record<ProductBacklogItem['source'], string> = {
  manual: 'SuperAdmin',
  auto_detector: 'Auto-Detector Silencioso',
  usage_heuristic: 'Heurística de Uso',
  auto_heal: 'Auto-Heal',
};

const MODULE_OPTIONS = [
  { value: '/inbox', label: 'Conversas (/inbox)' },
  { value: '/dashboard', label: 'Painel Principal (/dashboard)' },
  { value: '/contacts', label: 'Contatos (/contacts)' },
  { value: '/pipelines', label: 'Funis de Vendas (/pipelines)' },
  { value: '/broadcasts', label: 'Transmissões (/broadcasts)' },
  { value: '/automations', label: 'Automações (/automations)' },
  { value: '/flows', label: 'Fluxos (/flows)' },
  { value: '/agents', label: 'Agentes de IA (/agents)' },
  { value: '/settings', label: 'Configurações (/settings)' },
  { value: '/admin', label: 'Área Master (/admin)' },
];

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Agora mesmo';
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Há ${days}d`;
}

export function AdminProductRadarPanel() {
  const [activeView, setActiveView] = useState<'backlog' | 'usage'>('backlog');
  const [loading, setLoading] = useState(true);

  // Usage state
  const [kpis, setKpis] = useState<UsageKpis>({
    today: 0,
    last7d: 0,
    last30d: 0,
    total: 0,
    mobilePct: 0,
  });
  const [histogram, setHistogram] = useState<HistogramDay[]>([]);
  const [topModules, setTopModules] = useState<ModuleRank[]>([]);
  const [devices, setDevices] = useState<{ device: string; count: number; pct: number }[]>([]);
  const [browsers, setBrowsers] = useState<{ browser: string; count: number; pct: number }[]>([]);
  const [cities, setCities] = useState<{ city: string; count: number; pct: number }[]>([]);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);

  // Backlog state
  const [backlog, setBacklog] = useState<ProductBacklogItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [starFilter, setStarFilter] = useState<string>('all');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newType, setNewType] = useState<'bug' | 'melhoria' | 'oportunidade'>('melhoria');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newModule, setNewModule] = useState('/inbox');
  const [newRating, setNewRating] = useState(5);
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchRadar = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/product-radar', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar radar de uso e melhorias.');
      const data = await res.json();

      if (data.usage) {
        setKpis(data.usage.kpis);
        setHistogram(data.usage.dailyHistogram || []);
        setTopModules(data.usage.topModules || []);
        setDevices(data.usage.devices || []);
        setBrowsers(data.usage.browsers || []);
        setCities(data.usage.cities || []);
        setRecentViews(data.usage.recentViews || []);
      }

      if (Array.isArray(data.backlog)) {
        setBacklog(data.backlog);
        const drafts: Record<string, string> = {};
        data.backlog.forEach((item: ProductBacklogItem) => {
          drafts[item.id] = item.notes || '';
        });
        setNotesDraft(drafts);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados de uso e melhorias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRadar();
  }, [fetchRadar]);

  // Quick update rating (0-5 stars)
  const handleUpdateRating = async (id: string, rating: number) => {
    setBacklog((prev) => prev.map((it) => (it.id === id ? { ...it, rating } : it)));
    try {
      const res = await fetch('/api/admin/product-radar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, rating }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Prioridade atualizada para ${rating}★`);
    } catch {
      toast.error('Falha ao atualizar prioridade.');
      fetchRadar();
    }
  };

  // Quick update status (5-stage funnel)
  const handleUpdateStatus = async (id: string, status: ProductBacklogItem['status']) => {
    setBacklog((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)));
    try {
      const res = await fetch('/api/admin/product-radar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Fase alterada para ${STATUS_META[status].label}`);
    } catch {
      toast.error('Falha ao atualizar status.');
      fetchRadar();
    }
  };

  // Save internal notes
  const handleSaveNotes = async (id: string) => {
    const notes = notesDraft[id] ?? '';
    setSavingNoteId(id);
    try {
      const res = await fetch('/api/admin/product-radar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notes }),
      });
      if (!res.ok) throw new Error();
      setBacklog((prev) => prev.map((it) => (it.id === id ? { ...it, notes } : it)));
      toast.success('Anotações técnicas salvas.');
    } catch {
      toast.error('Erro ao salvar anotações.');
    } finally {
      setSavingNoteId(null);
    }
  };

  // Delete item
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/product-radar?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      setBacklog((prev) => prev.filter((it) => it.id !== id));
      toast.success('Registro removido.');
    } catch {
      toast.error('Erro ao remover registro.');
    }
  };

  // Create new Bug or Improvement
  const handleCreateItem = async () => {
    if (!newTitle.trim()) {
      toast.error('Informe um título para o registro.');
      return;
    }
    try {
      setCreating(true);
      const res = await fetch('/api/admin/product-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newType,
          source: 'manual',
          title: newTitle.trim(),
          description: newDesc.trim(),
          module_path: newModule,
          rating: newRating,
          notes: newNotes.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      const { item } = await res.json();
      setBacklog((prev) => [item, ...prev]);
      setNotesDraft((prev) => ({ ...prev, [item.id]: item.notes || '' }));
      setCreateOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewNotes('');
      toast.success(
        newType === 'bug'
          ? 'Bug registrado com sucesso no radar!'
          : 'Sugestão de melhoria registrada com sucesso!',
      );
    } catch {
      toast.error('Erro ao criar registro.');
    } finally {
      setCreating(false);
    }
  };

  // Export CSV with UTF-8 BOM (\uFEFF) for Excel compatibility
  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Tipo',
      'Origem',
      'Prioridade (Estrelas)',
      'Status',
      'Modulo',
      'Titulo',
      'Descricao',
      'Notas Tecnicas',
      'Ocorrencias',
      'Criado Em',
    ];
    const escapeCsv = (val: unknown) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };
    const rows = filteredBacklog.map((it) => [
      it.id,
      TYPE_META[it.type]?.label || it.type,
      SOURCE_LABELS[it.source] || it.source,
      `${it.rating} estrelas`,
      STATUS_META[it.status]?.label || it.status,
      it.module_path,
      it.title,
      it.description,
      notesDraft[it.id] ?? it.notes,
      it.occurrence_count,
      new Date(it.created_at).toLocaleString('pt-BR'),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(';'), ...rows.map((r) => r.map(escapeCsv).join(';'))].join(
        '\r\n',
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wcloudapi-radar-melhorias-bugs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado com codificação UTF-8 para Excel!');
  };

  // Filtered backlog
  const filteredBacklog = backlog.filter((it) => {
    if (typeFilter !== 'all' && it.type !== typeFilter) return false;
    if (statusFilter !== 'all' && it.status !== statusFilter) return false;
    if (starFilter === '5' && it.rating !== 5) return false;
    if (starFilter === '4+' && it.rating < 4) return false;
    return true;
  });

  // Funnel KPI counts
  const countNovo = backlog.filter((i) => i.status === 'novo').length;
  const countAnalise = backlog.filter((i) => i.status === 'analise').length;
  const countDev = backlog.filter((i) => i.status === 'desenvolvimento').length;
  const countConcluido = backlog.filter((i) => i.status === 'concluido').length;
  const countBugs = backlog.filter((i) => i.type === 'bug' && i.status !== 'concluido').length;

  const maxHistCount = Math.max(1, ...histogram.map((d) => d.count));

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Switcher Bar + Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setActiveView('backlog')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap min-h-[40px]',
              activeView === 'backlog'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Sparkles className="size-4" />
            <span>Radar de Bugs & Melhorias</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {backlog.filter((i) => i.status !== 'arquivado').length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('usage')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap min-h-[40px]',
              activeView === 'usage'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <BarChart3 className="size-4" />
            <span>Telemetria de Uso (LGPD)</span>
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setNewType('melhoria');
              setCreateOpen(true);
            }}
            className="gap-1.5 bg-amber-500 text-black hover:bg-amber-400 font-semibold text-xs h-9"
          >
            <Plus className="size-4" />
            Registrar Bug / Melhoria
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="gap-1.5 text-xs h-9"
          >
            <Download className="size-3.5" />
            Exportar CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchRadar}
            className="h-9 px-2.5"
            title="Atualizar dados"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* =========================================================
          VIEW 1: RADAR DE BUGS, MELHORIAS & OPORTUNIDADES (0-5★)
         ========================================================= */}
      {activeView === 'backlog' && (
        <div className="space-y-5">
          {/* 5 Funnel KPIs */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground font-medium">Novos / Triagem</div>
                <div className="text-2xl font-bold text-amber-400 mt-1">{countNovo}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Aguardando priorização</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground font-medium">Em Análise</div>
                <div className="text-2xl font-bold text-blue-400 mt-1">{countAnalise}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Escopo validado</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground font-medium">Em Desenvolvimento</div>
                <div className="text-2xl font-bold text-purple-400 mt-1">{countDev}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Em sprint ativa</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground font-medium">Concluídos</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">{countConcluido}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Publicados em produção</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card col-span-2 sm:col-span-1">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground font-medium">Bugs em Aberto</div>
                <div className="text-2xl font-bold text-red-400 mt-1">{countBugs}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Manuais + Auto-detectados</div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
                <Filter className="size-3.5" /> Tipo:
              </span>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'bug', label: '🐛 Bugs' },
                { id: 'melhoria', label: '✨ Melhorias' },
                { id: 'oportunidade', label: '🚀 Oportunidades' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                    typeFilter === tab.id
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Star filter */}
              <Select value={starFilter} onValueChange={(v) => setStarFilter(v ?? 'all')}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Estrelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas (0 a 5★)</SelectItem>
                  <SelectItem value="5">5★ Crítico</SelectItem>
                  <SelectItem value="4+">4★+ Forte</SelectItem>
                </SelectContent>
              </Select>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Fase do Funil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Fases</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="analise">Em Análise</SelectItem>
                  <SelectItem value="desenvolvimento">Em Desenvolvimento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Backlog Cards */}
          {filteredBacklog.length === 0 ? (
            <Card className="border-border bg-card p-8 text-center text-muted-foreground">
              <Sparkles className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum registro encontrado para os filtros selecionados.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredBacklog.map((item) => {
                const typeInfo = TYPE_META[item.type] || TYPE_META.melhoria;
                const statusInfo = STATUS_META[item.status] || STATUS_META.novo;
                const TypeIcon = typeInfo.icon;

                return (
                  <Card
                    key={item.id}
                    className="border-border bg-card transition-all hover:border-border/80"
                  >
                    <CardContent className="p-4 sm:p-5 space-y-4">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={cn('gap-1 text-[11px]', typeInfo.badgeClass)}>
                              <TypeIcon className="size-3" />
                              {typeInfo.label}
                            </Badge>

                            <Badge variant="outline" className={cn('text-[11px]', statusInfo.badgeClass)}>
                              {statusInfo.label}
                            </Badge>

                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {item.module_path}
                            </Badge>

                            <span className="text-[11px] text-muted-foreground">
                              Origem: <strong>{SOURCE_LABELS[item.source] || item.source}</strong>
                            </span>

                            {item.occurrence_count > 1 && (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                                🔥 {item.occurrence_count}x detectado
                              </Badge>
                            )}
                          </div>

                          <h4 className="text-sm sm:text-base font-semibold text-foreground">
                            {item.title}
                          </h4>

                          {item.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Right Controls: 0-5★ Star Rating + Funnel Status Select + Delete */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 self-start">
                          {/* 0-5★ Star Triage */}
                          <div
                            className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 px-2 py-1"
                            title="Prioridade de 1 a 5 estrelas"
                          >
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleUpdateRating(item.id, star)}
                                className="p-1 transition-transform hover:scale-110"
                              >
                                <Star
                                  className={cn(
                                    'size-4',
                                    star <= item.rating
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-muted-foreground/40',
                                  )}
                                />
                              </button>
                            ))}
                          </div>

                          {/* Funnel Stage Selector */}
                          <Select
                            value={item.status}
                            onValueChange={(val) => {
                              if (val) handleUpdateStatus(item.id, val as ProductBacklogItem['status']);
                            }}
                          >
                            <SelectTrigger className="w-40 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="novo">Novo</SelectItem>
                              <SelectItem value="analise">Em Análise</SelectItem>
                              <SelectItem value="desenvolvimento">Em Desenvolvimento</SelectItem>
                              <SelectItem value="concluido">Concluído</SelectItem>
                              <SelectItem value="arquivado">Arquivado</SelectItem>
                            </SelectContent>
                          </Select>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Remover item"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>

                      {/* Persistent Technical Notes */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-border/60">
                        <Input
                          value={notesDraft[item.id] ?? ''}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          placeholder="Anotações técnicas, passos para reproduzir ou critérios de aceite..."
                          className="text-xs h-8 flex-1 bg-muted/20"
                        />
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(item.last_seen_at || item.created_at)}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveNotes(item.id)}
                            disabled={savingNoteId === item.id || notesDraft[item.id] === item.notes}
                            className="h-8 text-xs gap-1.5 shrink-0"
                          >
                            <Save className="size-3.5" />
                            {savingNoteId === item.id ? 'Salvando...' : 'Salvar Nota'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          VIEW 2: TELEMETRIA DE USO (100% LGPD-COMPLIANT)
         ========================================================= */}
      {activeView === 'usage' && (
        <div className="space-y-5">
          {/* 5 Usage KPIs */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Acessos Hoje (24h)</span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">{kpis.today}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Sessões ativas no dia</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground font-medium">Últimos 7 Dias</div>
                <div className="text-2xl font-bold text-foreground mt-1">{kpis.last7d}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Navegações semanais</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground font-medium">Últimos 30 Dias</div>
                <div className="text-2xl font-bold text-foreground mt-1">{kpis.last30d}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Volume mensal</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground font-medium">Total Acumulado</div>
                <div className="text-2xl font-bold text-foreground mt-1">{kpis.total}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Histórico global</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card col-span-2 sm:col-span-1">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground font-medium">% Uso Mobile</div>
                <div className="text-2xl font-bold text-amber-400 mt-1">{kpis.mobilePct}%</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {100 - kpis.mobilePct}% Desktop
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 14-Day Continuous Daily Histogram */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Frequência de Uso nos Últimos 14 Dias
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Rastreamento anônimo LGPD sem cookies · Pico destacado em âmbar
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                  Pico: {maxHistCount} acessos/dia
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-14 gap-1.5 sm:gap-2 items-end h-40 pt-4 px-1">
                {histogram.map((day) => {
                  const heightPct =
                    day.count === 0 ? 4 : Math.max(12, Math.round((day.count / maxHistCount) * 100));
                  return (
                    <div
                      key={day.date}
                      className="flex flex-col items-center justify-end h-full group"
                    >
                      <span className="text-[10px] font-mono text-muted-foreground mb-1 opacity-80 group-hover:opacity-100 group-hover:text-foreground">
                        {day.count}
                      </span>
                      <div className="w-full flex items-end justify-center h-28 bg-muted/20 rounded-t-md overflow-hidden">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={cn(
                            'w-full rounded-t-md transition-all duration-300',
                            day.isPeak
                              ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                              : day.count > 0
                                ? 'bg-emerald-500/75 group-hover:bg-emerald-400'
                                : 'bg-border/40',
                          )}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Segmented Rankings (Modules, Devices, Recent Feed) */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top Modules Ranking + Quick Suggest Improvement */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="size-4 text-emerald-400" />
                  Módulos Mais Usados pelos Clientes
                </CardTitle>
                <CardDescription className="text-xs">
                  Identifique onde os usuários passam mais tempo ou módulos com baixa adoção
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topModules.map((mod) => (
                  <div key={mod.path} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-foreground truncate">
                          {mod.module_name}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {mod.path}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs text-muted-foreground">
                          {mod.count} ({mod.pct}%)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewModule(mod.path);
                            setNewType('melhoria');
                            setCreateOpen(true);
                          }}
                          className="text-[10px] text-amber-400 hover:underline font-medium"
                        >
                          + Melhoria
                        </button>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.max(4, mod.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Devices, Browsers & Cities */}
            <div className="space-y-4">
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Monitor className="size-4 text-blue-400" />
                    Dispositivos & Navegadores
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                      Dispositivos
                    </div>
                    {devices.map((d) => (
                      <div key={d.device} className="flex items-center justify-between">
                        <span className="capitalize flex items-center gap-1.5">
                          {d.device === 'mobile' ? (
                            <Smartphone className="size-3.5 text-amber-400" />
                          ) : (
                            <Monitor className="size-3.5 text-emerald-400" />
                          )}
                          {d.device}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {d.count} ({d.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                      Navegadores
                    </div>
                    {browsers.map((b) => (
                      <div key={b.browser} className="flex items-center justify-between">
                        <span>{b.browser}</span>
                        <span className="font-mono text-muted-foreground">
                          {b.count} ({b.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="size-4 text-amber-400" />
                    Principais Cidades (Edge Geo · Sem IP)
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {cities.map((c) => (
                    <div
                      key={c.city}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-2.5 py-1.5"
                    >
                      <span className="truncate font-medium">{c.city}</span>
                      <span className="font-mono text-[11px] text-muted-foreground ml-2">
                        {c.count}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Real-time Recent Access Feed */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="size-4 text-emerald-400" />
                Últimos Acessos em Tempo Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border text-xs">
                {recentViews.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {v.path}
                      </Badge>
                      <span className="font-semibold text-foreground">{v.module_name}</span>
                      {v.account_name && (
                        <span className="text-muted-foreground">· {v.account_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>
                        {v.device} · {v.browser}
                      </span>
                      {v.city && <span>📍 {v.city}</span>}
                      <span className="font-mono text-[11px]">
                        {formatRelativeTime(v.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog: Create Bug / Improvement */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar no Radar de Produto</DialogTitle>
            <DialogDescription>
              Cadastre um bug percebido, uma sugestão de melhoria UX/UI ou uma oportunidade de
              evolução da plataforma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={newType}
                  onValueChange={(v) => {
                    if (v === 'bug' || v === 'melhoria' || v === 'oportunidade') setNewType(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="melhoria">✨ Melhoria UX/UI</SelectItem>
                    <SelectItem value="bug">🐛 Bug / Erro</SelectItem>
                    <SelectItem value="oportunidade">🚀 Oportunidade IA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Módulo do Sistema</Label>
                <Select value={newModule} onValueChange={(v) => v && setNewModule(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULE_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                placeholder="Ex: Adicionar filtro por etiqueta no módulo de Transmissões"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição / Contexto</Label>
              <Input
                placeholder="Detalhes do comportamento observado ou benefício esperado..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridade (Estrelas)</Label>
                <div className="flex items-center gap-1 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={cn(
                          'size-5',
                          star <= newRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/40',
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Nota Técnica Inicial</Label>
                <Input
                  placeholder="Ex: Priorizar na próxima sprint"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateItem}
              disabled={creating}
              className="bg-amber-500 text-black hover:bg-amber-400 font-semibold"
            >
              {creating ? 'Salvando...' : 'Salvar no Radar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
