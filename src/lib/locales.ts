export interface LocaleOption {
  id: string;
  name: string;
  nativeName: string;
  flag: string;
  short: string;
}

export const SUPPORTED_LOCALES: readonly LocaleOption[] = [
  {
    id: "pt-BR",
    name: "Portuguese (Brazil)",
    nativeName: "Português (Brasil)",
    flag: "🇧🇷",
    short: "PT",
  },
  {
    id: "en",
    name: "English (US)",
    nativeName: "English",
    flag: "🇺🇸",
    short: "EN",
  },
  {
    id: "es",
    name: "Spanish",
    nativeName: "Español",
    flag: "🇪🇸",
    short: "ES",
  },
] as const;

export const DEFAULT_LOCALE = "pt-BR";
export const LOCALE_COOKIE_KEY = "NEXT_LOCALE";
export const LOCALE_STORAGE_KEY = "wacrm_locale";

/**
 * Set the user's active locale across cookie, localStorage and reload.
 * Synchronizes with /api/locale to ensure Next.js App Router server components
 * and Edge middleware receive the authoritative Set-Cookie response header.
 */
export async function setLocalePreference(localeId: string): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. Client-side fallback cookie
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(
    localeId
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, localeId);
  } catch {}

  // 2. Authoritative server cookie via API route
  try {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: localeId }),
    });
  } catch {
    // Proceed with reload even if fetch fails
  }

  // 3. Hard reload to render all Server and Client components with the new locale
  window.location.reload();
}
