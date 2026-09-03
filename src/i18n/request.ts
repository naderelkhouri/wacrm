import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, SUPPORTED_LOCALES } from '@/lib/locales';

export default getRequestConfig(async () => {
  let locale = DEFAULT_LOCALE;

  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE_KEY)?.value;
    if (cookieLocale) {
      locale = cookieLocale;
    } else if (process.env.NEXT_PUBLIC_APP_LOCALE) {
      locale = process.env.NEXT_PUBLIC_APP_LOCALE;
    }
  } catch {
    // If called outside request headers context (e.g. static export)
    if (process.env.NEXT_PUBLIC_APP_LOCALE) {
      locale = process.env.NEXT_PUBLIC_APP_LOCALE;
    }
  }

  // Normalize shorthand e.g. "pt" -> "pt-BR"
  if (locale === 'pt') locale = 'pt-BR';

  // Validate against supported locales
  const isSupported = SUPPORTED_LOCALES.some((l) => l.id === locale);
  if (!isSupported) {
    locale = DEFAULT_LOCALE;
  }

  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    // Fallback hierarchy: pt-BR -> en
    try {
      messages = (await import(`../../messages/pt-BR.json`)).default;
    } catch {
      messages = (await import(`../../messages/en.json`)).default;
    }
  }

  return {
    locale,
    messages,
  };
});
