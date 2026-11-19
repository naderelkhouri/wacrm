'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  Star,
  Settings2,
  MapPin,
  Flame,
  Globe,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsPanelHead } from './settings-panel-head';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';
import { cn } from '@/lib/utils';
import {
  detectGeoFromPhone,
  SUPPORTED_COUNTRIES,
  BRAZIL_STATES,
} from '@/lib/whatsapp/geo-utils';
import { calculateWarmupStage } from '@/lib/whatsapp/warmup';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | null;

const COLOR_PRESETS = [
  { label: 'Verde', value: '#25D366' },
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Roxo', value: '#8B5CF6' },
  { label: 'Laranja', value: '#F59E0B' },
  { label: 'Rosa', value: '#EC4899' },
  { label: 'Ciano', value: '#06B6D4' },
];

export function WhatsAppConfig() {
  const t = useTranslations('Settings.whatsapp');
  const supabase = createClient();
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Multi-instance state
  const [configs, setConfigs] = useState<WhatsAppConfigType[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);

  // Form fields (Uazapi exclusive)
  const [friendlyName, setFriendlyName] = useState('WhatsApp Principal');
  const [color, setColor] = useState('#25D366');
  const [isDefault, setIsDefault] = useState(false);
  const provider = 'uazapi' as const;
  const [apiUrl, setApiUrl] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  // Geo-location & Warm-up fields
  const [country, setCountry] = useState('BR');
  const [state, setState] = useState('SP');
  const [city, setCity] = useState('São Paulo');
  const [warmupEnabled, setWarmupEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(30);

  // Connection
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const loadedAccountIdRef = useRef<string | null>(null);
  const selectedInstanceIdRef = useRef<string | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const populateFormWithConfig = (c: WhatsAppConfigType) => {
    setConfig(c);
    setSelectedInstanceId(c.id);
    selectedInstanceIdRef.current = c.id;
    setFriendlyName(c.name || 'WhatsApp');
    setColor(c.color || '#25D366');
    setIsDefault(Boolean(c.is_default));
    setApiUrl(c.api_url || '');
    setInstanceName(c.instance_name || '');
    setPhoneNumberId(c.phone_number_id || '');
    setAccessToken(MASKED_TOKEN);
    setVerifyToken(c.verify_token || '');
    setTokenEdited(false);
    setCountry(c.country || 'BR');
    setState(c.state || 'SP');
    setCity(c.city || 'São Paulo');
    setWarmupEnabled(c.warmup_enabled !== undefined ? Boolean(c.warmup_enabled) : true);
    setDailyLimit(c.daily_message_limit || 30);
  };

  const fetchConfig = useCallback(async (acctId: string, targetId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', acctId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load configs:', error);
      }

      const allConfigs = (data as WhatsAppConfigType[]) || [];
      setConfigs(allConfigs);

      let activeItem: WhatsAppConfigType | null = null;
      const desiredId = targetId || selectedInstanceIdRef.current;
      if (desiredId && desiredId !== 'new') {
        activeItem = allConfigs.find((c) => c.id === desiredId) || null;
      }
      if (!activeItem && allConfigs.length > 0) {
        activeItem = allConfigs.find((c) => c.is_default) || allConfigs[0];
      }

      if (activeItem) {
        populateFormWithConfig(activeItem);

        // Check health for active item
        try {
          const res = await fetch(`/api/whatsapp/config?id=${activeItem.id}`);
          const payload = await res.json();
          if (payload.connected) {
            setConnectionStatus('connected');
            setResetReason(null);
            setStatusMessage('');
          } else {
            setConnectionStatus('disconnected');
            setResetReason(payload.needs_reset ? 'token_corrupted' : null);
            setStatusMessage(payload.message || '');
          }
        } catch {
          setConnectionStatus('disconnected');
        }
      } else {
        // No configs exist or user was creating new
        setSelectedInstanceId('new');
        selectedInstanceIdRef.current = 'new';
        setConfig(null);
        setFriendlyName('WhatsApp Principal');
        setColor('#25D366');
        setIsDefault(true);
        setApiUrl('');
        setInstanceName('');
        setPhoneNumberId('');
        setAccessToken('');
        setVerifyToken('');
        setTokenEdited(false);
        setCountry('BR');
        setState('SP');
        setCity('São Paulo');
        setWarmupEnabled(true);
        setDailyLimit(30);

        try {
          const res = await fetch('/api/whatsapp/config');
          const payload = await res.json();
          if (payload.connected && payload.using_global) {
            setConnectionStatus('connected');
            setStatusMessage(payload.message || 'Usando Conexão WhatsApp Global');
          } else {
            setConnectionStatus('disconnected');
            setStatusMessage('');
          }
        } catch {
          setConnectionStatus('disconnected');
        }
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Falha ao carregar configurações do WhatsApp');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      loadedAccountIdRef.current = null;
      setLoading(false);
      return;
    }
    if (loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    fetchConfig(accountId);
  }, [authLoading, profileLoading, user, accountId, fetchConfig]);

  const handleSelectInstance = (inst: WhatsAppConfigType) => {
    populateFormWithConfig(inst);

    fetch(`/api/whatsapp/config?id=${inst.id}`)
      .then((res) => res.json())
      .then((payload) => {
        if (payload.connected) {
          setConnectionStatus('connected');
          setResetReason(null);
          setStatusMessage('');
        } else {
          setConnectionStatus('disconnected');
          setResetReason(payload.needs_reset ? 'token_corrupted' : null);
          setStatusMessage(payload.message || '');
        }
      })
      .catch(() => {
        setConnectionStatus('disconnected');
      });
  };

  const handleAddNewInstance = () => {
    setSelectedInstanceId('new');
    selectedInstanceIdRef.current = 'new';
    setConfig(null);
    setFriendlyName(`WhatsApp ${configs.length + 1}`);
    const nextColor = COLOR_PRESETS[configs.length % COLOR_PRESETS.length].value;
    setColor(nextColor);
    setIsDefault(configs.length === 0);
    setApiUrl('');
    setInstanceName('');
    setPhoneNumberId('');
    setAccessToken('');
    setVerifyToken('');
    setTokenEdited(false);
    setConnectionStatus('unknown');
    setStatusMessage('');
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_default: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao definir como padrão');
      }
      toast.success('Instância definida como padrão com sucesso!');
      if (accountId) await fetchConfig(accountId, id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  };

  const handleDeleteInstance = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente desconectar e remover a instância "${name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/whatsapp/config?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao remover instância');
      }
      toast.success('Instância removida com sucesso!');
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
    }
  };

  async function handleSave() {
    if (!friendlyName.trim()) {
      toast.error('Informe um nome para a instância / conexão');
      return;
    }

    if (!apiUrl.trim()) {
      toast.error('A URL da API Uazapi é obrigatória');
      return;
    }

    const isNew = selectedInstanceId === 'new' || !config;
    if (isNew && (!accessToken.trim() || !tokenEdited)) {
      toast.error('O Token da Instância Uazapi é obrigatório');
      return;
    }

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        name: friendlyName.trim(),
        color: color.trim() || '#25D366',
        is_default: isDefault,
        provider: 'uazapi',
        api_url: apiUrl.trim(),
        instance_name: instanceName.trim() || null,
        phone_number_id: phoneNumberId.trim() || null,
        country: country || 'BR',
        state: state || null,
        city: city.trim() || null,
        warmup_enabled: warmupEnabled,
        daily_message_limit: dailyLimit,
        verify_token: verifyToken.trim() || null,
      };

      if (!isNew && config?.id) {
        payload.id = config.id;
      }

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        payload.access_token = accessToken.trim();
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Falha ao salvar configuração');
        setSaving(false);
        return;
      }

      toast.success(
        data.phone_info?.verified_name
          ? `Conectado — ${data.phone_info.verified_name} agora pode receber e enviar mensagens.`
          : 'Instância Uazapi salva e conectada com sucesso!'
      );

      if (accountId) await fetchConfig(accountId, config?.id);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Falha ao salvar configuração');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'uazapi',
          api_url: apiUrl.trim(),
          instance_name: instanceName.trim() || null,
          phone_number_id: phoneNumberId.trim() || null,
          access_token:
            tokenEdited && accessToken !== MASKED_TOKEN
              ? accessToken.trim()
              : config
              ? undefined
              : accessToken.trim(),
          config_id: config?.id,
        }),
      });

      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        toast.success(
          payload.message ||
            (payload.phone_info?.verified_name
              ? `Conectado a ${payload.phone_info.verified_name}`
              : 'Conexão testada com sucesso!')
        );
      } else {
        setConnectionStatus('disconnected');
        const errMsg = payload.error || payload.message || 'Falha no teste de conexão';
        setStatusMessage(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Falha no teste de conexão. Verifique os dados e tente novamente.');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (!confirm('Isto removerá a configuração do WhatsApp atual. Deseja continuar?')) {
      return;
    }

    try {
      setResetting(true);
      const query = config?.id ? `?id=${config.id}` : '';
      const res = await fetch(`/api/whatsapp/config${query}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Falha ao remover configuração');
        return;
      }

      toast.success('Configuração removida com sucesso.');
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Falha ao remover configuração');
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copiada para a área de transferência');
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Conexão WhatsApp (Uazapi)"
          description="Carregando instâncias do WhatsApp..."
        />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  const isCreatingNew = selectedInstanceId === 'new';

  return (
    <section className="animate-in fade-in-50 space-y-6 duration-200">
      <SettingsPanelHead
        title="Conexão WhatsApp (Uazapi)"
        description="Gerencie suas conexões de WhatsApp via Uazapi. Envie e receba mensagens, áudios e mídias sem restrições de janela de 24h ou aprovação de templates da Meta."
      />

      {/* Multi-Instance Selector / Toolbar */}
      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-emerald-500" />
            <span className="text-sm font-semibold text-foreground">
              Instâncias Conectadas ({configs.length})
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleAddNewInstance}
            className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
          >
            <Plus className="size-3.5" />
            Adicionar Nova Instância
          </Button>
        </div>

        {configs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nenhuma instância cadastrada. Preencha o formulário abaixo para conectar seu primeiro WhatsApp.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {configs.map((c) => {
              const isSelected = selectedInstanceId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectInstance(c)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500'
                      : 'border-border bg-card hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <span
                    className="size-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: c.color || '#25D366' }}
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      {c.name || 'WhatsApp'}
                      {c.is_default && (
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded-full font-bold">
                          PADRÃO
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <span>Uazapi</span>
                      {c.status === 'connected' ? (
                        <span className="text-emerald-400 font-medium">• Conectado</span>
                      ) : (
                        <span className="text-muted-foreground">• Desconectado</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    {!c.is_default && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetDefault(c.id);
                        }}
                        title="Tornar padrão"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                      >
                        <Star className="size-3.5" />
                      </button>
                    )}
                    {configs.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteInstance(c.id, c.name || 'WhatsApp');
                        }}
                        title="Remover instância"
                        className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Connection Status Banner */}
          <Alert
            className={
              connectionStatus === 'connected'
                ? 'bg-emerald-950/30 border-emerald-700/50'
                : 'bg-muted/40 border-border'
            }
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' ? (
                  <CheckCircle2 className="size-4 text-emerald-400" />
                ) : (
                  <XCircle className="size-4 text-muted-foreground" />
                )}
                <AlertTitle
                  className={
                    'mb-0 ' +
                    (connectionStatus === 'connected'
                      ? 'text-emerald-200'
                      : 'text-foreground')
                  }
                >
                  {connectionStatus === 'connected'
                    ? 'WhatsApp Uazapi Conectado'
                    : 'WhatsApp Desconectado'}
                </AlertTitle>
              </div>
            </div>
            <AlertDescription className="text-muted-foreground mt-2 text-xs leading-relaxed">
              {connectionStatus === 'connected'
                ? 'Sua instância Uazapi está autenticada e pronta para enviar e receber mensagens sem limites de janela 24h.'
                : statusMessage || 'Configure os dados da sua instância Uazapi abaixo para conectar o WhatsApp.'}
            </AlertDescription>
          </Alert>

          {/* API Credentials Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">
                {isCreatingNew
                  ? 'Conectar Nova Instância Uazapi'
                  : `Configurar Instância: ${friendlyName}`}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Informe a URL da API e o Token da sua instância Uazapi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Identity & Multi-instance metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Nome da Instância / Canal *</Label>
                  <Input
                    placeholder="Ex: WhatsApp Vendas, Suporte..."
                    value={friendlyName}
                    onChange={(e) => setFriendlyName(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Cor de Identificação</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-12 h-9 p-1 bg-muted border-border cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COLOR_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setColor(p.value)}
                          className={`size-6 rounded-full border border-border flex items-center justify-center transition-transform hover:scale-110 ${
                            color === p.value ? 'ring-2 ring-primary ring-offset-1' : ''
                          }`}
                          style={{ backgroundColor: p.value }}
                          title={p.label}
                        >
                          {color === p.value && <Check className="size-3 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Default Instance Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium text-foreground">Definir como Instância Padrão</Label>
                  <p className="text-xs text-muted-foreground">
                    Novas conversas sem canal especificado usarão esta conta automaticamente.
                  </p>
                </div>
                <Switch
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
              </div>

              {/* Uazapi Server URL */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">URL do Servidor Uazapi *</Label>
                <Input
                  placeholder="Ex: https://free.uazapi.com ou https://api.seudominio.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  URL base do seu servidor Uazapi (sem barra no final).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Nome da Instância (Opcional)</Label>
                  <Input
                    placeholder="Ex: comercial-principal"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center justify-between">
                    <span>Número WhatsApp / ID (Opcional)</span>
                    <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                      <MapPin className="size-3" /> Auto-detecta DDD
                    </span>
                  </Label>
                  <Input
                    placeholder="Ex: 5511999998888 (detectado automaticamente)"
                    value={phoneNumberId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPhoneNumberId(val);
                      if (val.length >= 4) {
                        const geo = detectGeoFromPhone(val);
                        if (geo.country) setCountry(geo.country);
                        if (geo.state) setState(geo.state);
                        if (geo.city) setCity(geo.city);
                      }
                    }}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Localização Regional & Blindagem Geográfica */}
              <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Globe className="size-4 text-emerald-500" />
                    Região da Conta (Blindagem Anti-Ban da Meta)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {country === 'BR' ? '🇧🇷 Brasil (DDD Local)' : '🌐 Internacional'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">País (DDI)</Label>
                    <Select value={country} onValueChange={(val) => val && setCountry(val)}>
                      <SelectTrigger className="bg-muted border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {SUPPORTED_COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="flex items-center gap-1.5">
                              <span>{c.flag}</span>
                              <span>{c.name}</span>
                              <span className="text-xs text-muted-foreground">(+{c.ddi})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Estado (UF)</Label>
                    {country === 'BR' ? (
                      <Select value={state} onValueChange={(val) => val && setState(val)}>
                        <SelectTrigger className="bg-muted border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border max-h-56">
                          {BRAZIL_STATES.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Ex: Florida / Lisboa"
                        value={state || ''}
                        onChange={(e) => setState(e.target.value)}
                        className="bg-muted border-border text-foreground"
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cidade</Label>
                    <Input
                      placeholder="Ex: São Paulo"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="bg-muted border-border text-foreground"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A Meta monitora distâncias geográficas de conexão. Vincular a cidade/estado garante que o Uazapi use rotas adequadas ao DDD da conta.
                </p>
              </div>

              {/* Motor de Aquecimento (Warm-up Engine) */}
              <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Flame className="size-4 text-amber-500" />
                      Modo Aquecimento (Anti-Ban Guard)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Controla a cadência e o volume diário para proteger chips novos contra bloqueios preventivos.
                    </p>
                  </div>
                  <Switch
                    checked={warmupEnabled}
                    onCheckedChange={setWarmupEnabled}
                  />
                </div>

                {warmupEnabled && (
                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">
                        {calculateWarmupStage(config?.warmup_started_at).stageName}
                      </span>
                      <span className="font-semibold text-foreground">
                        Limite Diário: {dailyLimit} msgs/dia
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 items-center">
                      <Input
                        type="number"
                        min="10"
                        max="5000"
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(parseInt(e.target.value, 10) || 30)}
                        className="bg-muted border-border text-foreground text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {calculateWarmupStage(config?.warmup_started_at).recommendations[0]}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Token da Instância */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Token da Instância Uazapi (token / apikey) *
                </Label>
                <div className="relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder="Cole o token da sua instância Uazapi"
                    value={accessToken}
                    onChange={(e) => {
                      setAccessToken(e.target.value);
                      setTokenEdited(true);
                    }}
                    onFocus={() => {
                      if (accessToken === MASKED_TOKEN) {
                        setAccessToken('');
                        setTokenEdited(true);
                      }
                    }}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {config && !tokenEdited && (
                  <p className="text-xs text-muted-foreground">
                    O token está oculto por segurança. Reinsira-o caso queira atualizar as credenciais.
                  </p>
                )}
              </div>

              {/* Verify Token (Opcional) */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Token de Verificação do Webhook (Opcional)</Label>
                <Input
                  placeholder="Token personalizado de verificação"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional — Ao salvar, o WACRM configura automaticamente o Webhook na sua instância Uazapi.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Webhook URL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">URL do Webhook do WACRM</CardTitle>
              <CardDescription className="text-muted-foreground">
                URL de callback configurada automaticamente na sua instância Uazapi para entrega de mensagens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-muted-foreground">URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="bg-muted border-border text-muted-foreground font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyWebhookUrl}
                    className="shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                isCreatingNew ? 'Conectar e Salvar WhatsApp' : 'Salvar Configuração'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !apiUrl.trim()}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {testing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Testar Conexão da API
                </>
              )}
            </Button>
            {config && (
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={resetting}
                className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
              >
                {resetting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Desconectando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" />
                    Desconectar esta Instância
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Setup Instructions Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base">Como Conectar seu WhatsApp via Uazapi</CardTitle>
              <CardDescription className="text-muted-foreground">
                Conexão direta, estável e sem restrições de janela de 24h ou aprovação de templates da Meta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion>
                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">1</span>
                      Acesse sua Instância Uazapi
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm space-y-1.5">
                    <p>
                      Acesse o painel do seu servidor Uazapi e copie a <strong>URL Base da API</strong> (ex: <code className="text-emerald-400 font-mono">https://free.uazapi.com</code> ou seu domínio próprio).
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">2</span>
                      Obtenha o Token da Instância
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm space-y-1.5">
                    <p>
                      Copie a chave de API (<strong>token</strong> ou <strong>apikey</strong>) da sua instância e cole no campo de Token ao lado.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">3</span>
                      Conecte via QR Code no WhatsApp
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm space-y-1.5">
                    <p>
                      Escaneie o QR Code no seu Uazapi com o WhatsApp do seu celular (Aparelhos Conectados).
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">4</span>
                      Webhook Automático
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm space-y-1.5">
                    <p>
                      Ao clicar em <strong>Salvar WhatsApp</strong>, o WACRM configura automaticamente a URL do Webhook na sua instância para receber todas as mensagens, áudios e status em tempo real.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
