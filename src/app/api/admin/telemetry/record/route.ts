// ============================================================
// POST /api/admin/telemetry/record
//
// Ingests internal operational events and metrics from services.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';
import { recordTelemetryEvent } from '@/lib/telemetry/telemetry-service';
import type { TelemetryCategory, TelemetrySeverity } from '@/lib/telemetry/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Check SuperAdmin or Authorization Header
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.AUTOMATION_CRON_SECRET;

    let isAuthorized = false;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      try {
        await requireSuperAdmin();
        isAuthorized = true;
      } catch {
        isAuthorized = false;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { category, metric_name, severity, value, metadata, account_id } = body;

    if (!category || !metric_name || value === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: category, metric_name, value' },
        { status: 400 }
      );
    }

    const event = recordTelemetryEvent({
      category: category as TelemetryCategory,
      metric_name,
      severity: (severity || 'info') as TelemetrySeverity,
      value: Number(value),
      metadata: metadata || {},
      account_id: account_id || null,
    });

    return NextResponse.json({ success: true, data: event });
  } catch (err) {
    return toErrorResponse(err);
  }
}
