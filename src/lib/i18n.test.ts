import { describe, it, expect } from 'vitest';
import { getMessage, messages } from './messages';

describe('i18n (Internationalization) Logic', () => {
  it('returns translation in English', () => {
    expect(getMessage('en', 'nav.dashboard')).toBe('Dashboard');
  });

  it('returns translation in Thai', () => {
    expect(getMessage('th', 'nav.dashboard')).toBe('แดชบอร์ด');
  });

  it('falls back to Provided Fallback if key missing', () => {
    expect(getMessage('en', 'missing.key', 'Fallback')).toBe('Fallback');
  });

  it('falls back to Key itself if key missing and no fallback provided', () => {
    expect(getMessage('en', 'nonexistent.key')).toBe('nonexistent.key');
  });

  it('contains recent account dialog Thai translations', () => {
    expect(messages.th).toHaveProperty('accountPage.package.fastSupport');
    expect(messages.th).toHaveProperty('accountPage.custom.createPlan');
    expect(messages.th).toHaveProperty('accountPage.package.fastSupport', '⚡ สนับสนุนด่วน');
    expect(messages.th).toHaveProperty('login.error.invalidCredentials', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  });

  it('contains recent account dialog English translations', () => {
    expect(messages.en).toHaveProperty('accountPage.package.fastSupport');
    expect(messages.en).toHaveProperty('accountPage.package.fastSupport', '⚡ Fast Support');
    expect(messages.en).toHaveProperty('login.error.invalidCredentials', 'Invalid email or password.');
  });

  it('has consistent keys between Thai and English for accountPage module', () => {
    const thKeys = Object.keys(messages.th).filter(k => k.startsWith('accountPage.'));
    const enKeys = Object.keys(messages.en).filter(k => k.startsWith('accountPage.'));

    // Check that all keys in TH exist in EN for accountPage
    thKeys.forEach(key => {
      expect(enKeys).toContain(key);
    });

    // Check that all keys in EN exist in TH for accountPage
    enKeys.forEach(key => {
      expect(thKeys).toContain(key);
    });
  });
});
