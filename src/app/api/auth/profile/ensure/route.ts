// ============================================================
// POST /api/auth/profile/ensure
//
// Endpoint called to ensure the current authenticated user's profile
// and workspace account are properly linked and provisioned.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureAccountForUser } from '@/lib/auth/ensure-account';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await ensureAccountForUser(user);
    if (!result) {
      return NextResponse.json(
        { error: 'Failed to ensure account context.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      accountId: result.accountId,
      accountRole: result.accountRole,
      isNewAccount: result.isNewAccount,
      isNewProfile: result.isNewProfile,
    });
  } catch (error) {
    console.error('Error in /api/auth/profile/ensure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
