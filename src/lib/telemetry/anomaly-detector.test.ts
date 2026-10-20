import { describe, it, expect } from 'vitest';
import { detectAnomalies } from './anomaly-detector';
import type { TelemetryEvent, TelemetryMetricsSnapshot } from './types';

function createMockSnapshot(overrides?: Partial<TelemetryMetricsSnapshot>): TelemetryMetricsSnapshot {
  return {
    health_index: 98,
    status: 'healthy',
    uptime_seconds: 3600,
    timestamp: new Date().toISOString(),
    kpis: {
      latency: { p50: 25, p95: 120, p99: 250, sample_count: 50 },
      error_rate_pct: 0.2,
      webhook_tps: 1.5,
      total_events_buffered: 50,
      total_events_today: 1200,
      remediations_executed_count: 2,
    },
    circuits: {
      meta_api: { service: 'meta_api', state: 'closed', failure_count: 0, last_failure_at: null, last_success_at: null },
      webhook_router: { service: 'webhook_router', state: 'closed', failure_count: 0, last_failure_at: null, last_success_at: null },
      database: { service: 'database', state: 'closed', failure_count: 0, last_failure_at: null, last_success_at: null },
      pagseguro: { service: 'pagseguro', state: 'closed', failure_count: 0, last_failure_at: null, last_success_at: null },
    },
    system_resources: {
      memory_used_mb: 280,
      memory_total_mb: 1200,
      memory_percent: 23,
      cpu_cores_active: 2,
    },
    ...overrides,
  };
}

describe('Telemetry Anomaly Detector', () => {
  it('detects webhook retry storm or signature forgery when threshold exceeded', () => {
    const events: TelemetryEvent[] = Array.from({ length: 7 }, (_, i) => ({
      category: 'webhook_error',
      metric_name: 'whatsapp.webhook.signature_invalid',
      severity: 'critical',
      value: 1,
      created_at: new Date(Date.now() - i * 1000).toISOString(),
    }));

    const anomalies = detectAnomalies(events, createMockSnapshot());
    const webhookAnomaly = anomalies.find((a) => a.rule_id === 'RULE_WEBHOOK_RETRY_STORM');

    expect(webhookAnomaly).toBeDefined();
    expect(webhookAnomaly?.severity).toBe('critical');
    expect(webhookAnomaly?.auto_remediation_available).toBe(true);
  });

  it('detects Meta API rate limit warning when 429 response recorded', () => {
    const events: TelemetryEvent[] = [
      {
        category: 'meta_api',
        metric_name: 'meta.dispatch.rate_limit',
        severity: 'warning',
        value: 429,
        created_at: new Date().toISOString(),
      },
    ];

    const anomalies = detectAnomalies(events, createMockSnapshot());
    const metaAnomaly = anomalies.find((a) => a.rule_id === 'RULE_META_RATE_LIMIT');

    expect(metaAnomaly).toBeDefined();
    expect(metaAnomaly?.title).toContain('API Meta');
  });

  it('detects latency degradation when P95 exceeds 1200ms', () => {
    const snapshot = createMockSnapshot({
      kpis: {
        latency: { p50: 250, p95: 1850, p99: 3100, sample_count: 100 },
        error_rate_pct: 0.5,
        webhook_tps: 1,
        total_events_buffered: 100,
        total_events_today: 500,
        remediations_executed_count: 0,
      },
    });

    const anomalies = detectAnomalies([], snapshot);
    const latencyAnomaly = anomalies.find((a) => a.rule_id === 'RULE_API_LATENCY_DEGRADATION');

    expect(latencyAnomaly).toBeDefined();
    expect(latencyAnomaly?.current_value).toBe(1850);
  });

  it('detects memory pressure when heap usage is above 85%', () => {
    const snapshot = createMockSnapshot({
      system_resources: {
        memory_used_mb: 1080,
        memory_total_mb: 1200,
        memory_percent: 90,
        cpu_cores_active: 2,
      },
    });

    const anomalies = detectAnomalies([], snapshot);
    const memAnomaly = anomalies.find((a) => a.rule_id === 'RULE_MEMORY_PRESSURE');

    expect(memAnomaly).toBeDefined();
    expect(memAnomaly?.current_value).toBe(90);
  });
});
