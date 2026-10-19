'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Radio,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Send,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Info,
  Trash2,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MetaPhoneInfo {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
}

interface GlobalConfigData {
  configured: boolean;
  phone_number_id: string;
  waba_id: string;
  has_access_token: boolean;
  access_token_masked: string;
  verify_token: string;
  meta_app_id: string;
  has_meta_app_secret: boolean;
  allow_tenant_fallback: boolean;
  status: string;
  phone_info: MetaPhoneInfo | null;
  updated_at?: string;
}

export function AdminGlobalWhatsAppPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Form states
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('wcloudapi_global_verify');
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [allowTenantFallback, setAllowTenantFallback] = useState(true);
  const [syncMasterAccount, setSyncMasterAccount] = useState(true);

  // UI toggles
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Live Status & Phone Info
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [phoneInfo, setPhoneInfo] = useState<MetaPhoneInfo | null>(null);

  // Test Message State
  const [testRecipient, setTestRecipient] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Este é um teste oficial de conexão da plataforma WcloudAPI.');

  const fetchGlobalConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp-config');
      if (!res.ok) throw new Error('Falha ao carregar configurações globais');
      const data: GlobalConfigData = await res.json();

      if (data.configured) {
        setPhoneNumberId(data.phone_number_id || '');
        setWabaId(data.waba_id || '');
        setAccessToken(data.access_token_masked || '');
        setVerifyToken(data.verify_token || 'wcloudapi_global_verify');
        setMetaAppId(data.meta_app_id || '');
        setAllowTenantFallback(data.allow_tenant_fallback ?? true);
        setStatus(data.status === 'connected' ? 'connected' : 'disconnected');
        setPhoneInfo(data.phone_info || null);
      } else {
        setStatus('disconnected');
        setVerifyToken(data.verify_token || 'wcloudapi_global_verify');
      }
    } catch (err: unknown) {
      console.error('[AdminGlobalWhatsAppPanel] Load error:', err);
      toast.error('Erro ao buscar status da conexão global');
      setStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalConfig();
  }, [fetchGlobalConfig]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  const handleGenerateVerifyToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = 'wcloud_';
    for (let i = 0; i < 24; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setVerifyToken(token);
    toast.info('Novo Verify Token gerado. Lembre-se de salvar as configurações!');
  };

  const handleTestConnection = async () => {
    if (!phoneNumberId) {
      toast.error('Informe o Phone Number ID');
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/admin/whatsapp-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          access_token: accessToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao validar com a Meta Cloud API');
      }

      setPhoneInfo(data.phone_info);
      setStatus('connected');
      toast.success(data.message || 'Conexão validada com sucesso na Meta!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na conexão';
      setStatus('disconnected');
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumberId || !wabaId) {
      toast.error('Preencha o Phone Number ID e o WABA ID.');
      return;
    }
    if (!accessToken) {
      toast.error('Insira o Token de Acesso Permanente da Meta.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/whatsapp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          access_token: accessToken,
          verify_token: verifyToken,
          meta_app_id: metaAppId,
          meta_app_secret: metaAppSecret,
          allow_tenant_fallback: allowTenantFallback,
          sync_master_account: syncMasterAccount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao salvar configuração global');
      }

      setStatus('connected');
      if (data.phone_info) setPhoneInfo(data.phone_info);
      setAccessToken('••••••••••••••••');
      toast.success(data.message || 'Conexão Global WhatsApp estabelecida com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testRecipient) {
      toast.error('Informe o número destinatário para teste (ex: +5511999998888).');
      return;
    }

    setSendingTest(true);
    try {
      const res = await fetch('/api/admin/whatsapp-config/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testRecipient,
          message: testMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem de teste');
      }

      toast.success(data.message || 'Mensagem enviada com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha no envio';
      toast.error(msg);
    } finally {
      setSendingTest(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar a conexão WhatsApp global da plataforma?')) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch('/api/admin/whatsapp-config', { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao desconectar');

      setStatus('disconnected');
      setPhoneInfo(null);
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      toast.success('Conexão global desconectada com sucesso.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao desconectar';
      toast.error(msg);
    } finally {
      setDisconnecting(false);
    }
  };

  const webhookCallbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/whatsapp/webhook`
    : 'https://wcloudapi.dev/api/whatsapp/webhook';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Radio className="h-5 w-5 text-emerald-500" />
                  Conexão WhatsApp Global da Plataforma
                </CardTitle>
                {status === 'connected' ? (
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Conectado & Operacional
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-500 border-amber-500/30 gap-1">
                    <XCircle className="h-3.5 w-3.5" />
                    Não Conectado
                  </Badge>
                )}
              </div>
              <CardDescription>
                Gerencie a conexão oficial da Meta WhatsApp Cloud API centralizada para a plataforma WcloudAPI.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing || saving || !phoneNumberId}
                className="gap-2 text-xs"
              >
                {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-amber-500" />}
                Testar Conexão
              </Button>

              {status === 'connected' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Desconectar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {phoneInfo && status === 'connected' && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs">
              <div>
                <p className="text-muted-foreground font-medium">Número Conectado</p>
                <p className="font-semibold text-foreground text-sm mt-0.5">{phoneInfo.display_phone_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Nome Comercial Verificado</p>
                <p className="font-semibold text-foreground text-sm mt-0.5">{phoneInfo.verified_name || 'Configurado na Meta'}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Qualidade da Linha</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <p className="font-semibold text-emerald-500">{phoneInfo.quality_rating || 'HIGH'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Main Credentials Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Credenciais da Meta Cloud API
              </CardTitle>
              <CardDescription>
                Obtenha essas credenciais no portal Meta for Developers (Painel do App &gt; WhatsApp &gt; Configuração da API).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                    <Input
                      id="phoneNumberId"
                      placeholder="Ex: 104829102910291"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value.trim())}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wabaId">WhatsApp Business Account ID (WABA) *</Label>
                    <Input
                      id="wabaId"
                      placeholder="Ex: 294829102910291"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value.trim())}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="accessToken">Token de Acesso Permanente (System User Token) *</Label>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showToken ? 'Ocultar' : 'Exibir'}
                    </button>
                  </div>
                  <Input
                    id="accessToken"
                    type={showToken ? 'text' : 'password'}
                    placeholder="EAAG... (Token Permanente da Meta com escopos de envio)"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value.trim())}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Armazenado no banco com criptografia avançada AES-256-GCM.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="verifyToken">Verify Token (Webhook) *</Label>
                      <button
                        type="button"
                        onClick={handleGenerateVerifyToken}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Gerar Seguro
                      </button>
                    </div>
                    <Input
                      id="verifyToken"
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value.trim())}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metaAppId">Meta App ID (Opcional)</Label>
                    <Input
                      id="metaAppId"
                      placeholder="Ex: 5829102910291"
                      value={metaAppId}
                      onChange={(e) => setMetaAppId(e.target.value.trim())}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="metaAppSecret">Meta App Secret (Para validação HMAC de Webhook)</Label>
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showSecret ? 'Ocultar' : 'Exibir'}
                    </button>
                  </div>
                  <Input
                    id="metaAppSecret"
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Chave secreta obtida em Configurações Básicas do App Meta"
                    value={metaAppSecret}
                    onChange={(e) => setMetaAppSecret(e.target.value.trim())}
                  />
                </div>

                {/* Switches / Scopes */}
                <div className="pt-2 space-y-3 border-t border-border">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Habilitar Fallback Global para Empresas</Label>
                      <p className="text-xs text-muted-foreground">
                        Permite que tenants e operadores que não conectaram um número próprio usem esta conexão global da plataforma.
                      </p>
                    </div>
                    <Switch
                      checked={allowTenantFallback}
                      onCheckedChange={setAllowTenantFallback}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Sincronizar com a Conta Master do Administrador</Label>
                      <p className="text-xs text-muted-foreground">
                        Permite que você use este mesmo número para enviar e receber mensagens no seu Inbox pessoal de administrador.
                      </p>
                    </div>
                    <Switch
                      checked={syncMasterAccount}
                      onCheckedChange={setSyncMasterAccount}
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing || saving || !phoneNumberId}
                  >
                    {testing && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                    Testar Conexão
                  </Button>

                  <Button type="submit" disabled={saving} className="gap-2">
                    {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
                    Salvar e Conectar WhatsApp Global
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Webhook Setup & Live Test Message */}
        <div className="space-y-6">
          {/* Webhook Configuration Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-primary" />
                Configuração do Webhook da Meta
              </CardTitle>
              <CardDescription>
                Cole estes dados no painel da Meta for Developers &gt; WhatsApp &gt; Configuração &gt; Webhook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Callback URL</Label>
                <div className="flex items-center gap-2">
                  <Input value={webhookCallbackUrl} readOnly className="font-mono text-[11px] h-8 bg-muted/50" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5"
                    onClick={() => handleCopy(webhookCallbackUrl, 'URL do Webhook')}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Verify Token</Label>
                <div className="flex items-center gap-2">
                  <Input value={verifyToken} readOnly className="font-mono text-[11px] h-8 bg-muted/50" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5"
                    onClick={() => handleCopy(verifyToken, 'Verify Token')}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="p-2.5 rounded border border-border bg-muted/30 space-y-1 text-[11px] text-muted-foreground">
                <p className="font-semibold text-foreground">Campos a Assinar no Webhook:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><code className="text-primary">messages</code> (obrigatório)</li>
                  <li><code className="text-primary">message_template_status_update</code></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Real-time Message Tester */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-500" />
                Envio de Teste em Tempo Real
              </CardTitle>
              <CardDescription>
                Envie um WhatsApp de teste direto da plataforma para comprovar o funcionamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="testRecipient" className="text-xs">Número Destinatário (com DDI + DDD)</Label>
                <Input
                  id="testRecipient"
                  placeholder="+5511999998888"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value.trim())}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="testMessage" className="text-xs">Mensagem</Label>
                <Input
                  id="testMessage"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <Button
                type="button"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={handleSendTestMessage}
                disabled={sendingTest || status !== 'connected'}
              >
                {sendingTest ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Enviar WhatsApp de Teste
              </Button>

              {status !== 'connected' && (
                <p className="text-[11px] text-amber-500 text-center">
                  Conecte e salve a configuração acima para habilitar o envio de teste.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
