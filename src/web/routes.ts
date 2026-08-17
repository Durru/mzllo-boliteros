import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { t, detectLocale, type Locale } from './i18n.ts';
import { getCurrentResult, getHistory } from '../store/queries.ts';
import { renderAffiliates } from '../membership/affiliates.ts';

type AppEnv = {
  Variables: {
    locale: Locale;
  };
};

/**
 * Create Hono routes for the bilingual web app (WEB-1/2/3).
 * db is captured in the closure — no Hono context variable needed.
 */
export function createRoutes(db: DatabaseSync): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Locale detection middleware
  app.use('*', (c, next) => {
    const urlLocale = c.req.query('lang') as string | undefined;
    const acceptLang = c.req.header('Accept-Language');
    c.set('locale', detectLocale(acceptLang, urlLocale));
    return next();
  });

  // Home page
  app.get('/', (c) => {
    const locale = c.get('locale');
    const html = renderPage({
      locale,
      title: t('site.title', locale),
      meta: t('site.description', locale),
      hreflang: true,
      body: `
        <h1>${t('results.title', locale)}</h1>
        <p>${t('site.description', locale)}</p>
        <nav>
          <a href="/results">${t('nav.results', locale)}</a>
          <a href="/history">${t('nav.history', locale)}</a>
          <a href="/about">${t('nav.about', locale)}</a>
        </nav>
      `,
    });
    return c.html(html);
  });

  // Results page — latest draw
  app.get('/results', (c) => {
    const locale = c.get('locale');
    const state = (c.req.query('state') ?? 'FL') as 'FL' | 'GA' | 'NY';
    const gameId = c.req.query('game') ?? 'pick3';

    if (!['FL', 'GA', 'NY'].includes(state)) {
      return c.text('Invalid state', 400);
    }

    const draw = getCurrentResult(db, { state, gameId });
    const body = draw
      ? `<h1>${t('results.title', locale)}</h1>
         <h2>${draw.gameName} (${draw.state})</h2>
         <p>📅 ${draw.drawDate} • ${draw.drawType}</p>
         <p>🎱 ${draw.numbers.join(' - ')}</p>
         ${draw.jackpot !== null ? `<p>💰 Jackpot: $${draw.jackpot.toLocaleString('en-US')}</p>` : ''}
         <p><small>Source: ${draw.sourceRef}</small></p>`
      : `<h1>${t('results.title', locale)}</h1>
         <p>${t('results.no_results', locale)}</p>`;

    return c.html(renderPage({
      locale,
      title: `${t('results.title', locale)} — ${state} ${gameId}`,
      meta: t('site.description', locale),
      body,
    }));
  });

  // History page
  app.get('/history', (c) => {
    const locale = c.get('locale');
    const state = (c.req.query('state') ?? 'FL') as 'FL' | 'GA' | 'NY';
    const gameId = c.req.query('game') ?? 'pick3';
    const page = parseInt(c.req.query('page') ?? '1', 10);
    const limit = 20;
    const offset = (page - 1) * limit;

    if (!['FL', 'GA', 'NY'].includes(state)) {
      return c.text('Invalid state', 400);
    }

    const draws = getHistory(db, { state, gameId, limit, offset });
    const rows = draws.map(
      (d) => `<tr><td>${d.drawDate}</td><td>${d.drawType}</td><td>${d.numbers.join(', ')}</td></tr>`,
    ).join('');

    const body = `<h1>${t('history.title', locale)}</h1>
      <h2>${state} — ${gameId}</h2>
      ${rows ? `<table><thead><tr><th>Date</th><th>Type</th><th>Numbers</th></tr></thead><tbody>${rows}</tbody></table>` : `<p>${t('history.empty', locale)}</p>`}
      <p>${t('history.page', locale)} ${page}</p>`;

    return c.html(renderPage({
      locale,
      title: `${t('history.title', locale)} — ${state} ${gameId}`,
      meta: t('site.description', locale),
      body,
    }));
  });

  // About page
  app.get('/about', (c) => {
    const locale = c.get('locale');
    const { html: affiliateHtml } = renderAffiliates({}, locale);
    const body = `<h1>${t('about.title', locale)}</h1>
      <p>${t('about.description', locale)}</p>
      ${affiliateHtml ? `<section>${affiliateHtml}</section>` : ''}`;

    return c.html(renderPage({
      locale,
      title: t('about.title', locale),
      meta: t('about.description', locale),
      body,
    }));
  });

  return app;
}

interface PageOptions {
  locale: Locale;
  title: string;
  meta: string;
  hreflang?: boolean;
  body: string;
}

/**
 * Render a full HTML page with SEO metadata (WEB-2).
 */
function renderPage(opts: PageOptions): string {
  const altLocale = opts.locale === 'en' ? 'es' : 'en';
  const hreflang = opts.hreflang
    ? `<link rel="alternate" hreflang="en" href="/?lang=en" />
       <link rel="alternate" hreflang="es" href="/?lang=es" />
       <link rel="alternate" hreflang="x-default" href="/?lang=en" />`
    : '';

  return `<!DOCTYPE html>
<html lang="${opts.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.title}</title>
  <meta name="description" content="${opts.meta}" />
  ${hreflang}
  <meta name="robots" content="index, follow" />
</head>
<body>
  <header>
    <nav>
      <a href="/?lang=${opts.locale}">Mzllo Boliteros</a>
      <a href="/results?lang=${opts.locale}">Results</a>
      <a href="/history?lang=${opts.locale}">History</a>
      <a href="/about?lang=${opts.locale}">About</a>
      <a href="/?lang=${altLocale === 'en' ? 'en' : 'es'}">${altLocale === 'en' ? 'EN' : 'ES'}</a>
    </nav>
  </header>
  <main>${opts.body}</main>
  <footer>
    <p>${t('footer.affiliate_disclosure', opts.locale)}</p>
    <p>${t('footer.source', opts.locale)}</p>
  </footer>
</body>
</html>`;
}
