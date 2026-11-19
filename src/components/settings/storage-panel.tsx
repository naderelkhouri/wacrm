'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Clock,
  Trash2,
  AlertCircle,
  FileAudio,
  FileImage,
  FileVideo,
  FileText,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface StorageSettings {
  account_id: string;
  audio_retention_days: number;
  image_retention_days: number;
  video_retention_days: number;
  doc_retention_days: number;
  max_storage_bytes: number;
  auto_cleanup_enabled: boolean;
  persist_in_storage: boolean;
}

interface StorageUsage {
  audio_count: number;
  image_count: number;
  video_count: number;
  doc_count: number;
  total_messages: number;
}

export function StoragePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [settings, setSettings] = useState<StorageSettings | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchStorageData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/account/storage');
      if (!res.ok) throw new Error('Falha ao carregar dados de armazenamento');
      const data = await res.json();
      setSettings(data.settings);
      setUsage(data.usage);
      setIsAdmin(data.isAdmin);
    } catch (err) {
      toast.error('Não foi possível carregar as métricas de armazenamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStorageData();
  }, [fetchStorageData]);

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const res = await fetch('/api/account/storage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Falha ao salvar configurações');
      toast.success('Políticas de retenção salvas com sucesso!');
    } catch (err) {
      toast.error('Erro ao atualizar configurações de armazenamento');
    } finally {
      setSaving(false);
    }
  };

  const handleManualCleanup = async (type: string, days?: number) => {
    const confirmText =
      type === 'all'
        ? 'Deseja executar a limpeza de todas as mídias expiradas conforme a política configurada?'
        : `Deseja remover ${type}s com mais de ${days} dias?`;

    if (!confirm(confirmText)) return;

    try {
      setPurging(true);
      const res = await fetch('/api/account/storage/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao executar limpeza');
      toast.success(data.message || 'Limpeza concluída com sucesso!');
      await fetchStorageData();
    } catch (err) {
      toast.error('Falha ao executar limpeza');
    } finally {
      setPurging(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const audioCount = usage?.audio_count || 0;
  const imageCount = usage?.image_count || 0;
  const videoCount = usage?.video_count || 0;
  const docCount = usage?.doc_count || 0;
  const totalMedia = audioCount + imageCount + videoCount + docCount;

  return (
    <div className="space-y-6">
      {/* Header & Overview */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                Governança de Armazenamento & Mídias
              </CardTitle>
              <CardDescription className="mt-1">
                Monitore o uso de disco e defina regras claras de retenção (TTL) para áudios, imagens, vídeos e documentos.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStorageData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 text-xs font-semibold uppercase">
                <FileAudio className="h-4 w-4 text-emerald-500" />
                Áudios de Voz
              </div>
              <div className="text-2xl font-bold">{audioCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Mensagens PTT</div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 text-xs font-semibold uppercase">
                <FileImage className="h-4 w-4 text-blue-500" />
                Imagens / Fotos
              </div>
              <div className="text-2xl font-bold">{imageCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Anexos visuais</div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 text-xs font-semibold uppercase">
                <FileVideo className="h-4 w-4 text-purple-500" />
                Vídeos
              </div>
              <div className="text-2xl font-bold">{videoCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Vídeos curtos</div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 text-xs font-semibold uppercase">
                <FileText className="h-4 w-4 text-amber-500" />
                Documentos
              </div>
              <div className="text-2xl font-bold">{docCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">PDFs, planilhas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regras de Retenção (TTL) */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Políticas de Retenção Automática (TTL)
          </CardTitle>
          <CardDescription>
            Defina por quanto tempo cada tipo de arquivo ficará disponível antes de ser purgado automaticamente. As mensagens e transcrições continuam registradas no histórico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Áudio */}
            <div className="space-y-1.5 p-3.5 rounded-lg border border-border bg-muted/10">
              <label className="text-sm font-semibold flex items-center justify-between">
                <span>Retenção de Áudios</span>
                <Badge variant="outline" className="text-xs">{settings?.audio_retention_days === 0 ? 'Vitalício' : `${settings?.audio_retention_days} dias`}</Badge>
              </label>
              <select
                disabled={!isAdmin}
                value={settings?.audio_retention_days ?? 60}
                onChange={(e) => setSettings(s => s ? { ...s, audio_retention_days: Number(e.target.value) } : null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="15">15 dias</option>
                <option value="30">30 dias</option>
                <option value="60">60 dias (Recomendado)</option>
                <option value="90">90 dias</option>
                <option value="180">180 dias</option>
                <option value="0">Nunca expirar (Vitalício)</option>
              </select>
            </div>

            {/* Imagens */}
            <div className="space-y-1.5 p-3.5 rounded-lg border border-border bg-muted/10">
              <label className="text-sm font-semibold flex items-center justify-between">
                <span>Retenção de Imagens</span>
                <Badge variant="outline" className="text-xs">{settings?.image_retention_days === 0 ? 'Vitalício' : `${settings?.image_retention_days} dias`}</Badge>
              </label>
              <select
                disabled={!isAdmin}
                value={settings?.image_retention_days ?? 90}
                onChange={(e) => setSettings(s => s ? { ...s, image_retention_days: Number(e.target.value) } : null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="30">30 dias</option>
                <option value="60">60 dias</option>
                <option value="90">90 dias (Recomendado)</option>
                <option value="180">180 dias</option>
                <option value="365">1 ano</option>
                <option value="0">Nunca expirar (Vitalício)</option>
              </select>
            </div>

            {/* Vídeos */}
            <div className="space-y-1.5 p-3.5 rounded-lg border border-border bg-muted/10">
              <label className="text-sm font-semibold flex items-center justify-between">
                <span>Retenção de Vídeos</span>
                <Badge variant="outline" className="text-xs">{settings?.video_retention_days === 0 ? 'Vitalício' : `${settings?.video_retention_days} dias`}</Badge>
              </label>
              <select
                disabled={!isAdmin}
                value={settings?.video_retention_days ?? 30}
                onChange={(e) => setSettings(s => s ? { ...s, video_retention_days: Number(e.target.value) } : null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="7">7 dias</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias (Recomendado)</option>
                <option value="60">60 dias</option>
                <option value="0">Nunca expirar (Vitalício)</option>
              </select>
            </div>

            {/* Documentos */}
            <div className="space-y-1.5 p-3.5 rounded-lg border border-border bg-muted/10">
              <label className="text-sm font-semibold flex items-center justify-between">
                <span>Retenção de Documentos</span>
                <Badge variant="outline" className="text-xs">{settings?.doc_retention_days === 0 ? 'Vitalício' : `${settings?.doc_retention_days} dias`}</Badge>
              </label>
              <select
                disabled={!isAdmin}
                value={settings?.doc_retention_days ?? 365}
                onChange={(e) => setSettings(s => s ? { ...s, doc_retention_days: Number(e.target.value) } : null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="90">90 dias</option>
                <option value="180">180 dias</option>
                <option value="365">1 ano (Recomendado para contratos/boletos)</option>
                <option value="730">2 anos</option>
                <option value="0">Nunca expirar (Vitalício)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Rotina automática de expiração e limpeza ativa.</span>
            </div>
            {isAdmin && (
              <Button onClick={handleSaveSettings} disabled={saving} size="sm">
                {saving ? 'Salvando...' : 'Salvar Políticas'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ações Manuais de Limpeza */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Ações Rápidas de Limpeza de Disco
          </CardTitle>
          <CardDescription>
            Libere espaço imediatamente excluindo mídias antigas em lote sem afetar o histórico de mensagens escritas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={purging || !isAdmin}
              onClick={() => handleManualCleanup('audio', 60)}
              className="gap-2"
            >
              <FileAudio className="h-4 w-4" />
              Limpar Áudios &gt; 60 dias
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={purging || !isAdmin}
              onClick={() => handleManualCleanup('video', 30)}
              className="gap-2"
            >
              <FileVideo className="h-4 w-4" />
              Limpar Vídeos &gt; 30 dias
            </Button>

            <Button
              variant="destructive"
              size="sm"
              disabled={purging || !isAdmin}
              onClick={() => handleManualCleanup('all')}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Executar Purga Conforme Regras
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
