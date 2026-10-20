import { describe, it, expect } from 'vitest';
import { executeRemediation, getRemediationHistory } from './auto-remediator';
import { getTelemetryMetricsSnapshot, recordTelemetryEvent } from './telemetry-service';

describe('Auto-Remediator Engine', () => {
  it('executes reset_circuit_breaker and restores open circuits to closed', async () => {
    // Force open circuit
    for (let i = 0; i < 5; i++) {
      recordTelemetryEvent({
        category: 'meta_api',
        metric_name: 'meta.fail',
        severity: 'critical',
        value: 500,
      });
    }
    expect(getTelemetryMetricsSnapshot().circuits.meta_api.state).toBe('open');

    const result = await executeRemediation({
      action_type: 'reset_circuit_breaker',
      trigger_type: 'manual',
      reason: 'Test circuit reset',
    });

    expect(result.status).toBe('succeeded');
    expect(result.target_service).toContain('meta_api');
    expect(getTelemetryMetricsSnapshot().circuits.meta_api.state).toBe('closed');
  });

  it('executes purge_ephemeral_cache cleanly', async () => {
    const result = await executeRemediation({
      action_type: 'purge_ephemeral_cache',
      trigger_type: 'manual',
      reason: 'Memory test',
    });

    expect(result.status).toBe('succeeded');
    expect(result.target_service).toBe('system_cache');
    expect(result.execution_log).toHaveProperty('execution_time_ms');
  });

  it('supports dry_run mode without mutating state', async () => {
    const result = await executeRemediation({
      action_type: 'unstick_stalled_broadcasts',
      trigger_type: 'manual',
      reason: 'Dry run test',
      dry_run: true,
    });

    expect(result.status).toBe('succeeded');
    expect(result.execution_log).toMatchObject({ mode: 'dry_run' });
  });

  it('enforces cooldown guardrails on repeated automated triggers', async () => {
    // First run
    await executeRemediation({
      action_type: 'apply_meta_rate_throttle',
      trigger_type: 'automated',
      reason: 'First automated throttle',
    });

    // Immediate second run should reject due to cooldown
    await expect(
      executeRemediation({
        action_type: 'apply_meta_rate_throttle',
        trigger_type: 'automated',
        reason: 'Second rapid automated throttle',
      })
    ).rejects.toThrow(/cooldown/i);
  });

  it('keeps history of remediation actions', () => {
    const history = getRemediationHistory(10);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty('action_type');
    expect(history[0]).toHaveProperty('status');
  });
});
