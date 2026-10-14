"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { useTotalUnread } from "@/hooks/use-total-unread";
import {
  LayoutDashboard,
  MessageSquare,
  GitBranch,
  Users,
  Menu,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  return (
    <Suspense fallback={null}>
      <MobileBottomNavInner onOpenMenu={onOpenMenu} />
    </Suspense>
  );
}

function MobileBottomNavInner({ onOpenMenu }: MobileBottomNavProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalUnread = useTotalUnread();

  // On mobile, if an active conversation thread is open in /inbox (?c=uuid),
  // hide the bottom nav bar completely so the chat composer and keyboard
  // have 100% of the screen height.
  const isInsideActiveChat =
    pathname.startsWith("/inbox") && !!searchParams.get("c");

  if (isInsideActiveChat) {
    return null;
  }

  const navItems = [
    {
      href: "/dashboard",
      label: t("dashboard"),
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard",
    },
    {
      href: "/inbox",
      label: t("inbox"),
      icon: MessageSquare,
      isActive: pathname.startsWith("/inbox"),
      badge: totalUnread > 0 ? totalUnread : undefined,
    },
    {
      href: "/pipelines",
      label: t("pipelines"),
      icon: GitBranch,
      isActive: pathname.startsWith("/pipelines"),
    },
    {
      href: "/contacts",
      label: t("contacts"),
      icon: Users,
      isActive: pathname.startsWith("/contacts"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md transition-transform duration-200 lg:hidden",
        "pb-[max(0.35rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="grid h-14 grid-cols-5 items-center justify-around px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex h-full flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium transition-colors",
                item.isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={cn("h-5 w-5", item.isActive && "scale-105")} />
                {item.badge !== undefined && (
                  <span
                    className={cn(
                      "absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground",
                      item.badge > 99 && "text-[8px]",
                    )}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[58px]">{item.label}</span>
              {item.isActive && (
                <span
                  aria-hidden
                  className="absolute bottom-1 h-0.5 w-4 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}

        {/* Menu button to open full sidebar drawer */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          className="relative flex h-full flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
          <span className="truncate max-w-[58px]">Mais</span>
        </button>
      </div>
    </nav>
  );
}
