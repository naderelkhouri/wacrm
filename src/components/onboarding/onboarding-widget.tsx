"use client";

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
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  X,
  Compass,
} from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export function OnboardingWidget() {
  const {
    status,
    loading,
    isDismissed,
    dismiss,
    isCollapsed,
    toggleCollapse,
    openModal,
  } = useOnboarding();

  if (loading || !status || isDismissed) {
    return null;
  }

  const { completedCount, totalCount, percentage, allCompleted, steps } = status;

  if (allCompleted) {
    return (
      <Card className="relative overflow-hidden border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-primary/5 to-emerald-500/5 transition-all">
        <div className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Tudo pronto! Sua conta está 100% configurada.
              </h3>
              <p className="text-xs text-muted-foreground sm:text-sm">
                WhatsApp conectado, equipe e inteligência artificial configurados. Boas vendas!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openModal(0)}
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <Compass className="mr-1.5 h-3.5 w-3.5" />
              Rever Guia
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={dismiss}
              aria-label="Dispensar banner de configuração concluída"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-border bg-card shadow-sm transition-all duration-200">
      {/* Accent top border gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-primary/80" />

      <CardHeader className="p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
                Guia de Configuração da Conta
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  {completedCount} de {totalCount} concluídos ({percentage}%)
                </span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground sm:text-sm">
                Siga o passo a passo para conectar o WhatsApp e liberar todo o potencial do seu CRM.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              onClick={() => openModal()}
              size="sm"
              className="h-8 bg-primary text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Tutorial Interativo
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleCollapse}
              aria-label={isCollapsed ? "Expandir guia de configuração" : "Minimizar guia de configuração"}
              className="text-muted-foreground hover:text-foreground"
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={dismiss}
              aria-label="Ocultar guia de configuração"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${Math.max(percentage, 5)}%` }}
          />
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="p-5 pt-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = STEP_ICONS[step.id] || Compass;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-200",
                    step.completed
                      ? "border-emerald-500/20 bg-emerald-500/[0.03] hover:border-emerald-500/40"
                      : "border-border bg-card/60 hover:border-primary/40 hover:bg-muted/40"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg text-sm",
                            step.completed
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Passo {index + 1}
                        </span>
                      </div>
                      {step.completed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Feito
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Circle className="h-2.5 w-2.5" />
                          Pendente
                        </span>
                      )}
                    </div>

                    <h4 className="mt-2 text-sm font-semibold text-foreground">
                      {step.title}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
                    <button
                      type="button"
                      onClick={() => openModal(index)}
                      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Ver detalhes
                    </button>
                    <Link href={step.href}>
                      <Button
                        variant={step.completed ? "ghost" : "outline"}
                        size="sm"
                        className={cn(
                          "h-7 px-2.5 text-xs",
                          step.completed
                            ? "text-muted-foreground hover:text-foreground"
                            : "border-primary/30 text-primary hover:bg-primary/10"
                        )}
                      >
                        {step.completed ? "Revisar" : step.actionLabel}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
