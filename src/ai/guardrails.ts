/**
 * Guardrails for the AI assistant (AIA-2).
 * Detects bolita/prediction intent and returns hard refusals.
 */

const BOLITA_KEYWORDS = [
  'bolita', 'bolitas', 'pronóstico', 'pronostico', 'predicción', 'prediccion',
  'predecir', 'va a salir', 'qué número', 'que numero', 'cuál sale', 'cual sale',
  'cuál salió', 'cual salio', 'número ganador', 'numero ganador', 'combinación ganadora',
  'combinacion ganadora', 'suerte', 'fortuna', 'azar', 'mágico', 'magico',
  'premonición', 'premonicion', 'intuición', 'intuicion', 'vidente',
  'clarividente', 'oráculo', 'oraculo', 'astrologo', 'numerología', 'numerologia',
];

const PREDICTION_PATTERNS = [
  /(?:va a|puede|podría|podria|saldrá|saldra|sale)\s+(?:salir|ganar)/i,
  /(?:cuál|cual|qué|que)\s+(?:número|numero|combinación|combinacion)\s+(?:va a|puede|saldrá|saldra)/i,
  /(?:predice|prediga|adivine|adivina|calcula|estima)\s+(?:el|los|la)\s+(?:número|numero|resultado)/i,
  /\b(?:1er?|primer?|2do?|segundo?|3er?|tercer?)\s+(?:premio|lugar)\b/i,
];

export type Intent = 'result_query' | 'bolita_prediction' | 'general';

export interface ClassificationResult {
  intent: Intent;
  refused: boolean;
  disclaimer?: string;
}

const DISCLAIMER = '⚠️ Este asistente solo proporciona resultados oficiales de lotería. No realiza predicciones ni pronósticos. Los resultados son de fuentes oficiales de FL, GA y NY.';

/**
 * Classify user intent from query text (AIA-2).
 * Returns refused=true for bolita/prediction queries.
 */
export function classifyIntent(query: string): ClassificationResult {
  const lower = query.toLowerCase();

  // Check keywords
  for (const keyword of BOLITA_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { intent: 'bolita_prediction', refused: true, disclaimer: DISCLAIMER };
    }
  }

  // Check patterns
  for (const pattern of PREDICTION_PATTERNS) {
    if (pattern.test(query)) {
      return { intent: 'bolita_prediction', refused: true, disclaimer: DISCLAIMER };
    }
  }

  return { intent: 'result_query', refused: false };
}

/**
 * Build a refusal response for bolita/prediction queries.
 */
export function buildRefusalResponse(): string {
  return DISCLAIMER;
}
