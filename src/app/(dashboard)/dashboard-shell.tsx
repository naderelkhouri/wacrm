"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { OnboardingProvider } from "@/hooks/use-onboarding";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { PresenceHeartbeat } from "@/components/presence/presence-heartbeat";
import { cn } from "@/lib/utils";

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sidebar drawer state — only used on mobile. On lg+ the sidebar is
  // always visible and this stays at `false` (ignored by the component).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const isInbox = pathname?.startsWith("/inbox");
  const isInsideActiveChat = isInbox && !!searchParams.get("c");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Reports this tab's online/away presence once we know a user is
          signed in. Headless — renders nothing. */}
      <PresenceHeartbeat />
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* On mobile inside an active chat thread, hide the top header to give 100% space to the conversation header */}
        <div className={cn(isInsideActiveChat && "hidden lg:block")}>
          <Header onOpenSidebar={() => setSidebarOpen(true)} />
        </div>
        {/* Thinner horizontal padding on mobile so cards have room to breathe; pb-20 on mobile leaves space for MobileBottomNav */}
        <main
          className={cn(
            "flex-1 overflow-y-auto",
            isInbox ? "overflow-hidden p-0" : "p-4 sm:p-6 pb-20 lg:pb-6",
          )}
        >
          {children}
        </main>
      </div>
      {/* Mobile Bottom Navigation Bar (<lg) */}
      <MobileBottomNav onOpenMenu={() => setSidebarOpen(true)} />
      {/* Global Onboarding / Interactive Tutorial Modal */}
      <OnboardingModal />
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OnboardingProvider>
        <Suspense fallback={null}>
          <DashboardShellInner>{children}</DashboardShellInner>
        </Suspense>
      </OnboardingProvider>
    </AuthProvider>
  );
}
