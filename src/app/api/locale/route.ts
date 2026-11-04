import { NextResponse } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, SUPPORTED_LOCALES } from "@/lib/locales";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let locale = typeof body.locale === "string" ? body.locale.trim() : "";

    // Normalize shorthand (e.g. "pt" -> "pt-BR")
    if (locale === "pt") locale = "pt-BR";

    const isSupported = SUPPORTED_LOCALES.some((l) => l.id === locale);
    if (!isSupported) {
      locale = DEFAULT_LOCALE;
    }

    const response = NextResponse.json({ ok: true, locale });

    // 1 year expiration
    const maxAge = 60 * 60 * 24 * 365;
    response.cookies.set({
      name: LOCALE_COOKIE_KEY,
      value: locale,
      path: "/",
      maxAge,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
