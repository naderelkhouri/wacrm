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
  {
    id: "ko",
    name: "Korean",
    nativeName: "한국어",
    flag: "🇰🇷",
    short: "KO",
  },
] as const;

export const DEFAULT_LOCALE = "pt-BR";
export const LOCALE_COOKIE_KEY = "NEXT_LOCALE";
export const LOCALE_STORAGE_KEY = "wacrm_locale";

/**
 * Set the user's active locale across cookie, localStorage and reload.
 */
export function setLocalePreference(localeId: string) {
  if (typeof window === "undefined") return;

  // Set cookie with 1 year expiration
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(
    localeId
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, localeId);
  } catch {}

  // Hard reload to re-run next-intl server components with the new locale
  window.location.reload();
}
