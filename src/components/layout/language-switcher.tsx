"use client";

import { useLocale } from "next-intl";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LOCALES, setLocalePreference } from "@/lib/locales";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const currentLocale = useLocale();

  const activeLocale =
    SUPPORTED_LOCALES.find((l) => l.id === currentLocale || (currentLocale === "pt" && l.id === "pt-BR")) ||
    SUPPORTED_LOCALES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus:outline-hidden"
        aria-label="Selecionar idioma"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm leading-none">{activeLocale.flag}</span>
        <span className="hidden sm:inline">{activeLocale.short}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-44 bg-popover text-popover-foreground">
        {SUPPORTED_LOCALES.map((locale) => {
          const isSelected = activeLocale.id === locale.id;
          return (
            <DropdownMenuItem
              key={locale.id}
              onClick={() => {
                if (!isSelected) {
                  setLocalePreference(locale.id);
                }
              }}
              className={cn(
                "flex items-center justify-between gap-2 text-xs cursor-pointer py-2",
                isSelected && "font-semibold text-primary"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{locale.flag}</span>
                <span>{locale.nativeName}</span>
              </div>
              {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
