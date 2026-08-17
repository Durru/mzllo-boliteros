import type { DatabaseSync } from 'node:sqlite';
import { createRoutes } from './routes.ts';

export { createRoutes } from './routes.ts';
export { t, detectLocale, type Locale } from './i18n.ts';

/**
 * Create the web application (Hono).
 * Callers can use the returned app with any Hono-compatible server.
 */
export function createWebApp(db: DatabaseSync) {
  return createRoutes(db);
}
