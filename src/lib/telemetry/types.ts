// ============================================================
// Telemetry & Self-Healing Types — WcloudAPI / WACRM
// ============================================================

export type TelemetryCategory =
  | 'api_latency'
  | 'webhook_inbound'
  | 'webhook_error'
  | 'database_query'
  | 'meta_api'
  | 'system_resource'
  | 'broadcast_queue'
  | 'billing'
  | 'circuit_breaker';

export type TelemetrySeverity = 'info' | 'warning' | 'critical' | 'fatal';

export interface TelemetryEvent {
  id?: string;
  category: TelemetryCategory;
  metric_name: string;
  severity: TelemetrySeverity;
  value: number; // latency (ms), count, percentage, etc.
  metadata?: Record<string, unknown>;
  account_id?: string | null;
  created_at?: string;
}

export type HealthStatus = 'healthy' | 'degraded' | 'critical';

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  sample_count: number;
}

export interface CircuitBreakerState {
  service: 'meta_api' | 'webhook_router' | 'database' | 'pagseguro';
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  last_failure_at: string | null;
  last_success_at: string | null;
}

export interface TelemetryMetricsSnapshot {
  health_index: number; // 0 - 100
  status: HealthStatus;
  uptime_seconds: number;
  timestamp: string;
  kpis: {
    latency: LatencyPercentiles;
    error_rate_pct: number;
    webhook_tps: number;
    total_events_buffered: number;
    total_events_today: number;
    remediations_executed_count: number;
  };
  circuits: Record<string, CircuitBreakerState>;
  system_resources: {
    memory_used_mb: number;
    memory_total_mb: number;
    memory_percent: number;
    cpu_cores_active: number;
  };
}

export interface TelemetryAnomaly {
  id: string;
  rule_id: string;
  title: string;
  description: string;
  severity: TelemetrySeverity;
  metric_name: string;
  current_value: number;
  threshold_value: number;
  detected_at: string;
  recommended_remediation: string;
  auto_remediation_available: boolean;
}

export type RemediationTriggerType = 'automated' | 'manual' | 'scheduled';
export type RemediationStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'rolled_back';

export interface RemediationAction {
  id?: string;
  trigger_type: RemediationTriggerType;
  action_type:
    | 'unstick_stalled_broadcasts'
    | 'reset_circuit_breaker'
    | 'purge_ephemeral_cache'
    | 'apply_meta_rate_throttle'
    | 'optimize_database_pools'
    | 'run_diagnostic_benchmark';
  status: RemediationStatus;
  target_service: string;
  reason: string;
  execution_log?: Record<string, unknown>;
  executed_by?: string | null;
  created_at?: string;
  completed_at?: string | null;
}

export type RecommendationImpact = 'low' | 'medium' | 'high' | 'critical';
export type RecommendationStatus = 'active' | 'applied' | 'dismissed';

export interface OptimizationRecommendation {
  id: string;
  rule_id: string;
  title: string;
  description: string;
  impact: RecommendationImpact;
  auto_executable: boolean;
  action_type?: string;
  action_payload?: Record<string, unknown>;
  status: RecommendationStatus;
  estimated_gain: string;
  created_at: string;
  resolved_at?: string | null;
}
