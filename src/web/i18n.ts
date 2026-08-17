/**
 * i18n — Bilingual EN/ES translations (WEB-1).
 * EN is the default; ES is the alternate.
 */

export type Locale = 'en' | 'es';

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'site.title': 'Mzllo Boliteros — Official Lottery Results',
    'site.description': 'Official FL, GA, NY lottery results in real time.',
    'nav.home': 'Home',
    'nav.results': 'Results',
    'nav.history': 'History',
    'nav.about': 'About',
    'results.title': 'Latest Results',
    'results.no_results': 'No results available yet.',
    'results.view_history': 'View history',
    'history.title': 'Draw History',
    'history.empty': 'No draws found for this game.',
    'history.page': 'Page',
    'about.title': 'About Mzllo Boliteros',
    'about.description': 'Official lottery results from FL, GA, and NY. No predictions, no bolita — only verified official sources.',
    'footer.affiliate_disclosure': 'Affiliate link: we may earn a commission at no extra cost to you.',
    'footer.source': 'Data sourced from official state lottery websites.',
    'footer.language': 'Language',
  },
  es: {
    'site.title': 'Mzllo Boliteros — Resultados Oficiales de Lotería',
    'site.description': 'Resultados oficiales de lotería de FL, GA y NY en tiempo real.',
    'nav.home': 'Inicio',
    'nav.results': 'Resultados',
    'nav.history': 'Historial',
    'nav.about': 'Acerca de',
    'results.title': 'Últimos Resultados',
    'results.no_results': 'No hay resultados disponibles aún.',
    'results.view_history': 'Ver historial',
    'history.title': 'Historial de Sorteos',
    'history.empty': 'No se encontraron sorteos para este juego.',
    'history.page': 'Página',
    'about.title': 'Acerca de Mzllo Boliteros',
    'about.description': 'Resultados oficiales de lotería de FL, GA y NY. Sin predicciones, sin bolita — solo fuentes oficiales verificadas.',
    'footer.affiliate_disclosure': 'Enlace de afiliado: podemos recibir una comisión sin costo adicional para ti.',
    'footer.source': 'Datos obtenidos de sitios oficiales de lotería estatal.',
    'footer.language': 'Idioma',
  },
};

/**
 * Get a translated string by key and locale (WEB-1: EN fallback).
 */
export function t(key: string, locale: Locale = 'en'): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}

/**
 * Get all translations for a locale.
 */
export function getTranslations(locale: Locale): Record<string, string> {
  return translations[locale] ?? translations.en;
}

/**
 * Detect locale from Accept-Language header or URL param.
 */
export function detectLocale(acceptLanguage?: string, urlParam?: string): Locale {
  if (urlParam === 'es' || urlParam === 'en') return urlParam;
  if (acceptLanguage?.toLowerCase().includes('es')) return 'es';
  return 'en';
}
