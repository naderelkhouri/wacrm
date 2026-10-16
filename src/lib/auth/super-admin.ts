// ============================================================
// Super Admin / Platform Master Authentication Context
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import { UnauthorizedError, ForbiddenError } from './account';

export interface SuperAdminProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  is_super_admin: boolean;
  account_id: string;
}

export interface SuperAdminContext {
  user: User;
  profile: SuperAdminProfile;
  supabaseAdmin: SupabaseClient;
}

export { isSuperAdminUser, DEFAULT_SUPER_ADMIN_EMAILS } from './super-admin-check';
import { isSuperAdminUser } from './super-admin-check';

/**
 * Guard for server components and API routes requiring Platform Super Admin privileges.
 */
export async function requireSuperAdmin(): Promise<SuperAdminContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    throw new UnauthorizedError('Sessão expirada ou não autenticada.');
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, user_id, email, full_name, is_super_admin, account_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    throw new ForbiddenError('Perfil não encontrado.');
  }

  const hasAccess = isSuperAdminUser(user, profile);
  if (!hasAccess) {
    throw new ForbiddenError('Acesso restrito exclusivamente aos administradores da plataforma.');
  }

  return {
    user,
    profile: {
      ...profile,
      is_super_admin: true,
    },
    supabaseAdmin: supabaseAdmin(),
  };
}
