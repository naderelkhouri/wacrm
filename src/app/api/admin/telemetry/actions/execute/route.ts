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
    const { user } = await requireSuperAdmin();

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
      trigger_type: 'manual',
      reason: reason || `Execução manual pelo administrador ${user.email}`,
      executed_by: user.id,
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
