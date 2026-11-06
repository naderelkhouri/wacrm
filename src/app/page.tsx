import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isTokenValid, DJANGO_ACCESS_COOKIE } from "@/lib/auth/django-token";
import { CyberLanding } from "@/components/landing/cyber-landing";

export default async function RootPage() {
  const locale = await getLocale();
  let isAuthenticated = false;

  try {
    const cookieStore = await cookies();
    const hasDjangoAuth = isTokenValid(
      cookieStore.get(DJANGO_ACCESS_COOKIE)?.value
    );
    if (hasDjangoAuth) {
      isAuthenticated = true;
    } else {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      isAuthenticated = Boolean(user);
    }
  } catch {
    isAuthenticated = false;
  }

  return (
    <CyberLanding initialLocale={locale} isAuthenticated={isAuthenticated} />
  );
}
