import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { t, detectLocale } from '../../src/web/i18n.ts';

describe('WEB-1: i18n toggle + EN fallback', () => {
  it('returns English translation by default', () => {
    assert.ok(t('site.title').includes('Official Lottery Results'));
  });

  it('returns Spanish translation when locale is es', () => {
    assert.ok(t('site.title', 'es').includes('Resultados Oficiales'));
  });

  it('falls back to EN for missing keys', () => {
    assert.equal(t('nonexistent.key', 'es'), 'nonexistent.key');
  });

  it('falls back to key when key missing in both locales', () => {
    assert.equal(t('missing.key'), 'missing.key');
  });
});

describe('WEB-1: locale detection', () => {
  it('detects es from URL param', () => {
    assert.equal(detectLocale(undefined, 'es'), 'es');
  });

  it('detects en from URL param', () => {
    assert.equal(detectLocale(undefined, 'en'), 'en');
  });

  it('detects es from Accept-Language header', () => {
    assert.equal(detectLocale('es-AR,es;q=0.9'), 'es');
  });

  it('defaults to en when no signals', () => {
    assert.equal(detectLocale(), 'en');
  });

  it('URL param overrides Accept-Language', () => {
    assert.equal(detectLocale('es-AR', 'en'), 'en');
  });
});
