import { describe, it, expect } from 'vitest'
import {
  ALL_AGENCY_SPECIALISTS,
  AGENCY_SPECIALISTS,
  getAgencySpecialist,
} from './agency-specialists'
import { buildSystemPrompt } from './defaults'

describe('agency-specialists', () => {
  it('exports all expected specialist personas', () => {
    expect(ALL_AGENCY_SPECIALISTS.length).toBeGreaterThanOrEqual(7)
    for (const spec of ALL_AGENCY_SPECIALISTS) {
      expect(spec.id).toBeTruthy()
      expect(spec.name).toBeTruthy()
      expect(spec.title).toBeTruthy()
      expect(spec.icon).toBeTruthy()
      expect(spec.description).toBeTruthy()
      expect(spec.directive).toBeTruthy()
    }
  })

  it('retrieves known specialist by id', () => {
    const deal = getAgencySpecialist('deal-strategist')
    expect(deal).toBeDefined()
    expect(deal?.name).toBe('Deal Strategist')
    expect(deal?.icon).toBe('🎯')

    const cs = getAgencySpecialist('customer-service')
    expect(cs).toBeDefined()
    expect(cs?.name).toBe('Customer Service')
  })

  it('returns undefined for invalid or null specialist id', () => {
    expect(getAgencySpecialist(null)).toBeUndefined()
    expect(getAgencySpecialist(undefined)).toBeUndefined()
    expect(getAgencySpecialist('non-existent-agent')).toBeUndefined()
  })

  it('injects specialist persona into buildSystemPrompt when provided', () => {
    const prompt = buildSystemPrompt({
      userPrompt: 'Somos uma loja de eletrônicos.',
      mode: 'draft',
      agencySpecialist: 'deal-strategist',
    })

    expect(prompt).toContain('Specialist persona active: [The Agency - Deal Strategist')
    expect(prompt).toContain('Adopt the role of Deal Strategist & Closer')
    expect(prompt).toContain('Somos uma loja de eletrônicos.')
  })

  it('does not inject specialist section when agencySpecialist is omitted', () => {
    const prompt = buildSystemPrompt({
      userPrompt: 'Somos uma loja de eletrônicos.',
      mode: 'draft',
    })

    expect(prompt).not.toContain('Specialist persona active:')
    expect(prompt).toContain('Somos uma loja de eletrônicos.')
  })
})
