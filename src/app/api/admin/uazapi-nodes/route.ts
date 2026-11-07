// ============================================================
// GET/POST/PATCH/DELETE /api/admin/uazapi-nodes
//
// Uazapi 300-Slot Shard Nodes & Capacity Governance.
// Guarded by requireSuperAdmin().
// ============================================================

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { toErrorResponse } from '@/lib/auth/account';
import { normalizeUazapiBaseUrl } from '@/lib/whatsapp/uazapi';
import type { UazapiNodeTelemetry } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();

    const { data: nodes, error } = await supabaseAdmin
      .from('uazapi_nodes_telemetry')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to query uazapi_nodes_telemetry:', error);
      return NextResponse.json(
        { error: 'Falha ao buscar telemetria de nós Uazapi' },
        { status: 500 }
      );
    }

    const typedNodes = (nodes || []) as UazapiNodeTelemetry[];

    // Calculate aggregated capacity metrics across all shards
    const totalCapacity = typedNodes.reduce((acc, n) => acc + (n.max_capacity || 300), 0);
    const totalAllocated = typedNodes.reduce((acc, n) => acc + (n.total_instances || 0), 0);
    const totalConnected = typedNodes.reduce((acc, n) => acc + (n.connected_instances || 0), 0);
    const totalRemaining = Math.max(0, totalCapacity - totalAllocated);
    const globalOccupancyPct = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 1000) / 10 : 0;

    return NextResponse.json({
      nodes: typedNodes,
      summary: {
        total_nodes: typedNodes.length,
        total_capacity: totalCapacity,
        total_allocated: totalAllocated,
        total_connected: totalConnected,
        total_remaining: totalRemaining,
        global_occupancy_pct: globalOccupancyPct,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();
    const body = await req.json();

    const { name, api_url, max_capacity = 300, region = 'eu-central', is_accepting_new = true } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'O nome do bloco/nó é obrigatório.' }, { status: 400 });
    }

    if (!api_url || typeof api_url !== 'string' || !api_url.trim()) {
      return NextResponse.json({ error: 'A URL base da API Uazapi é obrigatória.' }, { status: 400 });
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUazapiBaseUrl(api_url.trim());
    } catch {
      return NextResponse.json({ error: 'URL do nó inválida.' }, { status: 400 });
    }

    const { data: created, error } = await supabaseAdmin
      .from('uazapi_nodes')
      .insert({
        name: name.trim(),
        api_url: normalizedUrl,
        max_capacity: Math.max(1, Number(max_capacity) || 300),
        region: region ? String(region).trim() : 'eu-central',
        status: 'active',
        is_accepting_new: Boolean(is_accepting_new),
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe um nó cadastrado com essa URL.' }, { status: 409 });
      }
      console.error('Error creating uazapi node:', error);
      return NextResponse.json({ error: 'Erro ao cadastrar novo bloco de nós.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, node: created }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();
    const body = await req.json();

    const { id, name, max_capacity, status, is_accepting_new, region } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID do nó é obrigatório.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof max_capacity === 'number' && max_capacity > 0) updates.max_capacity = max_capacity;
    if (typeof status === 'string') updates.status = status;
    if (typeof is_accepting_new === 'boolean') updates.is_accepting_new = is_accepting_new;
    if (typeof region === 'string') updates.region = region.trim();

    const { data: updated, error } = await supabaseAdmin
      .from('uazapi_nodes')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating uazapi node:', error);
      return NextResponse.json({ error: 'Falha ao atualizar configurações do nó.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, node: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabaseAdmin } = await requireSuperAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do nó é obrigatório.' }, { status: 400 });
    }

    // Check if node has connected or existing instances
    const { count } = await supabaseAdmin
      .from('whatsapp_config')
      .select('id', { count: 'exact', head: true })
      .eq('node_id', id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir este nó pois existem ${count} instâncias atreladas a ele.` },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('uazapi_nodes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting uazapi node:', error);
      return NextResponse.json({ error: 'Erro ao remover nó.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
