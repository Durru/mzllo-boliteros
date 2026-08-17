/**
 * Curated affiliate links + bilingual disclosure (AFF-1/2).
 * AFF-1: Zero-render on missing/expired links
 * AFF-2: Disclosure required, missing → flag
 */

export interface AffiliateLink {
  id: string;
  label: string;
  url: string;
  disclosure: string;
  active: boolean;
}

const AFFILIATE_DISCLOSURE_EN =
  'Affiliate link: we may earn a commission at no extra cost to you.';
const AFFILIATE_DISCLOSURE_ES =
  'Enlace de afiliado: podemos recibir una comisión sin costo adicional para ti.';

/** Default curated affiliate links. */
export const DEFAULT_AFFILIATES: AffiliateLink[] = [
  {
    id: 'fl-lottery',
    label: 'Florida Lottery Official',
    url: 'https://www.flalottery.com',
    disclosure: AFFILIATE_DISCLOSURE_EN,
    active: true,
  },
  {
    id: 'ga-lottery',
    label: 'Georgia Lottery Official',
    url: 'https://www.galottery.com',
    disclosure: AFFILIATE_DISCLOSURE_EN,
    active: true,
  },
  {
    id: 'ny-lottery',
    label: 'New York Lottery Official',
    url: 'https://www.nylottery.org',
    disclosure: AFFILIATE_DISCLOSURE_EN,
    active: true,
  },
];

export interface AffiliateConfig {
  /** Provide curated links; defaults to DEFAULT_AFFILIATES. */
  links?: AffiliateLink[];
}

/**
 * Get all active affiliate links (AFF-1: zero-render on missing/expired).
 */
export function getActiveAffiliates(config: AffiliateConfig = {}): AffiliateLink[] {
  return (config.links ?? DEFAULT_AFFILIATES).filter((link) => link.active);
}

/**
 * Render affiliate links with disclosure (AFF-2).
 * Returns empty string if no active links — zero-render.
 * Flags links missing disclosure.
 */
export function renderAffiliates(
  config: AffiliateConfig = {},
  lang: 'en' | 'es' = 'en',
): { html: string; flagged: string[] } {
  const links = getActiveAffiliates(config);
  const flagged: string[] = [];

  if (links.length === 0) {
    return { html: '', flagged };
  }

  const disclosure = lang === 'es' ? AFFILIATE_DISCLOSURE_ES : AFFILIATE_DISCLOSURE_EN;

  const lines: string[] = [];
  lines.push(lang === 'es' ? 'Enlaces útiles:' : 'Useful links:');
  lines.push('');

  for (const link of links) {
    const disc = link.disclosure || disclosure;
    if (!link.disclosure) {
      flagged.push(link.id);
    }
    lines.push(`${link.label}: ${link.url}`);
    lines.push(`  ${disc}`);
  }

  return { html: lines.join('\n'), flagged };
}

/**
 * Validate affiliate config: flag links with missing disclosure.
 */
export function validateAffiliates(config: AffiliateConfig = {}): string[] {
  const links = config.links ?? DEFAULT_AFFILIATES;
  return links.filter((l) => l.active && !l.disclosure).map((l) => l.id);
}
