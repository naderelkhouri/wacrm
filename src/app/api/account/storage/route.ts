import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user profile to determine account_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile?.account_id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Fetch or create storage settings
  const { data: settings } = await supabase
    .from("account_storage_settings")
    .select("*")
    .eq("account_id", profile.account_id)
    .maybeSingle();

  // Fetch usage stats via RPC
  const { data: usage } = await supabase.rpc("get_account_storage_usage", {
    p_account_id: profile.account_id,
  });

  return NextResponse.json({
    settings: settings || {
      account_id: profile.account_id,
      audio_retention_days: 60,
      image_retention_days: 90,
      video_retention_days: 30,
      doc_retention_days: 365,
      max_storage_bytes: 10737418240,
      auto_cleanup_enabled: true,
      persist_in_storage: true,
    },
    usage: usage || {
      audio_count: 0,
      image_count: 0,
      video_count: 0,
      doc_count: 0,
      total_messages: 0,
    },
    isAdmin: profile.role === "admin" || profile.role === "super_admin",
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile?.account_id || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const {
    audio_retention_days,
    image_retention_days,
    video_retention_days,
    doc_retention_days,
    auto_cleanup_enabled,
    persist_in_storage,
  } = body;

  const payload = {
    account_id: profile.account_id,
    audio_retention_days: Number(audio_retention_days) >= 0 ? Number(audio_retention_days) : 60,
    image_retention_days: Number(image_retention_days) >= 0 ? Number(image_retention_days) : 90,
    video_retention_days: Number(video_retention_days) >= 0 ? Number(video_retention_days) : 30,
    doc_retention_days: Number(doc_retention_days) >= 0 ? Number(doc_retention_days) : 365,
    auto_cleanup_enabled: Boolean(auto_cleanup_enabled),
    persist_in_storage: Boolean(persist_in_storage),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("account_storage_settings")
    .upsert(payload, { onConflict: "account_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, settings: data });
}
