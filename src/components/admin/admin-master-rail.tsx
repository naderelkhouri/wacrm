'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  ADMIN_RAIL_GROUPS,
  ADMIN_SECTION_META,
  ADMIN_SECTIONS,
  type AdminMasterSection,
} from './admin-master-sections';

const RAIL_DESKTOP_MIN_PX = 1024;

export function AdminMasterRail({
  active,
  onSelect,
  hints,
  collapsed = false,
  onToggleCollapse,
}: {
  active: AdminMasterSection;
  onSelect: (section: AdminMasterSection) => void;
  hints?: Partial<Record<AdminMasterSection, ReactNode>>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active into view on mobile
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
      aria-label="Área Master seções"
      className={cn(
        'flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'border-b border-border',
        'lg:sticky lg:top-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0 transition-all duration-200',
      )}
    >
      {onToggleCollapse && (
        <div
          className={cn(
            'hidden lg:flex items-center mb-1.5',
            collapsed ? 'justify-center' : 'justify-between px-2',
          )}
        >
          {!collapsed && (
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Navegação Master
            </span>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                >
                  {collapsed ? (
                    <PanelLeftOpen className="size-4" />
                  ) : (
                    <PanelLeftClose className="size-4" />
                  )}
                </button>
              }
            />
            <TooltipContent side="right" sideOffset={8}>
              {collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {ADMIN_RAIL_GROUPS.map(({ label, group }, groupIdx) => {
        const items = ADMIN_SECTIONS.filter(
          (s) => ADMIN_SECTION_META[s].group === group,
        );
        return (
          <div key={group} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
            {label ? (
              collapsed ? (
                groupIdx > 0 ? (
                  <div className="hidden lg:block my-1.5 border-t border-border/60 mx-1" />
                ) : null
              ) : (
                <div className="hidden px-3 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase lg:block">
                  {label}
                </div>
              )
            ) : null}
            {items.map((s) => {
              const meta = ADMIN_SECTION_META[s];
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
                      ? 'bg-amber-500/15 text-amber-500 font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className={cn('size-4 shrink-0', isActive ? 'text-amber-500' : '')} />
                  {!collapsed && <span className="flex-1">{meta.defaultTitle}</span>}
                  {!collapsed && hints?.[s] != null ? (
                    <span
                      className={cn(
                        'hidden items-center gap-1.5 text-xs lg:inline-flex',
                        isActive ? 'text-amber-500 font-semibold' : 'text-muted-foreground',
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
                      <span className="font-medium">{meta.defaultTitle}</span>
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
