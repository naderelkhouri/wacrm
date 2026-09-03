import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './locales';

describe('lib/locales', () => {
  it('defines Portuguese (Brazil) as default locale', () => {
    expect(DEFAULT_LOCALE).toBe('pt-BR');
  });

  it('includes major languages (pt-BR, en, es, ko)', () => {
    const ids = SUPPORTED_LOCALES.map((l) => l.id);
    expect(ids).toContain('pt-BR');
    expect(ids).toContain('en');
    expect(ids).toContain('es');
    expect(ids).toContain('ko');
  });

  it('has flags and native names for all locales', () => {
    SUPPORTED_LOCALES.forEach((locale) => {
      expect(locale.flag).toBeTruthy();
      expect(locale.nativeName).toBeTruthy();
      expect(locale.short).toBeTruthy();
    });
  });
});
