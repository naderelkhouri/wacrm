// ============================================================
// Client-safe Super Admin check helper
// Free of any server-only imports (e.g. next/headers).
// ============================================================

export const DEFAULT_SUPER_ADMIN_EMAILS = [
  'admin@admx.tech',
  'nader.admx@gmail.com',
  'nader@admx.tech',
  'progredindosempre@gmail.com',
];

/**
 * Check if a user/profile qualifies as a Platform Super Admin.
 * Can safely be run in both browser and server environments.
 */
export function isSuperAdminUser(
  user: { email?: string | null } | null,
  profile: { is_super_admin?: boolean | null; email?: string | null } | null
): boolean {
  if (profile?.is_super_admin === true) {
    return true;
  }

  const email = (user?.email || profile?.email || '').toLowerCase().trim();
  if (!email) return false;

  const envList = (
    process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS ||
    process.env.PLATFORM_ADMIN_EMAILS ||
    ''
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const allowedEmails = new Set([
    ...DEFAULT_SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...envList,
  ]);

  return allowedEmails.has(email);
}
