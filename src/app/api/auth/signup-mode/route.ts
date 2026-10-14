import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/auth/invitations";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

export type SignupMode = "open" | "invite_only" | "closed";

function isValidSignupMode(mode: unknown): mode is SignupMode {
  return mode === "open" || mode === "invite_only" || mode === "closed";
}

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`signupMode:${ip}`, RATE_LIMITS.signupMode);
  if (!limit.success) return rateLimitResponse(limit);

  const url = new URL(request.url);
  const inviteToken = url.searchParams.get("invite")?.trim();

  // 1. Check environment variable override
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
    // 2. Fetch from platform_settings table in database
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "signup_mode")
        .maybeSingle();

      if (!error && data?.value && typeof data.value === "object") {
        const rawMode = (data.value as { mode?: unknown }).mode;
        if (isValidSignupMode(rawMode)) {
          mode = rawMode;
        }
      }
    } catch (err) {
      console.warn("[GET /api/auth/signup-mode] fallback to open due to error:", err);
    }
  }

  // 3. If an invite token was passed, check its validity
  let inviteStatus: {
    valid: boolean;
    role?: string;
    expired?: boolean;
    alreadyAccepted?: boolean;
  } | null = null;

  if (inviteToken) {
    try {
      const supabase = await createClient();
      const tokenHash = hashInviteToken(inviteToken);
      const { data: inv, error: invErr } = await supabase
        .from("account_invitations")
        .select("role, expires_at, accepted_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (!invErr && inv) {
        const isExpired = new Date(inv.expires_at).getTime() <= Date.now();
        const isAccepted = Boolean(inv.accepted_at);
        inviteStatus = {
          valid: !isExpired && !isAccepted,
          role: inv.role,
          expired: isExpired,
          alreadyAccepted: isAccepted,
        };
      } else {
        inviteStatus = { valid: false };
      }
    } catch (err) {
      console.warn("[GET /api/auth/signup-mode] invite validation error:", err);
      inviteStatus = { valid: false };
    }
  }

  return NextResponse.json({
    mode,
    source,
    lockedByEnv,
    invite: inviteStatus,
  });
}
