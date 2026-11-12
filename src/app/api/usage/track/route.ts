import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as getSupabaseAdmin } from '@/lib/flows/admin-client';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MODULE_LABELS: Record<string, string> = {
  '/dashboard': 'Painel Principal',
  '/inbox': 'Conversas (Inbox)',
  '/notifications': 'Notificações',
  '/contacts': 'Contatos',
  '/pipelines': 'Funis de Vendas',
  '/broadcasts': 'Transmissões',
  '/automations': 'Automações',
  '/flows': 'Fluxos',
  '/agents': 'Agentes de IA',
  '/settings': 'Configurações',
};

function resolveModuleName(path: string): string {
  const clean = path.split('?')[0];
  for (const [prefix, label] of Object.entries(MODULE_LABELS)) {
    if (clean === prefix || clean.startsWith(`${prefix}/`)) {
      return label;
    }
  }
  return clean || 'Outro';
}

function detectDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
  const lower = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(lower)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(lower)) {
    return 'mobile';
  }
  return 'desktop';
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return 'Safari';
  return 'Outro';
}

function normalizeReferrer(ref: string | null | undefined): string {
  if (!ref) return 'Acesso Direto';
  const lower = ref.toLowerCase();
  if (lower.includes('instagram.com')) return 'Instagram';
  if (lower.includes('google.')) return 'Google';
  if (lower.includes('whatsapp.com') || lower.includes('wa.me')) return 'WhatsApp';
  if (lower.includes('facebook.com') || lower.includes('fb.')) return 'Facebook';
  if (lower.includes('linkedin.com')) return 'LinkedIn';
  if (lower.includes('wcloudapi.dev') || lower.includes('admx.tech')) return 'Navegação Interna';
  return 'Acesso Direto';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const eventType = body.eventType || 'page_view';
    const rawPath = typeof body.path === 'string' ? body.path.slice(0, 200) : '/dashboard';

    // Ignore admin routes for page_view tracking so SuperAdmin browsing doesn't skew usage metrics
    if (eventType === 'page_view' && rawPath.startsWith('/admin')) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const ua = req.headers.get('user-agent') || '';
    const rawCity = req.headers.get('cf-ipcity') || req.headers.get('x-vercel-ip-city') || null;
    const city = rawCity ? decodeURIComponent(rawCity) : null;
    const region = req.headers.get('cf-region') || req.headers.get('x-vercel-ip-country-region') || null;
    const country = req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country') || null;

    // Handle automatic silent bug capture
    if (eventType === 'silent_error') {
      const title = typeof body.title === 'string' ? body.title.slice(0, 180) : 'Erro de execução silencioso';
      const description = typeof body.description === 'string' ? body.description.slice(0, 1000) : '';
      const modulePath = rawPath;

      const { data: existing } = await supabaseAdmin
        .from('system_product_backlog')
        .select('id, occurrence_count')
        .eq('type', 'bug')
        .eq('title', title)
        .neq('status', 'concluido')
        .neq('status', 'arquivado')
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from('system_product_backlog')
          .update({
            occurrence_count: (existing.occurrence_count || 1) + 1,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin.from('system_product_backlog').insert({
          type: 'bug',
          source: 'auto_detector',
          title,
          description,
          module_path: modulePath,
          status: 'novo',
          rating: 4,
          notes: `Capturado automaticamente em ${new Date().toLocaleString('pt-BR')} (${detectBrowser(ua)} / ${detectDevice(ua)}).`,
          metadata: body.metadata || {},
          occurrence_count: 1,
        });
      }

      return NextResponse.json({ ok: true, captured: true });
    }

    // Standard LGPD-compliant page view tracking
    let accountId: string | null = null;
    let accountName: string | null = null;

    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await supabaseAdmin
          .from('account_members')
          .select('account_id, accounts(name)')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        if (member) {
          accountId = member.account_id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          accountName = (member.accounts as any)?.name || null;
        }
      }
    } catch {
      // Non-blocking if unauthenticated
    }

    await supabaseAdmin.from('system_page_views').insert({
      path: rawPath.split('?')[0],
      module_name: resolveModuleName(rawPath),
      referrer: normalizeReferrer(body.referrer),
      device: detectDevice(ua),
      browser: detectBrowser(ua),
      city,
      region,
      country,
      account_id: accountId,
      account_name: accountName,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[usage/track] error:', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
