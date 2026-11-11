// ============================================================
// GET/POST /api/admin/telemetry/cron
//
// Automated Telemetry & Self-Healing Sentinel for WCloudAPI
// Runs periodically (e.g. every 2 minutes via cron or webhook)
// to audit live WhatsApp nodes, measure DB latency, detect anomalies,
// execute autonomous remediations, and purge stale telemetry logs.
// ============================================================

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import {
  recordTelemetryEvent,
  getTelemetryMetricsSnapshot,
  getRecentTelemetryEvents,
} from '@/lib/telemetry/telemetry-service';
import { detectAnomalies } from '@/lib/telemetry/anomaly-detector';
import { executeRemediation } from '@/lib/telemetry/auto-remediator';
import { decrypt } from '@/lib/whatsapp/encryption';
import { verifyUazapiInstance } from '@/lib/whatsapp/uazapi';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import type { RemediationAction } from '@/lib/telemetry/types';

export const dynamic = 'force-dynamic';

function isCronAuthorized(request: Request): boolean {
  const expectedSecret = process.env.AUTOMATION_CRON_SECRET;
  if (!expectedSecret) return false;

  const headerSecret = request.headers.get('x-cron-secret') || '';
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  const supplied = headerSecret || bearerToken;
  if (!supplied) return false;

  const suppliedBuf = Buffer.from(supplied);
  const expectedBuf = Buffer.from(expectedSecret);

  return (
    suppliedBuf.length === expectedBuf.length &&
    timingSafeEqual(suppliedBuf, expectedBuf)
  );
}

export async function GET(request: Request) {
  return handleTelemetryCron(request);
}

export async function POST(request: Request) {
  return handleTelemetryCron(request);
}

