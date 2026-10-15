'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  Users,
  MessageSquare,
  Sparkles,
  Loader2,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  interval: string;
  max_members: number;
  max_whatsapp_numbers: number;
  monthly_messages_quota: number;
  monthly_ai_tokens_quota: number;
  features: string[];
}

interface AccountSubscription {
  id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  payment_method?: string;
  current_period_end: string;
  plan?: SubscriptionPlan;
}

interface BillingData {
  subscription: AccountSubscription | null;
  plans: SubscriptionPlan[];
  usage: {
    members_count: number;
    whatsapp_numbers_count: number;
  };
  is_owner: boolean;
}

interface PixCheckoutResult {
  order_id: string;
  plan: { id: string; name: string; price_cents: number };
  pix: {
    qr_code_text: string;
    qr_code_image_url: string;
    expiration_date?: string;
  };
}

export function BillingPanel() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [pixResult, setPixResult] = useState<PixCheckoutResult | null>(null);
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [copiedPix, setCopiedPix] = useState(false);

  const fetchBilling = async () => {
    try {
      const res = await fetch('/api/billing/subscription');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      toast.error('Erro ao carregar dados de assinatura.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  // Polling for subscription activation when checkout modal is open
  useEffect(() => {
    if (!checkoutModalOpen || !pixResult) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/billing/subscription');
        if (res.ok) {
          const updated: BillingData = await res.json();
          if (
            updated.subscription?.status === 'active' &&
            updated.subscription.plan_id === pixResult.plan.id
          ) {
            setData(updated);
            setPixResult(null);
            setCheckoutModalOpen(false);
            toast.success('🎉 Pagamento confirmado via PagBank! Sua assinatura está ativa.');
          }
        }
      } catch {
        // Silent polling failure
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [checkoutModalOpen, pixResult]);

  const handleOpenCheckout = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setPixResult(null);
    setCheckoutModalOpen(true);
  };

  const handleGeneratePix = async () => {
    if (!selectedPlan) return;
    setSubmittingCheckout(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan.id,
          customerTaxId: taxId || undefined,
          customerPhone: phone || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao gerar cobrança no PagBank');
      }

      setPixResult(json);
      toast.success('QR Code Pix gerado com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar checkout.';
      toast.error(msg);
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixResult?.pix.qr_code_text) return;
    navigator.clipboard.writeText(pixResult.pix.qr_code_text);
    setCopiedPix(true);
    toast.success('Chave Pix copiada para a área de transferência!');
    setTimeout(() => setCopiedPix(false), 3000);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const currentSub = data?.subscription;
  const currentPlanId = currentSub?.plan_id || 'starter';
  const statusBadgeVariant =
    currentSub?.status === 'active'
      ? 'default'
      : currentSub?.status === 'trialing'
      ? 'secondary'
      : 'destructive';

  const statusLabel =
    currentSub?.status === 'active'
      ? 'Ativa'
      : currentSub?.status === 'trialing'
      ? 'Período de Testes'
      : currentSub?.status === 'past_due'
      ? 'Pagamento Pendente'
      : 'Inativa';

  const formatBRL = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

  return (
    <div className="space-y-6">
      {/* 1. Header & Current Subscription Status */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Faturamento & Assinatura
              </CardTitle>
              <CardDescription>
                Gerencie o plano da sua empresa, limites de equipe e pagamentos via PagBank (PagSeguro).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusBadgeVariant} className="text-xs uppercase tracking-wider font-semibold">
                {statusLabel}
              </Badge>
              {currentSub && (
                <span className="text-xs text-muted-foreground">
                  Renovação: {new Date(currentSub.current_period_end).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quota Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users className="h-4 w-4 text-primary" />
                Membros
              </div>
              <div className="text-lg font-bold">
                {data?.usage.members_count || 1} / {currentSub?.plan?.max_members || 3}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Assentos contratados</p>
            </div>

            <div className="rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <MessageSquare className="h-4 w-4 text-emerald-500" />
                WhatsApp
              </div>
              <div className="text-lg font-bold">
                {data?.usage.whatsapp_numbers_count || 0} / {currentSub?.plan?.max_whatsapp_numbers || 1}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Números conectados</p>
            </div>

            <div className="rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Zap className="h-4 w-4 text-amber-500" />
                Mensagens / Mês
              </div>
              <div className="text-lg font-bold">
                {(currentSub?.plan?.monthly_messages_quota || 5000).toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Cota mensal de envios</p>
            </div>

            <div className="rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Sparkles className="h-4 w-4 text-purple-500" />
                IA Tokens
              </div>
              <div className="text-lg font-bold">
                {((currentSub?.plan?.monthly_ai_tokens_quota || 500000) / 1000).toLocaleString('pt-BR')}k
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Cota para agentes e RAG</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Available Subscription Plans */}
      <div className="grid gap-6 md:grid-cols-3">
        {data?.plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <Card
              key={plan.id}
              className={`flex flex-col relative transition-all ${
                isCurrent ? 'border-primary shadow-sm ring-1 ring-primary/20' : 'border-border'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground font-medium text-xs px-2.5 py-0.5">
                    Plano Atual
                  </Badge>
                </div>
              )}
              <CardHeader className="pt-6">
                <CardTitle className="text-lg font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-xs min-h-[36px]">{plan.description}</CardDescription>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight">{formatBRL(plan.price_cents)}</span>
                  <span className="text-xs text-muted-foreground font-normal">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between space-y-6">
                <ul className="space-y-2 text-xs">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={!data.is_owner}
                  onClick={() => handleOpenCheckout(plan)}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  {isCurrent ? 'Renovar com Pix' : 'Assinar com Pix'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 3. PagBank Pix Checkout Modal */}
      <Dialog open={checkoutModalOpen} onOpenChange={setCheckoutModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Pagamento via Pix (PagBank)
            </DialogTitle>
            <DialogDescription>
              {selectedPlan && `Plano ${selectedPlan.name} • ${formatBRL(selectedPlan.price_cents)}/mês`}
            </DialogDescription>
          </DialogHeader>

          {!pixResult ? (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Informe os dados para emissão da cobrança oficial no PagBank:
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    CPF ou CNPJ (Opcional, recomendado para nota)
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Telefone celular com DDD
                  </label>
                  <input
                    type="text"
                    placeholder="11988887777"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <Button
                className="w-full mt-4"
                disabled={submittingCheckout}
                onClick={handleGeneratePix}
              >
                {submittingCheckout ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando Pix no PagBank...
                  </>
                ) : (
                  'Gerar QR Code Pix'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-center">
              {pixResult.pix.qr_code_image_url ? (
                <div className="flex justify-center p-2 bg-white rounded-lg border w-fit mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pixResult.pix.qr_code_image_url}
                    alt="QR Code Pix PagBank"
                    className="w-48 h-48"
                  />
                </div>
              ) : (
                <div className="p-6 border rounded-lg bg-muted/20 flex flex-col items-center justify-center">
                  <QrCode className="h-16 w-16 text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">Utilize o código Copia e Cola abaixo:</p>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground flex items-center justify-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  Aguardando confirmação do PagBank em tempo real...
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Abra o aplicativo do seu banco e pague escaneando o QR Code ou cole a chave abaixo.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={pixResult.pix.qr_code_text}
                  className="flex-1 rounded-md border border-input bg-muted/50 px-2.5 py-1.5 text-xs font-mono text-muted-foreground select-all"
                />
                <Button size="sm" onClick={handleCopyPix} variant="secondary">
                  {copiedPix ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
