import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { toErrorResponse } from "@/lib/auth/account";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

export type SignupMode = "open" | "invite_only" | "closed";

function isValidSignupMode(mode: unknown): mode is SignupMode {
  return mode === "open" || mode === "invite_only" || mode === "closed";
}

export async function GET() {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();

    const envMode = (
      process.env.SIGNUP_MODE || process.env.NEXT_PUBLIC_SIGNUP_MODE
    )?.toLowerCase()?.trim();

    let mode: SignupMode = "open";
    let source: "env" | "database" = "database";
    let lockedByEnv = false;

    if (isValidSignupMode(envMode)) {
      mode = envMode;
      source = "env";
      lockedByEnv = true;
    } else {
      const { data, error } = await supabaseAdmin
        .from("platform_settings")
        .select("value, updated_at, updated_by")
        .eq("key", "signup_mode")
        .maybeSingle();

      if (error) {
        console.error("[GET /api/admin/platform-settings] error:", error);
      } else if (data?.value && typeof data.value === "object") {
        const rawMode = (data.value as { mode?: unknown }).mode;
        if (isValidSignupMode(rawMode)) {
          mode = rawMode;
        }
      }
    }

    return NextResponse.json({
      mode,
      source,
      lockedByEnv,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, supabaseAdmin } = await requireSuperAdmin();

    const limit = checkRateLimit(
      `admin:platformSettings:${user.id}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const envMode = (
      process.env.SIGNUP_MODE || process.env.NEXT_PUBLIC_SIGNUP_MODE
    )?.toLowerCase()?.trim();

    if (isValidSignupMode(envMode)) {
      return NextResponse.json(
        {
          error:
            "O modo de cadastro está travado via variável de ambiente (SIGNUP_MODE na infraestrutura). Modifique o .env/Docker Swarm para alterar.",
        },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { mode?: unknown }
      | null;

    const mode = body?.mode;
    if (!isValidSignupMode(mode)) {
      return NextResponse.json(
        { error: "Modo inválido. Opções permitidas: 'open', 'invite_only', 'closed'." },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("platform_settings")
      .upsert(
        {
          key: "signup_mode",
          value: { mode },
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: "key" },
      );

    if (error) {
      console.error("[PATCH /api/admin/platform-settings] error:", error);
      return NextResponse.json(
        { error: "Falha ao salvar configuração global da plataforma." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      mode,
      source: "database",
      lockedByEnv: false,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