async function handleTelemetryCron(request: Request) {
  const startTime = Date.now();
  let authorized = isCronAuthorized(request);

  if (!authorized) {
    try {
      await requireSuperAdmin();
      authorized = true;
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const results: {
    whatsapp_instances_checked: number;
    whatsapp_healthy: number;
    whatsapp_offline: number;
    db_ping_ms: number;
    stalled_broadcasts_detected: number;
    anomalies_detected: number;
    remediations_executed: Array<{ action_type: string; status: string; reason: string }>;
    events_pruned: number;
    execution_time_ms: number;
  } = {
    whatsapp_instances_checked: 0,
    whatsapp_healthy: 0,
    whatsapp_offline: 0,
    db_ping_ms: 0,
    stalled_broadcasts_detected: 0,
    anomalies_detected: 0,
    remediations_executed: [],
    events_pruned: 0,
    execution_time_ms: 0,
  };

  // -------------------------------------------------------------
  // Phase 1: Database Latency Telemetry Ping
  // -------------------------------------------------------------
  try {
    const t0 = performance.now();
    await admin.from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
    const dbPing = Math.round(performance.now() - t0);
    results.db_ping_ms = dbPing;

    recordTelemetryEvent({
      category: 'database_query',
      metric_name: 'db.ping.latency_ms',
      severity: dbPing > 800 ? 'warning' : 'info',
      value: dbPing,
      metadata: { target: 'supabase_postgres', ping_ms: dbPing },
    });
  } catch (dbErr: unknown) {
    recordTelemetryEvent({
      category: 'database_query',
      metric_name: 'db.ping.error',
      severity: 'critical',
      value: 0,
      metadata: { error: dbErr instanceof Error ? dbErr.message : String(dbErr) },
    });
  }

  // -------------------------------------------------------------
  // Phase 2: Active WhatsApp / Uazapi Instances Live Health Check
  // -------------------------------------------------------------
  try {
    const { data: configs } = await admin
      .from('whatsapp_config')
      .select('id, account_id, provider, api_url, instance_name, phone_number_id, access_token, access_token_encrypted')
      .limit(20);

    if (configs && configs.length > 0) {
      for (const cfg of configs) {
        results.whatsapp_instances_checked += 1;
        const encrypted = (cfg.access_token_encrypted || cfg.access_token) as string | undefined;

        if (!encrypted) continue;

        let token = '';
        try {
          token = decrypt(encrypted);
        } catch {
          recordTelemetryEvent({
            category: 'meta_api',
            metric_name: 'whatsapp.instance.status',
            severity: 'critical',
            value: 0,
            account_id: cfg.account_id,
            metadata: {
              config_id: cfg.id,
              error: 'Token decryption failed',
              status: 'token_corrupted',
            },
          });
          results.whatsapp_offline += 1;
          continue;
        }

        const tStart = performance.now();
        if (cfg.provider === 'uazapi' && cfg.api_url) {
          try {
            const uazInfo = await verifyUazapiInstance({
              apiUrl: cfg.api_url,
              instanceToken: token,
              instanceName: cfg.instance_name || null,
              fallbackPhoneId: cfg.phone_number_id,
            });

            const latency = Math.round(performance.now() - tStart);
            const isConnected = uazInfo.quality_rating === 'GREEN';

            if (isConnected) {
              results.whatsapp_healthy += 1;
              recordTelemetryEvent({
                category: 'meta_api',
                metric_name: 'whatsapp.instance.status',
                severity: 'info',
                value: latency,
                account_id: cfg.account_id,
                metadata: {
                  provider: 'uazapi',
                  instanceName: cfg.instance_name,
                  phone: uazInfo.display_phone_number,
                  verified_name: uazInfo.verified_name,
                  status: 'connected',
                  latency_ms: latency,
                },
              });
            } else {
              results.whatsapp_offline += 1;
              recordTelemetryEvent({
                category: 'meta_api',
                metric_name: 'whatsapp.instance.status',
                severity: 'critical',
                value: 0,
                account_id: cfg.account_id,
                metadata: {
                  provider: 'uazapi',
                  instanceName: cfg.instance_name,
                  status: 'disconnected',
                  latency_ms: latency,
                },
              });
            }
          } catch (uazErr: unknown) {
            results.whatsapp_offline += 1;
            recordTelemetryEvent({
              category: 'meta_api',
              metric_name: 'whatsapp.instance.status',
              severity: 'critical',
              value: 0,
              account_id: cfg.account_id,
              metadata: {
                provider: 'uazapi',
                instanceName: cfg.instance_name,
                error: uazErr instanceof Error ? uazErr.message : String(uazErr),
                status: 'error',
              },
            });
          }
        }
      }
    }
  } catch (instErr: unknown) {
    console.warn('[telemetry-cron] Instance health check warning:', instErr);
  }

  // -------------------------------------------------------------
  // Phase 3: Stalled Broadcast Queue Detection
  // -------------------------------------------------------------
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuck } = await admin
      .from('broadcast_campaigns')
      .select('id, name')
      .eq('status', 'sending')
      .lt('updated_at', tenMinAgo);

    if (stuck && stuck.length > 0) {
      results.stalled_broadcasts_detected = stuck.length;
      recordTelemetryEvent({
        category: 'broadcast_queue',
        metric_name: 'broadcast.stalled',
        severity: 'warning',
        value: stuck.length,
        metadata: { campaign_ids: stuck.map((c) => c.id) },
      });
    }
  } catch {
    // Graceful skip
  }

  // -------------------------------------------------------------
  // Phase 4: Real-time Anomaly Detection
  // -------------------------------------------------------------
  const snapshot = getTelemetryMetricsSnapshot();
  const recentEvents = getRecentTelemetryEvents(50);
  const anomalies = detectAnomalies(recentEvents, snapshot);
  results.anomalies_detected = anomalies.length;

  // -------------------------------------------------------------
  // Phase 5: Automated Self-Healing (Remediation)
  // -------------------------------------------------------------
  for (const anomaly of anomalies) {
    if (!anomaly.auto_remediation_available) continue;

    let targetAction: RemediationAction['action_type'] | null = null;
    if (anomaly.rule_id === 'RULE_BROADCAST_STALLED') {
      targetAction = 'unstick_stalled_broadcasts';
    } else if (anomaly.rule_id === 'RULE_WEBHOOK_RETRY_STORM' || anomaly.rule_id === 'RULE_META_RATE_LIMIT') {
      targetAction = 'reset_circuit_breaker';
    } else if (anomaly.rule_id === 'RULE_MEMORY_PRESSURE' || anomaly.rule_id === 'RULE_API_LATENCY_DEGRADATION') {
      targetAction = 'purge_ephemeral_cache';
    } else if (anomaly.rule_id === 'RULE_DB_LATENCY_SPIKE') {
      targetAction = 'optimize_database_pools';
    } else if (anomaly.rule_id === 'RULE_WHATSAPP_INSTANCE_OFFLINE') {
      targetAction = 'reset_circuit_breaker';
    }

    if (targetAction) {
      try {
        const remediation = await executeRemediation({
          action_type: targetAction,
          trigger_type: 'automated',
          reason: anomaly.description,
          executed_by: null,
        });

        results.remediations_executed.push({
          action_type: targetAction,
          status: remediation.status,
          reason: anomaly.title,
        });
      } catch (remErr: unknown) {
        console.warn(`[telemetry-cron] Auto-remediation '${targetAction}' cooldown or skip:`, remErr);
      }
    }
  }

  // -------------------------------------------------------------
  // Phase 6: Retention Housekeeping (Purge events older than 14 days)
  // -------------------------------------------------------------
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('system_telemetry_events')
      .delete({ count: 'exact' })
      .lt('created_at', fourteenDaysAgo);

    results.events_pruned = count || 0;
  } catch {
    // Non-fatal housekeeping
  }

  results.execution_time_ms = Date.now() - startTime;

  return NextResponse.json({
    success: true,
    message: 'Telemetria e auto-remediação concluídas com sucesso.',
    timestamp: new Date().toISOString(),
    metrics: results,
    health_snapshot: getTelemetryMetricsSnapshot(),
  });
}
