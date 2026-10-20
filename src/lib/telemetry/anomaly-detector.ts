// ============================================================
// Telemetry Anomaly Detector — WcloudAPI / WACRM
// Real-time detection of operational incidents & performance drifts
// ============================================================

import type { TelemetryEvent, TelemetryAnomaly, TelemetryMetricsSnapshot } from './types';

export interface AnomalyDetectionRule {
  rule_id: string;
  title: string;
  severity: 'warning' | 'critical' | 'fatal';
  check: (events: TelemetryEvent[], snapshot: TelemetryMetricsSnapshot) => TelemetryAnomaly | null;
}

export const ANOMALY_RULES: AnomalyDetectionRule[] = [
  // 1. Webhook Signature Forgery or Retry Storm
  {
    rule_id: 'RULE_WEBHOOK_RETRY_STORM',
    title: 'Pico de Falhas ou Tentativas no Webhook WhatsApp',
    severity: 'critical',
    check: (events) => {
      const webhookErrors = events.filter(
        (e) => e.category === 'webhook_error' || (e.category === 'webhook_inbound' && e.severity === 'critical')
      );
      if (webhookErrors.length >= 6) {
        return {
          id: `anom_wh_${Date.now()}`,
          rule_id: 'RULE_WEBHOOK_RETRY_STORM',
          title: 'Sobrecarga de Erros no Webhook Meta WhatsApp',
          description: `Detectados ${webhookErrors.length} erros recentes de assinatura ou parsing de webhook. Possível chave desatualizada ou flood de eventos.`,
          severity: 'critical',
          metric_name: 'whatsapp.webhook.error_count',
          current_value: webhookErrors.length,
          threshold_value: 5,
          detected_at: new Date().toISOString(),
          recommended_remediation: 'Ativar amortecimento de webhook e validar segredo da Meta.',
          auto_remediation_available: true,
        };
      }
      return null;
    },
  },

  // 2. Meta Cloud API Rate Limit Pressure or Latency Degradation
  {
    rule_id: 'RULE_META_RATE_LIMIT',
    title: 'Aproximação de Rate Limit ou Degradação na API Meta',
    severity: 'warning',
    check: (events, snapshot) => {
      const metaEvents = events.filter((e) => e.category === 'meta_api');
      const rateLimitWarnings = metaEvents.filter((e) => e.value === 429 || e.value === 130429);
      const isCircuitOpen = snapshot.circuits.meta_api?.state === 'open';

      if (rateLimitWarnings.length > 0 || isCircuitOpen) {
        return {
          id: `anom_meta_${Date.now()}`,
          rule_id: 'RULE_META_RATE_LIMIT',
          title: 'Alerta de Saturação na API Meta WhatsApp',
          description: isCircuitOpen
            ? 'Circuito da API Meta aberto após consecutivas falhas. Disparos suspensos temporariamente para proteção.'
            : `Detectadas respostas de rate limit (HTTP 429 / Meta Code 130429).`,
          severity: isCircuitOpen ? 'critical' : 'warning',
          metric_name: 'meta.api.rate_limit_hits',
          current_value: rateLimitWarnings.length || 1,
          threshold_value: 1,
          detected_at: new Date().toISOString(),
          recommended_remediation: 'Ativar throttle adaptativo e espaçar envios em fila.',
          auto_remediation_available: true,
        };
      }
      return null;
    },
  },

  // 3. API High Latency Degradation
  {
    rule_id: 'RULE_API_LATENCY_DEGRADATION',
    title: 'Degradação de Latência P95 na API',
    severity: 'warning',
    check: (_, snapshot) => {
      const p95 = snapshot.kpis.latency.p95;
      if (p95 > 1200) {
        return {
          id: `anom_lat_${Date.now()}`,
          rule_id: 'RULE_API_LATENCY_DEGRADATION',
          title: 'Latência Elevada de Requisições (P95 > 1.2s)',
          description: `O percentil P95 de latência atingiu ${p95}ms, ultrapassando o limiar de conforto operacional (1200ms).`,
          severity: p95 > 2500 ? 'critical' : 'warning',
          metric_name: 'api.latency.p95',
          current_value: p95,
          threshold_value: 1200,
          detected_at: new Date().toISOString(),
          recommended_remediation: 'Expurgar cache temporário e otimizar queries lentas do banco.',
          auto_remediation_available: true,
        };
      }
      return null;
    },
  },

  // 4. Memory Heap Saturation
  {
    rule_id: 'RULE_MEMORY_PRESSURE',
    title: 'Pressão de Memória no Node.js Runtime',
    severity: 'warning',
    check: (_, snapshot) => {
      const memPct = snapshot.system_resources.memory_percent;
      if (memPct >= 85) {
        return {
          id: `anom_mem_${Date.now()}`,
          rule_id: 'RULE_MEMORY_PRESSURE',
          title: 'Pressão Excessiva de Memória Heap (> 85%)',
          description: `Consumo de memória Node.js atingiu ${memPct}% do limite configurado (${snapshot.system_resources.memory_used_mb}MB / ${snapshot.system_resources.memory_total_mb}MB).`,
          severity: memPct > 92 ? 'critical' : 'warning',
          metric_name: 'system.memory.percent',
          current_value: memPct,
          threshold_value: 85,
          detected_at: new Date().toISOString(),
          recommended_remediation: 'Executar expurgo de cache efêmero e forçar garbage collection.',
          auto_remediation_available: true,
        };
      }
      return null;
    },
  },

  // 5. Database Query Latency or Pool Contention
  {
    rule_id: 'RULE_DB_LATENCY_SPIKE',
    title: 'Contenção ou Lentidão em Consultas PostgreSQL',
    severity: 'warning',
    check: (events) => {
      const dbEvents = events.filter((e) => e.category === 'database_query');
      const slowQueries = dbEvents.filter((e) => e.value > 800);
      if (slowQueries.length >= 3) {
        return {
          id: `anom_db_${Date.now()}`,
          rule_id: 'RULE_DB_LATENCY_SPIKE',
          title: 'Consultas Lentas Detectadas no Banco de Dados',
          description: `${slowQueries.length} consultas recentes excederam 800ms de execução. Risco de fila de espera em conexões.`,
          severity: 'warning',
          metric_name: 'db.query.slow_count',
          current_value: slowQueries.length,
          threshold_value: 3,
          detected_at: new Date().toISOString(),
          recommended_remediation: 'Executar otimização de índices sugeridos e recarregar pool.',
          auto_remediation_available: true,
        };
      }
      return null;
    },
  },
];

/**
 * Scan recent events and telemetry snapshot to identify active anomalies.
 */
export function detectAnomalies(
  events: TelemetryEvent[],
  snapshot: TelemetryMetricsSnapshot
): TelemetryAnomaly[] {
  const anomalies: TelemetryAnomaly[] = [];

  for (const rule of ANOMALY_RULES) {
    try {
      const anomaly = rule.check(events, snapshot);
      if (anomaly) {
        anomalies.push(anomaly);
      }
    } catch {
      // Rule failure must not abort detection
    }
  }

  return anomalies;
}
