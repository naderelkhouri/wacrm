import { describe, it, expect } from 'vitest';
import {
  getOptimizationRecommendations,
  applyRecommendation,
} from './recommendations-engine';

describe('Recommendations Engine', () => {
  it('returns sorted list of actionable optimization suggestions', () => {
    const recs = getOptimizationRecommendations();
    expect(recs.length).toBeGreaterThan(0);
    // Critical or high should be first
    expect(['critical', 'high']).toContain(recs[0].impact);
    expect(recs[0]).toHaveProperty('title');
    expect(recs[0]).toHaveProperty('estimated_gain');
  });

  it('applies an auto-executable recommendation and marks it applied', async () => {
    const recs = getOptimizationRecommendations();
    const candidate = recs.find((r) => r.auto_executable && r.status === 'active');
    expect(candidate).toBeDefined();

    const result = await applyRecommendation(candidate!.id, 'usr_test_admin');
    expect(result.success).toBe(true);
    expect(result.recommendation.status).toBe('applied');
    expect(result.recommendation.resolved_at).toBeDefined();

    // Re-applying returns already applied notification
    const secondResult = await applyRecommendation(candidate!.id, 'usr_test_admin');
    expect(secondResult.success).toBe(true);
    expect(secondResult.message).toContain('já foi aplicada');
  });

  it('throws an error for non-existent recommendation ID', async () => {
    await expect(applyRecommendation('rec_does_not_exist')).rejects.toThrow(/não encontrada/i);
  });
});
