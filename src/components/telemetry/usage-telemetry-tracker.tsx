'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function UsageTelemetryTracker() {
  const pathname = usePathname();
  const lastTrackedPathRef = useRef<string | null>(null);

  // 1. Track route transitions (LGPD-compliant, ignores /admin)
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    if (lastTrackedPathRef.current === pathname) return;
    lastTrackedPathRef.current = pathname;

    const timer = setTimeout(() => {
      fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'page_view',
          path: pathname,
          referrer: typeof document !== 'undefined' ? document.referrer : '',
        }),
      }).catch(() => {
        // Non-blocking silent telemetry
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [pathname]);

  // 2. Capture unnoticed runtime errors and unhandled rejections automatically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRuntimeError = (event: ErrorEvent) => {
      const msg = event.message || 'Erro de execução no cliente';
      // Ignore benign ResizeObserver or network abort messages
      if (msg.includes('ResizeObserver') || msg.includes('AbortError')) return;

      fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'silent_error',
          path: window.location.pathname,
          title: `Erro Cliente: ${msg.slice(0, 120)}`,
          description: `Arquivo: ${event.filename || 'N/A'}:${event.lineno || 0}:${event.colno || 0}`,
          metadata: {
            stack: event.error?.stack?.slice(0, 500) || null,
          },
        }),
      }).catch(() => {});
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === 'string'
            ? event.reason
            : 'Promise rejeitada sem tratamento';

      if (reason.includes('AbortError') || reason.includes('Failed to fetch')) return;

      fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'silent_error',
          path: window.location.pathname,
          title: `Rejeição Assíncrona: ${reason.slice(0, 120)}`,
          description: `Capturado automaticamente na rota ${window.location.pathname}`,
        }),
      }).catch(() => {});
    };

    window.addEventListener('error', handleRuntimeError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleRuntimeError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
