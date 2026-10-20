import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordTelemetryEvent,
  getTelemetryMetricsSnapshot,
  getRecentTelemetryEvents,
  resetCircuitBreaker,
  clearTelemetryBuffer,
} from './telemetry-service';

describe('Telemetry Service Core', () => {
  beforeEach(() => {
    clearTelemetryBuffer();
  });

  it('records events into in-memory ring buffer', () => {
    const ev = recordTelemetryEvent({
      category: 'api_latency',
      metric_name: 'api.messages.send',
      severity: 'info',
      value: 120,
      metadata: { path: '/api/v1/messages' },
    });

    expect(ev.id).toBeDefined();
    expect(ev.category).toBe('api_latency');
    expect(ev.value).toBe(120);

    const recent = getRecentTelemetryEvents(10);
    expect(recent.length).toBe(1);
    expect(recent[0].metric_name).toBe('api.messages.send');
  });

  it('calculates latency percentiles correctly', () => {
    // Record multiple latency samples: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    for (let i = 1; i <= 10; i++) {
      recordTelemetryEvent({
        category: 'api_latency',
        metric_name: 'test.latency',
        severity: 'info',
        value: i * 10,
      });
    }

    const snapshot = getTelemetryMetricsSnapshot();
    expect(snapshot.kpis.latency.sample_count).toBe(10);
    expect(snapshot.kpis.latency.p50).toBeGreaterThanOrEqual(50);
    expect(snapshot.kpis.latency.p95).toBeGreaterThanOrEqual(90);
  });

  it('computes health index and adjusts status on high error rate', () => {
    // Inject 10 normal events and 5 critical failures (33% error rate)
    for (let i = 0; i < 10; i++) {
      recordTelemetryEvent({
        category: 'webhook_inbound',
        metric_name: 'wh.ok',
        severity: 'info',
        value: 200,
      });
    }
    for (let i = 0; i < 5; i++) {
      recordTelemetryEvent({
        category: 'webhook_error',
        metric_name: 'wh.fail',
        severity: 'critical',
        value: 500,
      });
    }

    const snapshot = getTelemetryMetricsSnapshot();
    expect(snapshot.kpis.error_rate_pct).toBeGreaterThan(20);
    expect(snapshot.health_index).toBeLessThan(85);
    expect(snapshot.status).not.toBe('healthy');
  });

  it('trips circuit breaker to open after 5 consecutive failures and resets', () => {
    for (let i = 0; i < 5; i++) {
      recordTelemetryEvent({
        category: 'meta_api',
        metric_name: 'meta.dispatch.error',
        severity: 'critical',
        value: 500,
      });
    }

    const snapshot = getTelemetryMetricsSnapshot();
    expect(snapshot.circuits.meta_api.state).toBe('open');
    expect(snapshot.circuits.meta_api.failure_count).toBe(5);

    // Reset circuit breaker
    resetCircuitBreaker('meta_api');
    const resetSnapshot = getTelemetryMetricsSnapshot();
    expect(resetSnapshot.circuits.meta_api.state).toBe('closed');
    expect(resetSnapshot.circuits.meta_api.failure_count).toBe(0);
  });
});
