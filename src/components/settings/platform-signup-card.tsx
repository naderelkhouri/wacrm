'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Globe,
  Lock,
  MailCheck,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export type SignupMode = 'open' | 'invite_only' | 'closed';

interface PlatformSettingsState {
  mode: SignupMode;
  source: 'env' | 'database';
  lockedByEnv: boolean;
}

export function PlatformSignupCard() {
  const [state, setState] = useState<PlatformSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      try {
        const res = await fetch('/api/admin/platform-settings', {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error('Falha ao carregar configurações da plataforma');
        }
        const data = await res.json();
        if (mounted) {
          setState({
            mode: data.mode ?? 'open',
            source: data.source ?? 'database',
            lockedByEnv: Boolean(data.lockedByEnv),
          });
        }
      } catch (err) {
        console.error('[PlatformSignupCard] fetch error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleModeChange(newMode: SignupMode) {
    if (state?.lockedByEnv || saving || state?.mode === newMode) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error || 'Falha ao salvar configuração global');
        return;
      }

      setState((prev) =>
        prev
          ? { ...prev, mode: newMode }
          : { mode: newMode, source: 'database', lockedByEnv: false },
      );

      const labels: Record<SignupMode, string> = {
        open: 'Cadastros liberados publicamente',
        invite_only: 'Cadastros restritos a convites válidos',
        closed: 'Novos cadastros totalmente pausados',
      };
      toast.success(labels[newMode]);
    } catch (err) {
      console.error('[PlatformSignupCard] update error:', err);
      toast.error('Erro de rede ao salvar configuração');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!state) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <CardTitle className="text-base text-foreground">
              Controle Global de Novos Registros
            </CardTitle>
          </div>
          {state.lockedByEnv ? (
            <Badge
              variant="outline"
              className="border-amber-500/20 bg-amber-500/10 text-amber-400 gap-1"
            >
              <Lock className="size-3" />
              Fixado via .env / Infra
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            >
              Dinâmico (Banco de Dados)
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Define as regras de acesso para novos cadastros e perfis criados em toda a plataforma WACRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.lockedByEnv && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              O modo de cadastro está travado pela variável{' '}
              <code className="font-mono font-semibold">SIGNUP_MODE</code> na
              infraestrutura. Para permitir alternância dinâmica pelo painel,
              remova a variável de ambiente.
            </div>
          </div>
        )}

        <RadioGroup
          value={state.mode}
          onValueChange={(val) => handleModeChange(val as SignupMode)}
          disabled={state.lockedByEnv || saving}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {/* Opção 1: Aberto */}
          <Label
            htmlFor="mode-open"
            className={`flex flex-col justify-between rounded-lg border p-3.5 cursor-pointer transition-all ${
              state.mode === 'open'
                ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
            } ${state.lockedByEnv ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-emerald-400" />
                <span className="text-xs font-semibold text-foreground">
                  Aberto (Público)
                </span>
              </div>
              <RadioGroupItem value="open" id="mode-open" />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Qualquer visitante pode criar uma conta livremente na página de cadastro.
            </p>
          </Label>

          {/* Opção 2: Somente Convite */}
          <Label
            htmlFor="mode-invite"
            className={`flex flex-col justify-between rounded-lg border p-3.5 cursor-pointer transition-all ${
              state.mode === 'invite_only'
                ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
            } ${state.lockedByEnv ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MailCheck className="size-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Apenas Convite
                </span>
              </div>
              <RadioGroupItem value="invite_only" id="mode-invite" />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Novas contas exigem um link de convite ativo gerado por uma organização existente.
            </p>
          </Label>

          {/* Opção 3: Fechado */}
          <Label
            htmlFor="mode-closed"
            className={`flex flex-col justify-between rounded-lg border p-3.5 cursor-pointer transition-all ${
              state.mode === 'closed'
                ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
            } ${state.lockedByEnv ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-red-400" />
                <span className="text-xs font-semibold text-foreground">
                  Fechado / Pausado
                </span>
              </div>
              <RadioGroupItem value="closed" id="mode-closed" />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Cadastros bloqueados. Apenas usuários já registrados conseguem fazer login.
            </p>
          </Label>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
