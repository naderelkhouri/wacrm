// ============================================================
// POST /api/admin/telemetry/actions/execute
//
// Triggers an autonomous or manual self-healing remediation.
// Guarded by requireSuperAdmin().
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';
import { executeRemediation } from '@/lib/telemetry/auto-remediator';
import type { RemediationAction } from '@/lib/telemetry/types';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS: RemediationAction['action_type'][] = [
  'unstick_stalled_broadcasts',
  'reset_circuit_breaker',
  'purge_ephemeral_cache',
  'apply_meta_rate_throttle',
  'optimize_database_pools',
  'run_diagnostic_benchmark',
];

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.AUTOMATION_CRON_SECRET;
    let executorId: string | null = null;
    let executorEmail = 'system_automation';

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      executorId = 'system';
      executorEmail = 'automation_cron';
    } else {
      const { user } = await requireSuperAdmin();
      executorId = user.id;
      executorEmail = user.email || 'admin';
    }

    const body = await request.json().catch(() => ({}));
    const { action_type, reason, dry_run = false } = body;

    if (!action_type || !VALID_ACTIONS.includes(action_type)) {
      return NextResponse.json(
        {
          error: `Ação inválida. Ações permitidas: ${VALID_ACTIONS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const remediation = await executeRemediation({
      action_type,
      trigger_type: executorId === 'system' ? 'automated' : 'manual',
      reason: reason || `Execução pelo operador/serviço (${executorEmail})`,
      executed_by: executorId,
      dry_run: Boolean(dry_run),
    });

    return NextResponse.json({
      success: true,
      message: `Ação '${action_type}' executada com status: ${remediation.status}.`,
      data: remediation,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
