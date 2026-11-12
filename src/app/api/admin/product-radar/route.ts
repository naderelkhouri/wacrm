import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();

    const now = new Date();
    const last24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7dIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last14dIso = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const last30dIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      totalRes,
      todayRes,
      last7dRes,
      last30dRes,
      views14dRes,
      recentViewsRes,
      backlogRes,
    ] = await Promise.all([
      supabaseAdmin.from('system_page_views').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('system_page_views')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', last24hIso),
      supabaseAdmin
        .from('system_page_views')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', last7dIso),
      supabaseAdmin
        .from('system_page_views')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', last30dIso),
      supabaseAdmin
        .from('system_page_views')
        .select('id, path, module_name, referrer, device, browser, city, account_name, created_at')
        .gte('created_at', last14dIso)
        .order('created_at', { ascending: false })
        .limit(2500),
      supabaseAdmin
        .from('system_page_views')
        .select('id, path, module_name, referrer, device, browser, city, account_name, created_at')
        .order('created_at', { ascending: false })
        .limit(12),
      supabaseAdmin
        .from('system_product_backlog')
        .select('*')
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);

    const views = views14dRes.data || [];
    const totalSample = views.length || 1;

    // 1. Mobile percentage
    const mobileCount = views.filter((v) => v.device === 'mobile' || v.device === 'tablet').length;
    const mobilePct = views.length > 0 ? Math.round((mobileCount / totalSample) * 100) : 0;

    // 2. Continuous 14-day histogram
    const dayCounts: Record<string, number> = {};
    const daysList: { date: string; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      dayCounts[key] = 0;
      daysList.push({ date: key, label: `${dd}/${mm}` });
    }

    for (const v of views) {
      const key = v.created_at.slice(0, 10);
      if (key in dayCounts) {
        dayCounts[key] += 1;
      }
    }

    const maxDayCount = Math.max(0, ...Object.values(dayCounts));
    const dailyHistogram = daysList.map((d) => ({
      date: d.date,
      label: d.label,
      count: dayCounts[d.date] || 0,
      isPeak: maxDayCount > 0 && dayCounts[d.date] === maxDayCount,
    }));

    // 3. Top Modules Ranking
    const moduleMap = new Map<string, { path: string; module_name: string; count: number }>();
    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const cityMap = new Map<string, number>();

    for (const v of views) {
      const modKey = v.path || '/dashboard';
      const curMod = moduleMap.get(modKey) || {
        path: modKey,
        module_name: v.module_name || modKey,
        count: 0,
      };
      curMod.count += 1;
      moduleMap.set(modKey, curMod);

      const dev = v.device || 'desktop';
      deviceMap.set(dev, (deviceMap.get(dev) || 0) + 1);

      const br = v.browser || 'Chrome';
      browserMap.set(br, (browserMap.get(br) || 0) + 1);

      const ct = v.city || 'São Paulo';
      cityMap.set(ct, (cityMap.get(ct) || 0) + 1);
    }

    const topModules = Array.from(moduleMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((m) => ({
        ...m,
        pct: Math.round((m.count / totalSample) * 100),
      }));

    const devices = Array.from(deviceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([device, count]) => ({
        device,
        count,
        pct: Math.round((count / totalSample) * 100),
      }));

    const browsers = Array.from(browserMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([browser, count]) => ({
        browser,
        count,
        pct: Math.round((count / totalSample) * 100),
      }));

    const cities = Array.from(cityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([city, count]) => ({
        city,
        count,
        pct: Math.round((count / totalSample) * 100),
      }));

    return NextResponse.json({
      usage: {
        kpis: {
          today: todayRes.count ?? 0,
          last7d: last7dRes.count ?? 0,
          last30d: last30dRes.count ?? 0,
          total: totalRes.count ?? 0,
          mobilePct,
        },
        dailyHistogram,
        topModules,
        devices,
        browsers,
        cities,
        recentViews: recentViewsRes.data || [],
      },
      backlog: backlogRes.data || [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();
    const body = await req.json();

    const type = ['bug', 'melhoria', 'oportunidade'].includes(body.type)
      ? body.type
      : 'melhoria';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'O título é obrigatório.' }, { status: 400 });
    }

    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const modulePath = typeof body.module_path === 'string' ? body.module_path.trim() : '/dashboard';
    const rating = typeof body.rating === 'number' ? Math.min(5, Math.max(0, body.rating)) : 4;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const status = ['novo', 'analise', 'desenvolvimento', 'concluido', 'arquivado'].includes(body.status)
      ? body.status
      : 'novo';

    const { data, error } = await supabaseAdmin
      .from('system_product_backlog')
      .insert({
        type,
        source: body.source || 'manual',
        title,
        description,
        module_path: modulePath,
        status,
        rating,
        notes,
        occurrence_count: 1,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'ID do registro é obrigatório.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.status && ['novo', 'analise', 'desenvolvimento', 'concluido', 'arquivado'].includes(body.status)) {
      updates.status = body.status;
    }
    if (typeof body.rating === 'number') {
      updates.rating = Math.min(5, Math.max(0, body.rating));
    }
    if (typeof body.notes === 'string') {
      updates.notes = body.notes;
    }
    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if (typeof body.description === 'string') {
      updates.description = body.description.trim();
    }
    if (typeof body.type === 'string' && ['bug', 'melhoria', 'oportunidade'].includes(body.type)) {
      updates.type = body.type;
    }
    if (typeof body.module_path === 'string') {
      updates.module_path = body.module_path;
    }

    const { data, error } = await supabaseAdmin
      .from('system_product_backlog')
      .update(updates)
      .eq('id', body.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('system_product_backlog')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
