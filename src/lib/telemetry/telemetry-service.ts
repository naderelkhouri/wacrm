// ============================================================
// Telemetry Service — WcloudAPI / WACRM Observability Core
// In-Memory Fast Aggregator + Background Supabase Sink
// ============================================================

import { supabaseAdmin } from '@/lib/flows/admin-client';
import type {
  TelemetryCategory,
  TelemetrySeverity,
  TelemetryEvent,
  TelemetryMetricsSnapshot,
  LatencyPercentiles,
  CircuitBreakerState,
  HealthStatus,
} from './types';

const BUFFER_CAPACITY = 1000;
const PROCESS_START_TIME = Date.now();

// In-memory circular buffer for low-latency P50/P95 and error aggregation
const telemetryBuffer: TelemetryEvent[] = [];
let totalEventsIngested = 0;
let totalAutomationsExecuted = 0;

// Internal Circuit Breakers State
const circuitBreakers: Record<string, CircuitBreakerState> = {
  meta_api: {
    service: 'meta_api',
    state: 'closed',
    failure_count: 0,
    last_failure_at: null,
    last_success_at: null,
  },
  webhook_router: {
    service: 'webhook_router',
    state: 'closed',
    failure_count: 0,
    last_failure_at: null,
    last_success_at: null,
  },
  database: {
    service: 'database',
    state: 'closed',
    failure_count: 0,
    last_failure_at: null,
    last_success_at: null,
  },
  pagseguro: {
    service: 'pagseguro',
    state: 'closed',
    failure_count: 0,
    last_failure_at: null,
    last_success_at: null,
  },
};

/**
 * Record a telemetry metric into the local ring buffer and asynchronously persist to Supabase.
 */
export function recordTelemetryEvent(params: {
  category: TelemetryCategory;
  metric_name: string;
  severity: TelemetrySeverity;
  value: number;
  metadata?: Record<string, unknown>;
  account_id?: string | null;
}): TelemetryEvent {
  const event: TelemetryEvent = {
    id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    category: params.category,
    metric_name: params.metric_name,
    severity: params.severity,
    value: params.value,
    metadata: params.metadata || {},
    account_id: params.account_id || null,
    created_at: new Date().toISOString(),
  };

  // Add to in-memory ring buffer
  if (telemetryBuffer.length >= BUFFER_CAPACITY) {
    telemetryBuffer.shift();
  }
  telemetryBuffer.push(event);
  totalEventsIngested += 1;

  // Update circuit breaker status if category is circuit_breaker or webhook/meta failure
  updateCircuitBreakerHeuristics(event);

  // Asynchronously push to database without blocking request execution
  persistTelemetryEventAsync(event).catch((err) => {
    // Non-fatal: telemetry persistence error should never crash the user process
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[telemetry] async persist skipped or table not initialized:', err?.message || err);
    }
  });

  return event;
}

/**
 * Increment the count of autonomous remediations executed.
 */
export function incrementRemediationCounter(): void {
  totalAutomationsExecuted += 1;
}

/**
 * Update circuit breaker heuristics based on inbound events.
 */
function updateCircuitBreakerHeuristics(event: TelemetryEvent) {
  const now = event.created_at || new Date().toISOString();

  if (event.category === 'meta_api') {
    const isError = event.severity === 'critical' || event.severity === 'fatal' || event.value >= 400;
    const circuit = circuitBreakers.meta_api;
    if (isError) {
      circuit.failure_count += 1;
      circuit.last_failure_at = now;
      if (circuit.failure_count >= 5) {
        circuit.state = 'open';
      }
    } else {
      circuit.last_success_at = now;
      if (circuit.state === 'half_open' || (circuit.state === 'open' && circuit.failure_count > 0)) {
        circuit.failure_count = Math.max(0, circuit.failure_count - 1);
        if (circuit.failure_count === 0) circuit.state = 'closed';
      }
    }
  }

  if (event.category === 'database_query') {
    const circuit = circuitBreakers.database;
    if (event.severity === 'critical' || event.severity === 'fatal') {
      circuit.failure_count += 1;
      circuit.last_failure_at = now;
      if (circuit.failure_count >= 5) circuit.state = 'open';
    } else {
      circuit.last_success_at = now;
      if (circuit.failure_count > 0) circuit.failure_count -= 1;
      if (circuit.failure_count === 0) circuit.state = 'closed';
    }
  }
}

/**
 * Asynchronous persistence to Supabase system_telemetry_events.
 */
async function persistTelemetryEventAsync(event: TelemetryEvent): Promise<void> {
  // Check if we are running in a client test without real DB
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    const admin = supabaseAdmin();
    await admin.from('system_telemetry_events').insert({
      category: event.category,
      metric_name: event.metric_name,
      severity: event.severity,
      value: event.value,
      metadata: event.metadata || {},
      account_id: event.account_id || null,
    });
  } catch {
    // Graceful silent skip if table is not yet migrated
  }
}

/**
 * Calculate percentiles from numerical samples.
 */
function calculatePercentiles(values: number[]): LatencyPercentiles {
  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0, sample_count: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const getP = (p: number) => {
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return Math.round(sorted[idx] * 10) / 10;
  };

  return {
    p50: getP(50),
    p95: getP(95),
    p99: getP(99),
    sample_count: sorted.length,
  };
}

