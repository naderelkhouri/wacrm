// ============================================================
// GET /api/admin/telemetry
//
// Telemetry & Observability Master Endpoint for Super Admins.
// Returns real-time metrics, detected anomalies, remediation history,
// and actionable optimization recommendations.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';
import {
  getTelemetryMetricsSnapshot,
  getRecentTelemetryEvents,
} from '@/lib/telemetry/telemetry-service';
import { detectAnomalies } from '@/lib/telemetry/anomaly-detector';
import { getRemediationHistory } from '@/lib/telemetry/auto-remediator';
import { getOptimizationRecommendations } from '@/lib/telemetry/recommendations-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireSuperAdmin();

    const snapshot = getTelemetryMetricsSnapshot();
    const recentEvents = getRecentTelemetryEvents(50);
    const anomalies = detectAnomalies(recentEvents, snapshot);
    const remediationHistory = getRemediationHistory(20);
    const recommendations = getOptimizationRecommendations(snapshot, recentEvents);

    return NextResponse.json({
      success: true,
      data: {
        snapshot,
        anomalies,
        recent_events: recentEvents,
        remediation_history: remediationHistory,
        recommendations,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
