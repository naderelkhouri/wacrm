'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  RAIL_GROUPS,
  SECTION_META,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from './settings-sections';

// Width at/above which the rail is a vertical column (already in view, so
// no auto-scroll needed). Mirrors the Tailwind `lg:` breakpoint that
// drives the row→column switch in the markup below — keep the two in sync.
const RAIL_DESKTOP_MIN_PX = 1024;

/**
 * The settings left rail — grouped, vertical on desktop and a
 * horizontal scroller on narrow screens (mirrors the mockup's ≤920px
 * behaviour). The active item auto-scrolls into view when the rail is
 * horizontal so a deep-linked section is never off-screen.
 */
export function SettingsRail({
  active,
  onSelect,
  hints,
  collapsed = false,
  onToggleCollapse,
}: {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  hints?: Partial<Record<SettingsSection, ReactNode>>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const t = useTranslations('Settings');
  const activeRef = useRef<HTMLButtonElement>(null);

  // When horizontal (mobile), keep the active chip in view. On desktop
  // the rail is a static column, so skip.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia(`(min-width: ${RAIL_DESKTOP_MIN_PX}px)`).matches) return;
    activeRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [active]);

  return (
    <nav
      aria-label="Settings sections"
      className={cn(
        'flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'border-b border-border',
        'lg:sticky lg:top-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0 transition-all duration-200',
      )}
    >
      {onToggleCollapse && (
        <div className={cn(
          "hidden lg:flex items-center mb-1.5",
          collapsed ? "justify-center" : "justify-between px-2"
        )}>
          {!collapsed && (
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Navegação
            </span>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
                >
                  {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                </button>
              }
            />
            <TooltipContent side="right" sideOffset={8}>
              {collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {RAIL_GROUPS.map(({ label, group }, groupIdx) => {
        const items = SETTINGS_SECTIONS.filter(
          (s) => SECTION_META[s].group === group,
        );
        return (
          <div
            key={group}
            className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5"
          >
            {label ? (
              collapsed ? (
                groupIdx > 0 ? (
                  <div className="hidden lg:block my-1.5 border-t border-border/60 mx-1" />
                ) : null
              ) : (
                <div className="hidden px-3 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase lg:block">
                  {t(`groups.${group}`)}
                </div>
              )
            ) : null}
            {items.map((s) => {
              const meta = SECTION_META[s];
              const Icon = meta.icon;
              const isActive = s === active;

              const buttonElement = (
                <button
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  onClick={() => onSelect(s)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center rounded-lg py-2 text-left text-sm font-medium whitespace-nowrap transition-colors',
                    collapsed
                      ? 'lg:w-10 lg:h-10 lg:justify-center lg:px-0 px-3'
                      : 'lg:w-full lg:px-3 lg:gap-2.5 px-3 gap-2.5',
                    isActive
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="flex-1">{t(`sections.${s}`)}</span>}
                  {!collapsed && hints?.[s] != null ? (
                    <span
                      className={cn(
                        'hidden items-center gap-1.5 text-xs lg:inline-flex',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {hints[s]}
                    </span>
                  ) : null}
                </button>
              );

              if (collapsed) {
                return (
                  <Tooltip key={s}>
                    <TooltipTrigger render={buttonElement} />
                    <TooltipContent side="right" sideOffset={12} className="flex items-center gap-2">
                      <span className="font-medium">{t(`sections.${s}`)}</span>
                      {hints?.[s] != null ? (
                        <span className="text-xs text-muted-foreground">({hints[s]})</span>
                      ) : null}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={s}>{buttonElement}</div>;
            })}
          </div>
        );
      })}
    </nav>
  );
}
