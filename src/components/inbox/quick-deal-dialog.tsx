"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/lib/currency";
import type { Contact, Pipeline, PipelineStage } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface QuickDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
  onCreated?: () => void;
}

export function QuickDealDialog({
  open,
  onOpenChange,
  contact,
  onCreated,
}: QuickDealDialogProps) {
  const supabase = createClient();
  const { user, accountId, defaultCurrency } = useAuth();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency || "BRL");
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [saving, setSaving] = useState(false);

  // When dialog opens, initialize title with contact name & fetch pipelines
  useEffect(() => {
    if (!open) return;

    setTitle(`Negócio - ${contact.name || contact.phone}`);
    setValue("");
    setCurrency(defaultCurrency || "BRL");
    setNotes("");
    setExpectedCloseDate("");

    let cancelled = false;
    async function loadPipelines() {
      if (!accountId) return;
      setLoadingPipelines(true);
      try {
        const { data: pipeData } = await supabase
          .from("pipelines")
          .select("id, name, user_id, created_at")
          .eq("account_id", accountId)
          .order("created_at", { ascending: true });

        if (cancelled) return;

        const list = (pipeData || []) as Pipeline[];
        setPipelines(list);

        if (list.length > 0) {
          setPipelineId(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load pipelines:", err);
      } finally {
        if (!cancelled) setLoadingPipelines(false);
      }
    }

    loadPipelines();
    return () => {
      cancelled = true;
    };
  }, [open, contact, accountId, defaultCurrency, supabase]);

  // When pipelineId changes, load its stages
  useEffect(() => {
    if (!pipelineId) {
      setStages([]);
      setStageId("");
      return;
    }

    let cancelled = false;
    async function loadStages() {
      try {
        const { data: stagesData } = await supabase
          .from("pipeline_stages")
          .select("*")
          .eq("pipeline_id", pipelineId)
          .order("position", { ascending: true });

        if (cancelled) return;
        const stageList = (stagesData || []) as PipelineStage[];
        setStages(stageList);
        if (stageList.length > 0) {
          setStageId(stageList[0].id);
        }
      } catch (err) {
        console.error("Failed to load pipeline stages:", err);
      }
    }

    loadStages();
    return () => {
      cancelled = true;
    };
  }, [pipelineId, supabase]);

  async function handleCreateDeal() {
    if (!title.trim()) {
      toast.error("O título do negócio é obrigatório.");
      return;
    }
    if (!pipelineId || !stageId) {
      toast.error("Selecione um funil e uma etapa.");
      return;
    }
    if (!user || !accountId) {
      toast.error("Usuário não autenticado.");
      return;
    }

    setSaving(true);
    try {
      const parsedValue = value ? parseFloat(value.replace(",", ".")) : 0;

      // Find linked conversation if exists
      const { data: convData } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contact.id)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase.from("deals").insert({
        account_id: accountId,
        user_id: user.id,
        contact_id: contact.id,
        pipeline_id: pipelineId,
        stage_id: stageId,
        title: title.trim(),
        value: isNaN(parsedValue) ? 0 : parsedValue,
        currency,
        notes: notes.trim() || null,
        expected_close_date: expectedCloseDate || null,
        conversation_id: convData?.id || null,
        status: "open",
      });

      if (error) throw error;

      toast.success("Negócio criado com sucesso!");
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error("Create deal error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao criar negócio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Criar Negócio
          </DialogTitle>
          <DialogDescription>
            Abra uma nova oportunidade vinculada a <strong>{contact.name || contact.phone}</strong> diretamente pelo chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="deal-title" className="text-xs">
              Título do Negócio *
            </Label>
            <Input
              id="deal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Proposta Plano Enterprise"
              disabled={saving}
            />
          </div>

          {/* Value & Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="deal-value" className="text-xs">
                Valor estimado
              </Label>
              <Input
                id="deal-value"
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="deal-currency" className="text-xs">
                Moeda
              </Label>
              <select
                id="deal-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={saving}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pipeline & Stage */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="deal-pipeline" className="text-xs">
                Funil de Vendas *
              </Label>
              {loadingPipelines ? (
                <div className="flex h-9 items-center px-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Carregando...
                </div>
              ) : pipelines.length === 0 ? (
                <p className="text-xs text-destructive">Nenhum funil encontrado</p>
              ) : (
                <select
                  id="deal-pipeline"
                  value={pipelineId}
                  onChange={(e) => setPipelineId(e.target.value)}
                  disabled={saving}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="deal-stage" className="text-xs">
                Etapa Inicial *
              </Label>
              {stages.length === 0 ? (
                <div className="flex h-9 items-center px-2 text-xs text-muted-foreground">
                  Nenhuma etapa
                </div>
              ) : (
                <select
                  id="deal-stage"
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  disabled={saving}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Expected Close Date */}
          <div className="space-y-1">
            <Label htmlFor="deal-close-date" className="text-xs">
              Previsão de Fechamento
            </Label>
            <Input
              id="deal-close-date"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="deal-notes" className="text-xs">
              Observações / Notas do Negócio
            </Label>
            <Textarea
              id="deal-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto da negociação, condições especiais..."
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleCreateDeal}
            disabled={saving || !title.trim() || !pipelineId || !stageId}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Criando...
              </>
            ) : (
              "Salvar Negócio"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
