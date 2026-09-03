"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import type { OnboardingStatusResponse } from "@/app/api/account/onboarding-status/route";

interface OnboardingContextValue {
  status: OnboardingStatusResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  isDismissed: boolean;
  dismiss: () => void;
  undismiss: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isModalOpen: boolean;
  currentModalStep: number;
  openModal: (stepIndex?: number) => void;
  closeModal: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, accountId } = useAuth();
  const [status, setStatus] = useState<OnboardingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentModalStep, setCurrentModalStep] = useState(0);

  // Load preferences from localStorage when accountId is available
  useEffect(() => {
    if (!accountId) return;
    try {
      const dismissed = localStorage.getItem(`wacrm_onboarding_dismissed_${accountId}`);
      const collapsed = localStorage.getItem(`wacrm_onboarding_collapsed_${accountId}`);
      setIsDismissed(dismissed === "true");
      setIsCollapsed(collapsed === "true");
    } catch {
      // Ignore localStorage errors (e.g. private mode)
    }
  }, [accountId]);

  const fetchStatus = useCallback(async () => {
    if (!user || !accountId) return;
    try {
      const res = await fetch("/api/account/onboarding-status", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch onboarding status");
      const data: OnboardingStatusResponse = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("[useOnboarding] Error fetching status:", err);
    } finally {
      setLoading(false);
    }
  }, [user, accountId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    if (accountId) {
      try {
        localStorage.setItem(`wacrm_onboarding_dismissed_${accountId}`, "true");
      } catch {}
    }
  }, [accountId]);

  const undismiss = useCallback(() => {
    setIsDismissed(false);
    if (accountId) {
      try {
        localStorage.removeItem(`wacrm_onboarding_dismissed_${accountId}`);
      } catch {}
    }
  }, [accountId]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (accountId) {
        try {
          localStorage.setItem(`wacrm_onboarding_collapsed_${accountId}`, String(next));
        } catch {}
      }
      return next;
    });
  }, [accountId]);

  const openModal = useCallback((stepIndex = 0) => {
    setCurrentModalStep(stepIndex);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        status,
        loading,
        refresh: fetchStatus,
        isDismissed,
        dismiss,
        undismiss,
        isCollapsed,
        toggleCollapse,
        isModalOpen,
        currentModalStep,
        openModal,
        closeModal,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    return {
      status: null,
      loading: false,
      refresh: async () => {},
      isDismissed: false,
      dismiss: () => {},
      undismiss: () => {},
      isCollapsed: false,
      toggleCollapse: () => {},
      isModalOpen: false,
      currentModalStep: 0,
      openModal: () => {},
      closeModal: () => {},
    };
  }
  return ctx;
}
