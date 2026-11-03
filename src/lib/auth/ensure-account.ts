// ============================================================
// Tenancy Self-Healing & Profile/Account Provisioning Service
//
// Automatically guarantees that any authenticated user in auth.users
// has a valid, readable row in `public.accounts` and `public.profiles`.
// Protects against missing profiles, broken foreign keys, or manual inserts.
// ============================================================

import { supabaseAdmin } from '@/lib/flows/admin-client';
import { isSuperAdminUser } from '@/lib/auth/super-admin-check';

export interface EnsureAccountResult {
  accountId: string;
  accountRole: 'owner' | 'admin' | 'agent' | 'viewer';
  isNewAccount: boolean;
  isNewProfile: boolean;
}

/**
 * Ensures an authenticated user has an active account and profile row.
 * Safe to call idempotently from any server component or API handler.
 */
export async function ensureAccountForUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): Promise<EnsureAccountResult | null> {
  const admin = supabaseAdmin();
  const userId = user.id;
  const email = (user.email || '').toLowerCase().trim();
  const fullName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    (email ? email.split('@')[0] : 'Workspace');

  try {
    // 1. Check existing profile
    const { data: existingProfile, error: profileErr } = await admin
      .from('profiles')
      .select('id, user_id, email, full_name, account_id, account_role, is_super_admin')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileErr) {
      console.error('[ensureAccountForUser] profile lookup error:', profileErr);
    }

    let accountId = existingProfile?.account_id as string | undefined;
    let isNewAccount = false;

    // 2. Validate that the referenced account actually exists in accounts
    if (accountId) {
      const { data: acc } = await admin
        .from('accounts')
        .select('id')
        .eq('id', accountId)
        .maybeSingle();

      if (!acc) {
        accountId = undefined;
      }
    }

    // 3. If missing account, check if an account owned by this user already exists
    if (!accountId) {
      const { data: ownedAccount } = await admin
        .from('accounts')
        .select('id')
        .eq('owner_user_id', userId)
        .maybeSingle();

      if (ownedAccount?.id) {
        accountId = ownedAccount.id;
      } else {
        // 4. Provision fresh account for user
        const accountName = fullName ? `${fullName}` : 'Meu Workspace';
        const { data: newAccount, error: createAccErr } = await admin
          .from('accounts')
          .insert({
            name: accountName,
            owner_user_id: userId,
            default_currency: 'BRL',
            allow_member_invites: true,
            max_members: 5,
          })
          .select('id')
          .single();

        if (createAccErr || !newAccount) {
          console.error('[ensureAccountForUser] Failed to create account:', createAccErr);
          return null;
        }
        accountId = newAccount.id;
        isNewAccount = true;
      }
    }

    const isSuper = isSuperAdminUser(user, existingProfile);
    let isNewProfile = false;

    // 5. Create or heal profile row
    if (existingProfile) {
      const updates: Record<string, unknown> = {};
      if (!existingProfile.account_id || existingProfile.account_id !== accountId) {
        updates.account_id = accountId;
        updates.account_role = 'owner';
      }
      if (isSuper && !existingProfile.is_super_admin) {
        updates.is_super_admin = true;
      }
      if (Object.keys(updates).length > 0) {
        await admin.from('profiles').update(updates).eq('id', existingProfile.id);
      }
    } else {
      const { error: insProfErr } = await admin.from('profiles').insert({
        user_id: userId,
        email: email,
        full_name: fullName,
        account_id: accountId,
        account_role: 'owner',
        role: 'user',
        is_super_admin: isSuper,
        approved: true,
      });

      if (insProfErr) {
        console.error('[ensureAccountForUser] Failed to insert profile:', insProfErr);
        return null;
      }
      isNewProfile = true;
    }

    if (!accountId) {
      return null;
    }

    return {
      accountId,
      accountRole: 'owner',
      isNewAccount,
      isNewProfile,
    };
  } catch (err) {
    console.error('[ensureAccountForUser] Unexpected error during tenancy healing:', err);
    return null;
  }
}
