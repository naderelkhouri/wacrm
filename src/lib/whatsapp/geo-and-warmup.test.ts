import { describe, it, expect, vi } from 'vitest';
import { detectGeoFromPhone, SUPPORTED_COUNTRIES } from './geo-utils';
import { calculateWarmupStage, verifyAndRecordMessageSend } from './warmup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('WhatsApp Geo Utils', () => {
  it('detects Brazilian phone number from Rio de Janeiro (21)', () => {
    const geo = detectGeoFromPhone('+5521982915059');
    expect(geo.country).toBe('BR');
    expect(geo.state).toBe('RJ');
    expect(geo.city).toBe('Rio de Janeiro');
    expect(geo.isBrazil).toBe(true);
  });

  it('detects Brazilian phone number from São Paulo (11)', () => {
    const geo = detectGeoFromPhone('5511914909281');
    expect(geo.country).toBe('BR');
    expect(geo.state).toBe('SP');
    expect(geo.city).toBe('São Paulo');
  });

  it('detects Brazilian phone number from Minas Gerais (31)', () => {
    const geo = detectGeoFromPhone('31988887777');
    expect(geo.country).toBe('BR');
    expect(geo.state).toBe('MG');
    expect(geo.city).toBe('Belo Horizonte');
  });

  it('detects USA phone number (+1)', () => {
    const geo = detectGeoFromPhone('+14155552671');
    expect(geo.country).toBe('US');
    expect(geo.isBrazil).toBe(false);
  });

  it('detects Portugal phone number (+351)', () => {
    const geo = detectGeoFromPhone('+351912345678');
    expect(geo.country).toBe('PT');
    expect(geo.isBrazil).toBe(false);
  });

  it('has list of supported countries with flags and DDIs', () => {
    expect(SUPPORTED_COUNTRIES.length).toBeGreaterThan(5);
    const br = SUPPORTED_COUNTRIES.find((c) => c.code === 'BR');
    expect(br?.ddi).toBe('55');
  });
});

describe('WhatsApp Warmup Engine', () => {
  it('calculates Stage 1 for brand new instance', () => {
    const now = new Date();
    const stage = calculateWarmupStage(now.toISOString());
    expect(stage.stage).toBe(1);
    expect(stage.dailyLimit).toBe(30);
    expect(stage.isFullyWarmed).toBe(false);
  });

  it('calculates Stage 3 after 8 days of warm-up', () => {
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const stage = calculateWarmupStage(past.toISOString());
    expect(stage.stage).toBe(3);
    expect(stage.dailyLimit).toBe(150);
  });

  it('calculates Stage 5 (Graduated) after 25 days', () => {
    const past = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000);
    const stage = calculateWarmupStage(past.toISOString());
    expect(stage.stage).toBe(5);
    expect(stage.isFullyWarmed).toBe(true);
    expect(stage.dailyLimit).toBe(1000);
  });

  it('blocks sending when messages exceed daily limit via db.rpc', async () => {
    const mockDb = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          success: true,
          messages_sent_today: 51,
          daily_message_limit: 50,
          warmup_enabled: true,
          is_exceeded: true,
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const status = await verifyAndRecordMessageSend(mockDb, 'config-123', 1);
    expect(status.allowed).toBe(false);
    expect(status.messagesSentToday).toBe(51);
    expect(status.reason).toContain('Limite de aquecimento atingido');
  });

  it('allows sending when under daily limit', async () => {
    const mockDb = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          success: true,
          messages_sent_today: 15,
          daily_message_limit: 50,
          warmup_enabled: true,
          is_exceeded: false,
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const status = await verifyAndRecordMessageSend(mockDb, 'config-123', 5);
    expect(status.allowed).toBe(true);
    expect(status.messagesSentToday).toBe(15);
  });
});
