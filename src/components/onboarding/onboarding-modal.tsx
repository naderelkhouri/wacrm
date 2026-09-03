"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PlugZap,
  User,
  Bot,
  Zap,
  Users,
  UsersRound,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEP_ICONS: Record<string, typeof PlugZap> = {
  whatsapp: PlugZap,
  profile: User,
  ai: Bot,
  templates: Zap,
  contacts: Users,
  team: UsersRound,
};

const STEP_DETAILS: Record<
  string,
  {
    subtitle: string;
    whyItMatters: string;
    actionSteps: string[];
    documentationLink?: string;
  }
> = {
  whatsapp: {
    subtitle: "Conecte sua conta oficial do WhatsApp Business",
    whyItMatters:
      "A integração direta com a API oficial da Meta (WhatsApp Cloud API) garante alta entregabilidade, estabilidade sem risco de desconexão e suporte a mensagens multimídia e interativas.",
    actionSteps: [
      "Acesse o painel do Meta for Developers (developers.facebook.com) e selecione seu App.",
      "Copie o Phone Number ID e gere um Access Token do sistema com permissões de WhatsApp.",
      "Cole as credenciais na aba WhatsApp das Configurações e clique em Salvar Configuração.",
    ],
    documentationLink: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  },
  profile: {
    subtitle: "Configure sua identidade e moeda da conta",
    whyItMatters:
      "Ter seu perfil preenchido permite que seus colegas identifiquem quem está respondendo aos contatos, além de definir a moeda padrão dos seus pipelines de vendas (BRL, USD, EUR, etc).",
    actionSteps: [
      "Informe seu nome completo para exibição no Inbox e nos registros de auditoria.",
      "Faça upload de uma foto de perfil ou avatar personalizado.",
      "Selecione a moeda padrão para exibição dos valores dos negócios em pipelines.",
    ],
  },
  ai: {
    subtitle: "Ative IA Generativa e Especialistas no Inbox",
    whyItMatters:
      "Os especialistas de IA ajudam sua equipe a sugerir respostas, analisar o sentimento dos clientes e executar respostas automáticas 24 horas por dia.",
    actionSteps: [
      "Cadastre sua chave da OpenAI ou Anthropic na aba de IA.",
      "Defina as instruções de tom de voz e regras de atendimento do seu negócio.",
      "Ative os especialistas nos canais de conversa para acelerar o tempo de resposta.",
    ],
  },
  templates: {
    subtitle: "Crie atalhos rápidos para mensagens frequentes",
    whyItMatters:
      "Respostas rápidas reduzem o tempo de digitação de dúvidas comuns (preços, horários, links de pagamento) e padronizam a qualidade do atendimento.",
    actionSteps: [
      "Acesse Configurações > Respostas Rápidas.",
      "Crie um atalho fácil de lembrar (ex: /ola, /precos, /pix).",
      "No Inbox, digite '/' no campo de texto para selecionar e enviar a resposta em 1 segundo.",
    ],
  },
  contacts: {
    subtitle: "Adicione ou importe sua lista de clientes e leads",
    whyItMatters:
      "Centralize todo o histórico, tags e anotações dos clientes em um único lugar para nunca perder o contexto de uma negociação.",
    actionSteps: [
      "Acesse a página de Contatos.",
      "Adicione seu primeiro contato com nome e telefone (com DDI/DDD).",
      "Ou utilize o botão de Importar CSV para carregar centenas de contatos simultaneamente.",
    ],
  },
  team: {
    subtitle: "Convide seus colegas para atenderem juntos",
    whyItMatters:
      "O WACRM suporta múltiplos atendentes simultâneos na mesma conta de WhatsApp, com controle granular de permissões e presença online em tempo real.",
    actionSteps: [
      "Acesse Configurações > Membros da Equipe.",
      "Gere um link de convite ou informe o e-mail do colaborador.",
      "Escolha a função: Administrador, Agente (atendimento) ou Visualizador.",
    ],
  },
};

export function OnboardingModal() {
  const { status, isModalOpen, closeModal, currentModalStep } = useOnboarding();
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    if (isModalOpen) {
      setActiveStepIndex(currentModalStep || 0);
    }
  }, [isModalOpen, currentModalStep]);

  if (!status) return null;

  const steps = status.steps;
  const currentStep = steps[activeStepIndex] || steps[0];
  if (!currentStep) return null;

  const Icon = STEP_ICONS[currentStep.id] || PlugZap;
  const details = STEP_DETAILS[currentStep.id] || {
    subtitle: currentStep.description,
    whyItMatters: currentStep.description,
    actionSteps: [currentStep.tip],
  };

  const handleNext = () => {
    if (activeStepIndex < steps.length - 1) {
      setActiveStepIndex(activeStepIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeStepIndex > 0) {
      setActiveStepIndex(activeStepIndex - 1);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-2xl overflow-hidden border-border bg-card">
        {/* Header with gradient banner */}
        <div className="relative bg-gradient-to-r from-primary/15 via-primary/5 to-emerald-500/10 p-6 pb-5 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Tutorial Interativo • Passo {activeStepIndex + 1} de {steps.length}
            </span>
            {currentStep.completed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Etapa Concluída
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Circle className="h-3 w-3" />
                Pendente de Configuração
              </span>
            )}
          </div>

          <DialogHeader className="mt-3 gap-1 text-left">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl",
                  currentStep.completed
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-primary text-primary-foreground shadow-sm"
                )}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  {currentStep.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
                  {details.subtitle}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Stepper Dots */}
          <div className="mt-4 flex items-center justify-between gap-1.5">
            {steps.map((step, idx) => {
              const StepIcon = STEP_ICONS[step.id] || Circle;
              const isCurrent = idx === activeStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStepIndex(idx)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all",
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : step.completed
                        ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <StepIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Passo {idx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-4 p-6 text-sm">
          {/* Why it matters */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <ShieldCheck className="h-4 w-4" />
              Por que configurar esta etapa?
            </h4>
            <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
              {details.whyItMatters}
            </p>
          </div>

          {/* Action Steps */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Como configurar:
            </h4>
            <ul className="mt-2.5 space-y-2">
              {details.actionSteps.map((instruction, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 text-xs text-muted-foreground sm:text-sm"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {idx + 1}
                  </span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tip Box */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">💡 Dica Pro: </span>
            {currentStep.tip}
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 p-4 px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={activeStepIndex === 0}
              className="border-border text-foreground"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={activeStepIndex === steps.length - 1}
              className="border-border text-foreground"
            >
              Próximo
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={closeModal}
              className="text-muted-foreground hover:text-foreground"
            >
              Fechar
            </Button>
            <Link href={currentStep.href} onClick={closeModal}>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                {currentStep.actionLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
