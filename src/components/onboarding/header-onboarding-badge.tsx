"use client";

import { Compass, Sparkles } from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";

export function HeaderOnboardingBadge() {
  const { status, loading, openModal } = useOnboarding();

  if (loading || !status) return null;

  const { completedCount, totalCount, allCompleted } = status;

  if (allCompleted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openModal(0)}
        className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Guia de Configuração (100% Concluído)"
      >
        <Compass className="h-3.5 w-3.5 text-emerald-400" />
        <span className="hidden md:inline">Guia de Início</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => openModal()}
      className="h-8 gap-1.5 border-primary/30 bg-primary/5 px-2.5 text-xs font-medium text-primary hover:bg-primary/15 hover:text-primary"
      title="Guia de Configuração da Conta"
    >
      <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
      <span className="hidden sm:inline">Guia</span>
      <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold">
        {completedCount}/{totalCount}
      </span>
    </Button>
  );
}
