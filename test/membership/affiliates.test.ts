import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveAffiliates,
  renderAffiliates,
  validateAffiliates,
  DEFAULT_AFFILIATES,
  type AffiliateLink,
} from '../../src/membership/affiliates.ts';

describe('AFF-1: zero-render on missing/expired links', () => {
  it('returns all active links by default', () => {
    const links = getActiveAffiliates();
    assert.ok(links.length > 0);
    assert.ok(links.every((l) => l.active));
  });

  it('returns empty when all links inactive', () => {
    const links = getActiveAffiliates({
      links: [{ id: 'x', label: 'X', url: 'http://x', disclosure: 'd', active: false }],
    });
    assert.equal(links.length, 0);
  });

  it('renders nothing when no active links', () => {
    const { html } = renderAffiliates({
      links: [{ id: 'x', label: 'X', url: 'http://x', disclosure: 'd', active: false }],
    });
    assert.equal(html, '');
  });
});

describe('AFF-2: disclosure required, missing → flag', () => {
  it('renders links with disclosure in English', () => {
    const { html, flagged } = renderAffiliates({}, 'en');
    assert.ok(html.includes('Florida Lottery'));
    assert.ok(html.includes('Affiliate link'));
    assert.equal(flagged.length, 0);
  });

  it('renders links with disclosure in Spanish', () => {
    const custom: AffiliateLink[] = [
      { id: 'test', label: 'Test', url: 'http://test', disclosure: '', active: true },
    ];
    const { html } = renderAffiliates({ links: custom }, 'es');
    assert.ok(html.includes('Enlace de afiliado'));
  });

  it('flags links with missing disclosure', () => {
    const custom: AffiliateLink[] = [
      { id: 'good', label: 'Good', url: 'http://good', disclosure: 'disc', active: true },
      { id: 'bad', label: 'Bad', url: 'http://bad', disclosure: '', active: true },
    ];
    const { flagged } = renderAffiliates({ links: custom });
    assert.deepEqual(flagged, ['bad']);
  });

  it('validateAffiliates returns IDs with missing disclosure', () => {
    const custom: AffiliateLink[] = [
      { id: 'ok', label: 'OK', url: 'http://ok', disclosure: 'disc', active: true },
      { id: 'missing', label: 'M', url: 'http://m', disclosure: '', active: true },
      { id: 'inactive', label: 'I', url: 'http://i', disclosure: '', active: false },
    ];
    const flagged = validateAffiliates({ links: custom });
    assert.deepEqual(flagged, ['missing']);
  });

  it('default affiliates all have disclosure', () => {
    const flagged = validateAffiliates();
    assert.equal(flagged.length, 0, 'default affiliates should have disclosure');
  });
});
