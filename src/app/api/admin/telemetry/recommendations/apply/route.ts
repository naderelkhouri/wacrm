// ============================================================
// POST /api/admin/telemetry/recommendations/apply
//
// Applies an automated optimization suggestion with 1 click.
// Guarded by requireSuperAdmin().
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';
import { applyRecommendation } from '@/lib/telemetry/recommendations-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.AUTOMATION_CRON_SECRET;
    let executorId: string | null = null;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      executorId = 'system';
    } else {
      const { user } = await requireSuperAdmin();
      executorId = user.id;
    }

    const body = await request.json().catch(() => ({}));
    const { recommendation_id } = body;

    if (!recommendation_id || typeof recommendation_id !== 'string') {
      return NextResponse.json(
        { error: 'Parâmetro `recommendation_id` obrigatório.' },
        { status: 400 }
      );
    }

    const result = await applyRecommendation(recommendation_id, executorId);

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.recommendation,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