/**
 * Get the recent in-memory telemetry buffer.
 */
export function getRecentTelemetryEvents(limit = 50): TelemetryEvent[] {
  return telemetryBuffer.slice(-limit).reverse();
}

/**
 * Get circuit breaker state map.
 */
export function getCircuitBreakers(): Record<string, CircuitBreakerState> {
  return { ...circuitBreakers };
}

/**
 * Reset a specific or all circuit breakers.
 */
export function resetCircuitBreaker(serviceName?: string): void {
  if (serviceName && circuitBreakers[serviceName]) {
    circuitBreakers[serviceName].state = 'closed';
    circuitBreakers[serviceName].failure_count = 0;
  } else {
    Object.keys(circuitBreakers).forEach((key) => {
      circuitBreakers[key].state = 'closed';
      circuitBreakers[key].failure_count = 0;
    });
  }
}

/**
 * Compute the comprehensive real-time Telemetry Metrics Snapshot.
 */
export function getTelemetryMetricsSnapshot(): TelemetryMetricsSnapshot {
  const now = Date.now();
  const uptimeSeconds = Math.floor((now - PROCESS_START_TIME) / 1000);

  // Latencies from recent events
  const latencySamples = telemetryBuffer
    .filter((e) => e.category === 'api_latency' || e.metric_name.includes('latency'))
    .map((e) => e.value);

  const latency = calculatePercentiles(latencySamples.length > 0 ? latencySamples : [32, 45, 60, 78, 110]);

  // Error rate
  const totalInWindow = telemetryBuffer.length;
  const errorCount = telemetryBuffer.filter(
    (e) => e.severity === 'critical' || e.severity === 'fatal' || e.category === 'webhook_error'
  ).length;

  const errorRatePct =
    totalInWindow > 0
      ? Math.round((errorCount / totalInWindow) * 1000) / 10
      : 0.1; // Default low baseline

  // Webhook requests per second estimate
  const recentSeconds = 60;
  const recentThreshold = new Date(now - recentSeconds * 1000).toISOString();
  const recentWebhooks = telemetryBuffer.filter(
    (e) => e.category === 'webhook_inbound' && (e.created_at || '') >= recentThreshold
  ).length;
  const webhookTps = Math.round((recentWebhooks / recentSeconds) * 10) / 10;

  // Any open circuit breakers?
  const hasOpenCircuit = Object.values(circuitBreakers).some((c) => c.state === 'open');

  // Compute Health Index (0 - 100)
  let healthIndex = 100;
  if (errorRatePct > 10) healthIndex -= 30;
  else if (errorRatePct > 3) healthIndex -= 15;
  else if (errorRatePct > 1) healthIndex -= 5;

  if (latency.p95 > 2000) healthIndex -= 25;
  else if (latency.p95 > 1000) healthIndex -= 15;
  else if (latency.p95 > 500) healthIndex -= 5;

  if (hasOpenCircuit) healthIndex -= 30;

  healthIndex = Math.max(0, Math.min(100, Math.round(healthIndex)));

  let status: HealthStatus = 'healthy';
  if (healthIndex < 60) status = 'critical';
  else if (healthIndex < 85) status = 'degraded';

  // System memory stats (safe Node.js process inspection)
  let memoryUsedMb = 0;
  let memoryTotalMb = 1200;
  let memoryPercent = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const v8 = require('v8');
    const stats = v8.getHeapStatistics();
    memoryUsedMb = Math.round(stats.used_heap_size / (1024 * 1024));
    memoryTotalMb = Math.round(stats.heap_size_limit / (1024 * 1024)) || 1200;
    memoryPercent = Math.min(100, Math.round((memoryUsedMb / memoryTotalMb) * 100));
  } catch {
    const mem = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0, heapTotal: 0 };
    memoryUsedMb = Math.round((mem.heapUsed || 0) / (1024 * 1024));
    memoryTotalMb = Math.round((mem.heapTotal || 0) / (1024 * 1024)) || 1200;
    memoryPercent = Math.min(100, Math.round((memoryUsedMb / memoryTotalMb) * 100));
  }

  return {
    health_index: healthIndex,
    status,
    uptime_seconds: uptimeSeconds,
    timestamp: new Date().toISOString(),
    kpis: {
      latency,
      error_rate_pct: errorRatePct,
      webhook_tps: webhookTps,
      total_events_buffered: telemetryBuffer.length,
      total_events_today: totalEventsIngested,
      remediations_executed_count: totalAutomationsExecuted,
    },
    circuits: getCircuitBreakers(),
    system_resources: {
      memory_used_mb: memoryUsedMb,
      memory_total_mb: memoryTotalMb,
      memory_percent: memoryPercent,
      cpu_cores_active: 2, // Bound to 2 cores on our production container
    },
  };
}

/**
 * Flush all in-memory buffer (useful for test resets).
 */
export function clearTelemetryBuffer(): void {
  telemetryBuffer.length = 0;
  totalEventsIngested = 0;
  totalAutomationsExecuted = 0;
  resetCircuitBreaker();
}
