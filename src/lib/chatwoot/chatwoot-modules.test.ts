import { describe, it, expect } from 'vitest';
import { picoSearch } from '@/lib/chatwoot/pico-search';
import { BusinessHoursScheduler } from '@/lib/chatwoot/business-hours';
import {
  formatSlaDuration,
  evaluateConversationSla,
  buildMessageVariables,
  replaceVariablesInMessage,
  getUndefinedVariablesInMessage,
} from '@/lib/chatwoot/sla-and-canned';
import { kwinProfiler } from '@/lib/chatwoot/kwin-profiler';

describe('Chatwoot Borrowed Modules: picoSearch', () => {
  const items = [
    { id: '1', title: 'Atendimento WhatsApp', description: 'Fluxo principal de mensagens' },
    { id: '2', title: 'Configurações de Canal', description: 'Meta Cloud API e Uazapi' },
    { id: '3', title: 'Cobrança Pix', description: 'Pagamento e faturamento' },
  ];

  it('performs fuzzy matching accurately', () => {
    const results = picoSearch(items, 'wpp', [{ name: 'title', weight: 2 }, { name: 'description', weight: 1 }]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('1');
  });

  it('matches multi-word queries', () => {
    const results = picoSearch(items, 'meta canal', [{ name: 'title', weight: 2 }, { name: 'description', weight: 1 }]);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2');
  });

  it('returns empty array on completely mismatched query', () => {
    const results = picoSearch(items, 'xyz987impossible', [{ name: 'title', weight: 1 }]);
    expect(results.length).toBe(0);
  });
});

describe('Chatwoot Borrowed Modules: BusinessHoursScheduler', () => {
  const scheduler = new BusinessHoursScheduler();

  it('identifies working days correctly (default schedule Mon-Fri)', () => {
    // 2026-11-09 is Monday (Day 1)
    const monday = new Date('2026-11-09T10:00:00Z');
    expect(scheduler.isWorkingDay(monday)).toBe(true);

    // 2026-11-15 is Sunday (Day 0)
    const sunday = new Date('2026-11-15T10:00:00Z');
    expect(scheduler.isWorkingDay(sunday)).toBe(false);
  });

  it('respects holidays', () => {
    const holidayDate = new Date('2026-12-25T12:00:00Z');
    const holidayScheduler = new BusinessHoursScheduler({
      holidays: [new Date(holidayDate.toDateString())],
    });
    expect(holidayScheduler.isWorkingDay(holidayDate)).toBe(false);
  });
});

describe('Chatwoot Borrowed Modules: SLA & Canned Variables', () => {
  it('formats SLA duration cleanly', () => {
    expect(formatSlaDuration(45)).toBe('1m');
    expect(formatSlaDuration(120)).toBe('2m');
    expect(formatSlaDuration(3720)).toBe('1h 2m');
  });

  it('evaluates conversation SLA accurately', () => {
    const pastTime = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 min ago
    const badge = evaluateConversationSla({
      status: 'open',
      unread_count: 2,
      last_message_at: pastTime,
    }, { frtSeconds: 900 }); // 15 min limit

    expect(badge).not.toBeNull();
    expect(badge?.isMissed).toBe(true);
    expect(badge?.label).toBe('SLA Expirado');
  });

  it('interpolates variables and catches orphans', () => {
    const ctx = {
      contact: {
        name: 'Maria Oliveira',
        phone: '+5511999998888',
        company: 'Acme Corp',
      },
      conversation: {
        id: 'conv-123',
        whatsapp_instance: { id: 'inst-1', name: 'Comercial' },
      },
      agent: {
        name: 'Carlos Silva',
      },
    };

    const vars = buildMessageVariables(ctx);
    expect(vars['contact.name']).toBe('Maria Oliveira');
    expect(vars['primeiro_nome']).toBe('Maria');
    expect(vars['empresa']).toBe('Acme Corp');

    const template = 'Olá {{primeiro_nome}}, bem-vinda à {{empresa}}! Seu cupom é {{cupom_desconto}}.';
    const missing = getUndefinedVariablesInMessage(template, vars);
    expect(missing).toEqual(['cupom_desconto']);

    const replaced = replaceVariablesInMessage(template, vars);
    expect(replaced).toBe('Olá Maria, bem-vinda à Acme Corp! Seu cupom é {{cupom_desconto}}.');
  });
});

describe('Chatwoot Borrowed Modules: Kwin Profiler', () => {
  it('measures feature latency with marks', () => {
    const timer = kwinProfiler.start('teste-unidade', 5000);
    timer.mark('step1');
    const result = timer.stop();
    expect(result).toBeDefined();
    expect(result?.featureName).toBe('teste-unidade');
    expect(typeof result?.durationMs).toBe('number');
  });
});
