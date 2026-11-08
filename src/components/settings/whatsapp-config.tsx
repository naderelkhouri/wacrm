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
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  Activity,
  Cpu,
  Send,
  Terminal,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  Star,
  Settings2,
  MapPin,
  Flame,
  Globe,
} from 'lucide-react';
import type { MetaWhatsAppHealth } from '@/lib/whatsapp/meta-api';
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
type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

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

  // Form fields
  const [friendlyName, setFriendlyName] = useState('WhatsApp Principal');
  const [color, setColor] = useState('#25D366');
  const [isDefault, setIsDefault] = useState(false);
  const [provider, setProvider] = useState<'meta' | 'uazapi'>('meta');
  const [apiUrl, setApiUrl] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [pin, setPin] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  // Geo-location & Warm-up fields
  const [country, setCountry] = useState('BR');
  const [state, setState] = useState('SP');
  const [city, setCity] = useState('São Paulo');
  const [warmupEnabled, setWarmupEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(30);

  // Connection & registration
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const loadedAccountIdRef = useRef<string | null>(null);
  const selectedInstanceIdRef = useRef<string | null>(null);

  const isRegistered = Boolean(config?.registered_at);
  const lastRegistrationError = config?.last_registration_error ?? null;

  const [verifyingRegistration, setVerifyingRegistration] = useState(false);
  type RegistrationProbe = {
    live: boolean;
    checks: Record<string, boolean | null>;
    errors?: string[];
    last_registration_error?: string | null;
    registered_at?: string | null;
    subscribed_apps_at?: string | null;
  };
  const [registrationProbe, setRegistrationProbe] = useState<RegistrationProbe | null>(null);

  // Health Diagnostics & Webhook Simulator state
  const [healthData, setHealthData] = useState<MetaWhatsAppHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulateText, setSimulateText] = useState('Olá! Esta é uma mensagem de teste do simulador do WACRM.');
  const [simulateStatus, setSimulateStatus] = useState<string | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const fetchHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/whatsapp/health');
      const data = await res.json();
      if (data.health) {
        setHealthData(data.health);
      }
    } catch (err) {
      console.error('Failed to load health:', err);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const handleSimulateWebhook = async () => {
    setSimulating(true);
    setSimulateStatus(null);
    try {
      const res = await fetch('/api/whatsapp/webhook/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          text: simulateText,
          fromPhone: '5511999990000',
          customerName: 'Cliente Simulado',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Evento de Webhook simulado e entregue com sucesso!');
        setSimulateStatus(`Entregue com sucesso! ID: ${data.simulatedMessageId}`);
      } else {
        toast.error(data.error || 'Falha na simulação');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao simular';
      toast.error(msg);
    } finally {
      setSimulating(false);
    }
  };

  const populateFormWithConfig = (c: WhatsAppConfigType) => {
    setConfig(c);
    setSelectedInstanceId(c.id);
    selectedInstanceIdRef.current = c.id;
    setFriendlyName(c.name || 'WhatsApp');
    setColor(c.color || '#25D366');
    setIsDefault(Boolean(c.is_default));
    setProvider(c.provider === 'uazapi' ? 'uazapi' : 'meta');
    setApiUrl(c.api_url || '');
    setInstanceName(c.instance_name || '');
    setPhoneNumberId(c.phone_number_id || '');
    setWabaId(c.waba_id || '');
    setAccessToken(MASKED_TOKEN);
    setVerifyToken('');
    setPin('');
    setTokenEdited(false);
    setRegistrationProbe(null);
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
            setResetReason(
              payload.needs_reset
                ? 'token_corrupted'
                : payload.reason === 'meta_api_error'
                ? 'meta_api_error'
                : null
            );
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
        setProvider('meta');
        setApiUrl('');
        setInstanceName('');
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
        setRegistrationProbe(null);
        setCountry('BR');
        setState('SP');
        setCity('São Paulo');
        setWarmupEnabled(true);
        setDailyLimit(30);

        // Check if global connection is used
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
          setResetReason(
            payload.needs_reset
              ? 'token_corrupted'
              : payload.reason === 'meta_api_error'
              ? 'meta_api_error'
              : null
          );
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
    setProvider('uazapi');
    setApiUrl('');
    setInstanceName('');
    setPhoneNumberId('');
    setWabaId('');
    setAccessToken('');
    setVerifyToken('');
    setPin('');
    setTokenEdited(false);
    setConnectionStatus('unknown');
    setStatusMessage('');
    setRegistrationProbe(null);
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

    if (provider === 'uazapi') {
      if (!apiUrl.trim()) {
        toast.error('A URL da API Uazapi é obrigatória');
        return;
      }
    } else if (!phoneNumberId.trim()) {
      toast.error('Phone Number ID is required');
      return;
    }

    const isNew = selectedInstanceId === 'new' || !config;
    if (isNew && (!accessToken.trim() || !tokenEdited)) {
      toast.error(
        provider === 'uazapi'
          ? 'O Token da Instância Uazapi é obrigatório'
          : 'Access Token is required for initial setup'
      );
      return;
    }

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        name: friendlyName.trim(),
        color: color.trim() || '#25D366',
        is_default: isDefault,
        provider,
        api_url: provider === 'uazapi' ? apiUrl.trim() : null,
        instance_name: provider === 'uazapi' ? instanceName.trim() || null : null,
        phone_number_id: phoneNumberId.trim() || null,
        country: country || 'BR',
        state: state || null,
        city: city.trim() || null,
        warmup_enabled: warmupEnabled,
        daily_message_limit: dailyLimit,
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
        pin: pin.trim() || null,
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
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }

      if (data.registered === false && data.registration_error) {
        toast.error(
          `Salvo, mas a Meta não pôde registrar o número: ${data.registration_error}`,
          { duration: 12000 }
        );
      } else if (data.registration_skipped) {
        toast.success(
          'Credenciais salvas e verificadas. O registro de webhook foi ignorado (sem PIN).',
          { duration: 8000 }
        );
        setPin('');
      } else {
        toast.success(
          data.phone_info?.verified_name
            ? `Conectado — ${data.phone_info.verified_name} agora pode receber e enviar mensagens.`
            : 'WhatsApp conectado com sucesso!'
        );
        setPin('');
      }

      if (accountId) await fetchConfig(accountId, config?.id);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
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
          provider,
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

  async function handleVerifyRegistration() {
    setVerifyingRegistration(true);
    setRegistrationProbe(null);
    try {
      const res = await fetch('/api/whatsapp/config/verify-registration', {
        method: 'GET',
      });
      const data = (await res.json()) as RegistrationProbe;
      setRegistrationProbe(data);
      if (data.live) {
        toast.success('Número totalmente registrado — A Meta está entregando eventos.');
      } else {
        toast.error(
          'Número não está totalmente registrado. Veja o diagnóstico abaixo.',
          { duration: 8000 }
        );
      }
      if (accountId) await fetchConfig(accountId, config?.id);
    } catch (err) {
      console.error('verify-registration failed:', err);
      toast.error('Não foi possível consultar a verificação na Meta.');
    } finally {
      setVerifyingRegistration(false);
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
          title={t('title')}
          description={t('description')}
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted';
  const isCreatingNew = selectedInstanceId === 'new';

  return (
    <section className="animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t('title')}
        description={t('description')}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Main config form */}
        <div className="space-y-6">
          {/* WhatsApp Instances Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-foreground text-base">
                    Contas e Linhas de WhatsApp ({configs.length})
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-xs mt-0.5">
                    Conecte múltiplos números do WhatsApp (Meta Cloud API ou Uazapi) no mesmo negócio.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddNewInstance}
                  className="gap-1.5 bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="size-3.5" />
                  <span>Conectar Outro WhatsApp</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {configs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Nenhuma conta do WhatsApp conectada ainda. Preencha as credenciais abaixo para conectar sua primeira instância.
                </div>
              ) : (
                <div className="space-y-2">
                  {configs.map((c) => {
                    const isSelected = selectedInstanceId === c.id;
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-muted/30 hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="size-3.5 rounded-full shrink-0 ring-2 ring-background"
                            style={{ backgroundColor: c.color || '#25D366' }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground truncate">
                                {c.name || 'WhatsApp'}
                              </span>
                              {c.is_default && (
                                <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  <Star className="size-3 fill-current" />
                                  Padrão
                                </span>
                              )}
                              <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                                {c.provider === 'uazapi' ? 'Uazapi' : 'Meta API'}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                              {c.phone_number_id || c.instance_name || 'Sem identificador'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {!c.is_default && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefault(c.id)}
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                              Tornar Padrão
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleSelectInstance(c)}
                            className="h-7 gap-1 text-xs"
                          >
                            <Settings2 className="size-3" />
                            {isSelected ? 'Editando' : 'Editar'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteInstance(c.id, c.name || 'WhatsApp')}
                            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-950/40"
                            title="Desconectar"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Corrupted-token reset banner */}
          {showResetBanner && (
            <Alert className="bg-amber-950/40 border-amber-600/40">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <AlertTitle className="text-amber-200 mb-1">
                    Token armazenado não pôde ser descriptografado
                  </AlertTitle>
                  <AlertDescription className="text-amber-100/80 text-sm">
                    {statusMessage}
                  </AlertDescription>
                  <Button
                    onClick={handleReset}
                    disabled={resetting}
                    size="sm"
                    className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {resetting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t('resetting')}
                      </>
                    ) : (
                      <>
                        <RotateCcw className="size-4" />
                        {t('resetConfig')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          {/* Connection Status */}
          <Alert className="bg-card border-border">
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <CheckCircle2 className="size-4 text-primary" />
              ) : (
                <XCircle className="size-4 text-red-500" />
              )}
              <AlertTitle className="text-foreground mb-0">
                {connectionStatus === 'connected' ? t('credentialsValid') : t('notConnected')}
              </AlertTitle>
            </div>
            <AlertDescription className="text-muted-foreground">
              {connectionStatus === 'connected'
                ? t('connectedDesc')
                : statusMessage || t('notConnectedDesc')}
            </AlertDescription>
          </Alert>

          {/* Registration Status (Meta only) */}
          {config && provider === 'meta' && (
            <Alert
              className={
                isRegistered
                  ? 'bg-emerald-950/30 border-emerald-700/50'
                  : 'bg-amber-950/30 border-amber-700/50'
              }
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {isRegistered ? (
                    <CheckCircle2 className="size-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="size-4 text-amber-400" />
                  )}
                  <AlertTitle
                    className={
                      'mb-0 ' + (isRegistered ? 'text-emerald-200' : 'text-amber-200')
                    }
                  >
                    {isRegistered ? t('registered') : t('notRegistered')}
                  </AlertTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyRegistration}
                  disabled={verifyingRegistration}
                  className="border-border bg-transparent text-foreground hover:bg-muted h-7"
                >
                  {verifyingRegistration ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Zap className="size-3.5" />
                  )}
                  {t('verifyWithMeta')}
                </Button>
              </div>
              <AlertDescription className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {isRegistered ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: t('subscribedSince', {
                        date: config.registered_at
                          ? new Date(config.registered_at).toLocaleString()
                          : t('unknownDate'),
                      }),
                    }}
                  />
                ) : lastRegistrationError ? (
                  <>
                    {t('lastAttemptFailed')}
                    <span className="text-red-300">
                      &quot;{lastRegistrationError}&quot;
                    </span>
                    . {t('retryHint')}
                  </>
                ) : (
                  <>{t('noRegistrationHint')}</>
                )}
              </AlertDescription>

              {registrationProbe && (
                <div className="mt-3 rounded border border-border bg-card/60 px-3 py-2 space-y-1.5 text-[11px]">
                  <p className="font-medium text-foreground">
                    {t('diagnosticLastRun')}
                    <span className={registrationProbe.live ? 'text-emerald-400' : 'text-amber-400'}>
                      {registrationProbe.live ? t('live') : t('notLive')}
                    </span>
                  </p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {Object.entries(registrationProbe.checks).map(([k, v]) => (
                      <li key={k} className="flex items-center gap-1.5">
                        {v === true ? (
                          <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                        ) : v === false ? (
                          <XCircle className="size-3 text-red-400 shrink-0" />
                        ) : (
                          <span className="size-3 rounded-full border border-border shrink-0" />
                        )}
                        <code className="text-muted-foreground">{k}</code>
                      </li>
                    ))}
                  </ul>
                  {(registrationProbe.errors ?? []).length > 0 && (
                    <ul className="pt-1 space-y-0.5 text-red-300">
                      {registrationProbe.errors?.map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Alert>
          )}

          {/* API Credentials */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">
                {isCreatingNew
                  ? 'Conectar Nova Conta do WhatsApp'
                  : `Configurar Instância: ${friendlyName}`}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Defina o nome da linha, cor e informe as credenciais de acesso (Meta Cloud API ou Uazapi).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Instance Name & Color Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-border">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Nome da Instância / Linha *</Label>
                  <Input
                    placeholder="Ex: Comercial SP, Suporte, Principal"
                    value={friendlyName}
                    onChange={(e) => setFriendlyName(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nome identificador exibido no Inbox e na seleção de canais.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Cor de Identificação</Label>
                  <div className="flex items-center gap-2 pt-1">
                    {COLOR_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setColor(p.value)}
                        className={cn(
                          'size-7 rounded-full transition-transform flex items-center justify-center',
                          color === p.value
                            ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background'
                            : 'opacity-80 hover:opacity-100'
                        )}
                        style={{ backgroundColor: p.value }}
                        title={p.label}
                      >
                        {color === p.value && <Check className="size-3.5 text-white" />}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="size-7 rounded cursor-pointer border-0 bg-transparent ml-1"
                      title="Cor personalizada"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cor exibida na etiqueta e filtro do chat.
                  </p>
                </div>
              </div>

              {/* Default Instance Toggle */}
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="space-y-0.5">
                  <Label className="text-foreground text-sm font-medium">
                    Definir como Linha Principal / Padrão
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Novas conversas sem canal especificado usarão esta conta automaticamente.
                  </p>
                </div>
                <Switch
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
              </div>

              {/* Provider Selector */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Provedor de API do WhatsApp</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProvider('meta')}
                    className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                      provider === 'meta'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-sm">Meta Cloud API (Oficial)</span>
                      {provider === 'meta' && <CheckCircle2 className="size-4 text-primary" />}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      API oficial Graph API da Meta (WABA + Templates aprovados).
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('uazapi')}
                    className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                      provider === 'uazapi'
                        ? 'border-emerald-500 bg-emerald-500/10 text-foreground'
                        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-sm">Uazapi (API WhatsApp Segura)</span>
                      {provider === 'uazapi' && <CheckCircle2 className="size-4 text-emerald-500" />}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      Conexão direta de alta performance via Uazapi (QR Code / Instância).
                    </span>
                  </button>
                </div>
              </div>

              {provider === 'uazapi' ? (
                <>
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
                        <Label className="text-xs text-muted-foreground">Estado (UF / Província)</Label>
                        {country === 'BR' ? (
                          <Select value={state || 'SP'} onValueChange={(val) => val && setState(val)}>
                            <SelectTrigger className="bg-muted border-border text-foreground">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
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
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('phoneNumberId')}</Label>
                    <Input
                      placeholder="e.g. 100234567890123"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('wabaId')}</Label>
                    <Input
                      placeholder="e.g. 100234567890456"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  {provider === 'uazapi' ? 'Token da Instância Uazapi (token / apikey) *' : t('accessToken')}
                </Label>
                <div className="relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder={
                      provider === 'uazapi'
                        ? 'Cole o token da sua instância Uazapi'
                        : t('accessTokenPlaceholder')
                    }
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
                    {t('tokenHidden')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">{t('webhookVerifyToken')}</Label>
                <Input
                  placeholder={t('webhookVerifyTokenPlaceholder')}
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  {provider === 'uazapi'
                    ? 'Opcional — Ao salvar, o WACRM configura automaticamente o Webhook na sua instância Uazapi.'
                    : t('webhookVerifyTokenHint')}
                </p>
              </div>

              {provider === 'meta' && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    {t('twoStepPin')}
                    <span className="ml-1 text-muted-foreground">{t('optional')}</span>
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t('pinPlaceholder')}
                    value={pin}
                    onChange={(e) =>
                      setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground tracking-widest"
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: t.raw('pinHint') }} />
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook URL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">{t('webhookTitle')}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('webhookDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t('webhookUrl')}</Label>
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

          {/* Health & Diagnostic Cards */}
          {config && (
            <>
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="size-4 text-primary" />
                      <CardTitle className="text-foreground text-sm font-semibold">
                        Diagnóstico de Conexão & Qualidade Meta
                      </CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchHealth}
                      disabled={loadingHealth}
                      className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={`size-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>
                  <CardDescription className="text-muted-foreground text-xs">
                    Métricas em tempo real sobre a classificação de qualidade do número e tiers da Graph API.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {healthData ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-md border border-border bg-muted/40 p-2.5">
                        <div className="text-[11px] font-medium text-muted-foreground">Qualidade</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`inline-block size-2 rounded-full ${
                              healthData.phone.quality_rating === 'GREEN'
                                ? 'bg-green-500'
                                : healthData.phone.quality_rating === 'YELLOW'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                          />
                          <span className="text-xs font-semibold text-foreground">
                            {healthData.phone.quality_rating || 'GREEN'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-md border border-border bg-muted/40 p-2.5">
                        <div className="text-[11px] font-medium text-muted-foreground">Limite / Tier</div>
                        <div className="mt-1 text-xs font-semibold text-foreground truncate">
                          {healthData.phone.messaging_limit_tier?.replace('TIER_', '') || '250'}/dia
                        </div>
                      </div>

                      <div className="rounded-md border border-border bg-muted/40 p-2.5">
                        <div className="text-[11px] font-medium text-muted-foreground">Nome Verificado</div>
                        <div className="mt-1 text-xs font-semibold text-foreground truncate">
                          {healthData.phone.verified_name || 'Configurado'}
                        </div>
                      </div>

                      <div className="rounded-md border border-border bg-muted/40 p-2.5">
                        <div className="text-[11px] font-medium text-muted-foreground">Webhook App</div>
                        <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                          {healthData.webhook.isSubscribed ? (
                            <>
                              <CheckCircle2 className="size-3.5 text-green-500" />
                              <span>Ativo</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="size-3.5 text-yellow-500" />
                              <span>Pendente</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                      <span>Clique em &quot;Atualizar&quot; para consultar status de qualidade e limites na Meta.</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchHealth}
                        disabled={loadingHealth}
                        className="h-7 text-xs"
                      >
                        Consultar Meta
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Webhook Event Simulator Card */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="size-4 text-primary" />
                    <CardTitle className="text-foreground text-sm font-semibold">
                      Simulador de Webhook & Automações
                    </CardTitle>
                  </div>
                  <CardDescription className="text-muted-foreground text-xs">
                    Simule o recebimento de mensagens sem gastar créditos da Meta para validar gatilhos, IA e fluxos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-2">
                    <Input
                      placeholder="Digite a mensagem simulada..."
                      value={simulateText}
                      onChange={(e) => setSimulateText(e.target.value)}
                      className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground"
                    />
                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleSimulateWebhook}
                        disabled={simulating || !simulateText}
                        className="gap-1.5 text-xs"
                      >
                        {simulating ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Simulando...
                          </>
                        ) : (
                          <>
                            <Send className="size-3.5" />
                            Disparar Mensagem Simulada
                          </>
                        )}
                      </Button>
                      {simulateStatus && (
                        <span className="text-[11px] font-medium text-green-500 truncate max-w-xs">
                          {simulateStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Model Context Protocol (MCP) Server Card */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="size-4 text-primary" />
                      <CardTitle className="text-foreground text-sm font-semibold">
                        Servidor MCP WACRM (Model Context Protocol)
                      </CardTitle>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      JSON-RPC 2.0
                    </span>
                  </div>
                  <CardDescription className="text-muted-foreground text-xs">
                    Conecte agentes de IA externos (Claude, ChatGPT, Cursor, n8n) para gerenciar contatos, conversas e funis.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp'}
                      className="bg-muted border-border text-muted-foreground font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(`${window.location.origin}/api/mcp`);
                          toast.success('Endpoint MCP copiado!');
                        }
                      }}
                      className="shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Autenticação: Use uma <strong>Chave de API</strong> (gerada na aba Chaves de API) no cabeçalho <code className="text-primary font-mono">Authorization: Bearer wacrm_live_...</code>.
                  </p>
                </CardContent>
              </Card>
            </>
          )}

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
                  {t('saving')}
                </>
              ) : (
                isCreatingNew ? 'Conectar e Salvar WhatsApp' : t('saveConfig')
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || (provider === 'uazapi' ? !apiUrl.trim() : !phoneNumberId.trim())}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {testing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('testing')}
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  {t('testConnection')}
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
                    {t('resetting')}
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
              <CardTitle className="text-foreground text-base">{t('setupInstructions')}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('setupInstructionsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion>
                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                      {t('step1')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step1_1') }} />
                      <li>{t('step1_2')}</li>
                      <li>{t('step1_3')}</li>
                      <li>{t('step1_4')}</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                      {t('step2')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>{t('step2_1')}</li>
                      <li>{t('step2_2')}</li>
                      <li>{t('step2_3')}</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                      {t('step3')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>{t('step3_1')}</li>
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step3_2') }} />
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step3_3') }} />
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step3_4') }} />
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
                      {t('step4')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>{t('step4_1')}</li>
                      <li>{t('step4_2')}</li>
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step4_3') }} />
                      <li dangerouslySetInnerHTML={{ __html: t.raw('step4_4') }} />
                      <li>{t('step4_5')}</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-4 pt-4 border-t border-border">
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  {t('metaDocs')}
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
