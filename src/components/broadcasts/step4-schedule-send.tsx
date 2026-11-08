'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Send, Loader2, Users, Save, Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AudienceConfig {
  type: string;
  tagIds?: string[];
  csvContacts?: { phone: string; name?: string }[];
}

export interface WhatsAppInstanceOption {
  id: string;
  name?: string | null;
  phone_number_id: string;
  provider: 'meta' | 'uazapi';
  status: string;
  is_default: boolean;
  country?: string;
  state?: string | null;
  city?: string | null;
  warmup_enabled?: boolean;
  daily_message_limit?: number;
}

interface Step4Props {
  name: string;
  onNameChange: (name: string) => void;
  template: MessageTemplate;
  audience: AudienceConfig;
  selectedConfigId?: string | null;
  onSelectedConfigIdChange?: (id: string | null) => void;
  onSend: () => void;
  onSaveDraft?: () => void;
  onBack: () => void;
  isProcessing: boolean;
  progress: number;
  rateLimitWaitSeconds?: number | null;
}

export function Step4ScheduleSend({
  name,
  onNameChange,
  template,
  audience,
  selectedConfigId,
  onSelectedConfigIdChange,
  onSend,
  onSaveDraft,
  onBack,
  isProcessing,
  progress,
  rateLimitWaitSeconds,
}: Step4Props) {
  const t = useTranslations('Broadcasts.wizard');
  const [showConfirm, setShowConfirm] = useState(false);
  const [estimatedReach, setEstimatedReach] = useState<number>(0);
  const [loadingReach, setLoadingReach] = useState(true);
  const [instances, setInstances] = useState<WhatsAppInstanceOption[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);

  useEffect(() => {
    async function loadInstances() {
      setLoadingInstances(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('whatsapp_config')
          .select('id, name, phone_number_id, provider, status, is_default, country, state, city, warmup_enabled, daily_message_limit')
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true });

        const list = (data || []) as WhatsAppInstanceOption[];
        setInstances(list);

        if (!selectedConfigId && list.length > 0 && onSelectedConfigIdChange) {
          // Prioritize unofficial (uazapi) as requested, or default
          const preferred =
            list.find((i) => i.provider === 'uazapi' && i.is_default && i.status === 'connected') ||
            list.find((i) => i.provider === 'uazapi' && i.status === 'connected') ||
            list.find((i) => i.provider === 'uazapi') ||
            list.find((i) => i.is_default) ||
            list[0];
          if (preferred) {
            onSelectedConfigIdChange(preferred.id);
          }
        }
      } catch (err) {
        console.error('Failed to load whatsapp instances:', err);
      } finally {
        setLoadingInstances(false);
      }
    }

    loadInstances();
  }, [onSelectedConfigIdChange, selectedConfigId]);

  useEffect(() => {
    async function calculateReach() {
      setLoadingReach(true);
      try {
        const supabase = createClient();

        if (audience.type === 'all') {
          const { count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true });
          setEstimatedReach(count ?? 0);
        } else if (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) {
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', audience.tagIds);

          const uniqueIds = new Set((contactTags ?? []).map((ct) => ct.contact_id));
          setEstimatedReach(uniqueIds.size);
        } else if (audience.type === 'csv' && audience.csvContacts) {
          setEstimatedReach(audience.csvContacts.length);
        } else {
          setEstimatedReach(0);
        }
      } finally {
        setLoadingReach(false);
      }
    }

    calculateReach();
  }, [audience]);

  const audienceLabel =
    audience.type === 'all'
      ? t('scheduleSend.audienceAll')
      : audience.type === 'tags'
        ? t('scheduleSend.audienceTags')
        : audience.type === 'csv'
          ? t('scheduleSend.audienceCsv')
          : t('scheduleSend.audienceField');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('scheduleSend.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('scheduleSend.subtitle')}
        </p>
      </div>

      {/* Broadcast Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">{t('scheduleSend.broadcastName')}</label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('scheduleSend.broadcastNamePlaceholder')}
          className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* WhatsApp Sender Instance */}
      {instances.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <span>Canal de Envio (Instância do WhatsApp)</span>
            </label>
            <span className="text-xs font-medium">
              {instances.find((i) => i.id === selectedConfigId)?.provider === 'uazapi' ? (
                <span className="text-emerald-500 font-medium">⚡ Não oficial (Uazapi) - Prioritária</span>
              ) : (
                <span className="text-blue-500 font-medium">🛡️ Oficial (Meta Cloud API)</span>
              )}
            </span>
          </div>
          <Select
            value={selectedConfigId || (instances[0]?.id ?? '')}
            onValueChange={(val) => onSelectedConfigIdChange?.(val)}
          >
            <SelectTrigger className="w-full border-border bg-muted text-foreground">
              <SelectValue placeholder="Selecione o número de WhatsApp" />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover">
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{inst.name || inst.phone_number_id}</span>
                    <span className="text-xs text-muted-foreground">({inst.phone_number_id})</span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-mono',
                        inst.provider === 'uazapi'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                      )}
                    >
                      {inst.provider === 'uazapi' ? 'Uazapi' : 'Meta Oficial'}
                    </span>
                    {inst.is_default && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        Padrão
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Active instance details: Geo location & Warmup Guard */}
          {(() => {
            const activeInst = instances.find((i) => i.id === (selectedConfigId || instances[0]?.id));
            if (!activeInst) return null;
            const isExceeded = Boolean(
              activeInst.warmup_enabled &&
              activeInst.daily_message_limit &&
              estimatedReach > activeInst.daily_message_limit
            );

            return (
              <div className="space-y-2 pt-1 border-t border-border">
                <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    📍 {activeInst.city ? `${activeInst.city} - ${activeInst.state}` : (activeInst.country || 'Brasil')}
                  </span>
                  {activeInst.warmup_enabled && (
                    <span className="text-amber-500 font-medium flex items-center gap-1">
                      🔥 Modo Aquecimento (Máx. {activeInst.daily_message_limit} msgs/dia)
                    </span>
                  )}
                </div>

                {isExceeded && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-500 flex items-start gap-2">
                    <span>⚠️</span>
                    <span>
                      <strong>Alerta de Aquecimento:</strong> A audiência ({estimatedReach.toLocaleString()} contatos) ultrapassa o limite seguro de aquecimento deste chip ({activeInst.daily_message_limit} mensagens/dia). Recomendamos segmentar o público para prevenir bloqueios preventivos pela Meta.
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          <p className="text-xs text-muted-foreground">
            Você pode disparar utilizando tanto a API Não Oficial (Uazapi) quanto a API Oficial da Meta.
          </p>
        </div>
      )}

      {/* Summary Card */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">{t('scheduleSend.summary')}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t('scheduleSend.template')}</p>
            <p className="text-foreground">{template.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('scheduleSend.audience')}</p>
            <p className="text-foreground">{audienceLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estimated Reach</p>
            <div className="flex items-center gap-1.5">
              {loadingReach ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                <>
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <p className="font-medium text-foreground">{estimatedReach.toLocaleString()}</p>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Language</p>
            <p className="text-foreground">{template.language ?? 'en_US'}</p>
          </div>
        </div>
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">
                {rateLimitWaitSeconds
                  ? `Rate limit reached. Pausing for ${rateLimitWaitSeconds}s...`
                  : t('scheduleSend.sending')}
              </p>
            </div>
            <span className="text-xs font-medium text-primary">{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="border-border text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Button>

        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={!name.trim() || isProcessing}
              className="border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {t('scheduleSend.saveDraft')}
            </Button>
          )}

          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogTrigger
            render={
              <Button
                disabled={!name.trim() || isProcessing}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              />
            }
          >
            <Send className="h-4 w-4" />
            {t('scheduleSend.sendNow')}
          </DialogTrigger>
          <DialogContent className="border-border bg-popover sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">Confirm Broadcast</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                You are about to send this broadcast to{' '}
                <span className="font-medium text-popover-foreground">{estimatedReach.toLocaleString()}</span>{' '}
                contacts using the{' '}
                <span className="font-medium text-popover-foreground">{template.name}</span> template.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="border-border text-muted-foreground"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={() => {
                  setShowConfirm(false);
                  onSend();
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
                {t('scheduleSend.sendNow')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}
