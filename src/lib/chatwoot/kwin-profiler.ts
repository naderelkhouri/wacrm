// ============================================================
// Kwin.js Feature Latency Profiler
// Adapted from @chatwoot/kwin.js — Microsecond Performance API
// Reports slow UI/feature executions (>thresholdMs) to Product Radar
// ============================================================

export interface FeaturePerformanceEvent {
  id: string;
  featureName: string;
  durationMs: number;
  startTimeMs: number;
  marks: Record<string, number>;
  path: string;
}

function generateId(): string {
  return 'xxxxxxxx4xxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class FeatureTimer {
  public readonly id: string;
  public readonly featureName: string;
  private startMark: string;
  private endMark: string;
  private markIdentifier: string;
  private intermediateMarks: string[] = [];
  private startTimestamp: number = 0;
  private thresholdMs: number;

  constructor(featureName: string, thresholdMs = 2000) {
    this.id = generateId();
    this.featureName = featureName;
    this.thresholdMs = thresholdMs;
    this.markIdentifier = `wacrm-${featureName}-${this.id}`;
    this.startMark = `${this.markIdentifier}-start`;
    this.endMark = `${this.markIdentifier}-end`;
  }

  public start(): this {
    this.startTimestamp =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (typeof performance !== 'undefined' && performance.mark) {
      try {
        performance.mark(this.startMark);
      } catch {
        // Ignore in unsupported environments
      }
    }
    return this;
  }

  public mark(stepName: string): this {
    this.intermediateMarks.push(stepName);
    if (typeof performance !== 'undefined' && performance.mark) {
      try {
        performance.mark(`${this.markIdentifier}-${stepName}`);
      } catch {
        // Ignore
      }
    }
    return this;
  }

  public stop(): FeaturePerformanceEvent | null {
    const endNow =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const durationMs = Math.round(endNow - this.startTimestamp);

    const marks: Record<string, number> = {};
    if (
      typeof performance !== 'undefined' &&
      performance.mark &&
      performance.measure
    ) {
      try {
        performance.mark(this.endMark);
        for (const stepName of this.intermediateMarks) {
          const m = performance.measure(
            `${this.markIdentifier}-${stepName}-measure`,
            this.startMark,
            `${this.markIdentifier}-${stepName}`,
          );
          marks[`start:${stepName}`] = Math.round(m.duration);
        }
      } catch {
        // Ignore measurement errors
      }
    }

    const event: FeaturePerformanceEvent = {
      id: this.id,
      featureName: this.featureName,
      durationMs,
      startTimeMs: Math.round(this.startTimestamp),
      marks,
      path:
        typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
    };

    // Automatically report slow operations to SuperAdmin Product Radar
    if (durationMs >= this.thresholdMs && typeof window !== 'undefined') {
      fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'slow_feature',
          path: event.path,
          title: `Lentidão Detectada (${durationMs}ms): ${this.featureName}`,
          description: `A operação "${this.featureName}" levou ${durationMs}ms na rota ${event.path} (limite saudável: ${this.thresholdMs}ms).`,
          metadata: event,
        }),
      }).catch(() => {});
    }

    return event;
  }
}

export const kwinProfiler = {
  start(featureName: string, thresholdMs = 2000): FeatureTimer {
    return new FeatureTimer(featureName, thresholdMs).start();
  },
};
