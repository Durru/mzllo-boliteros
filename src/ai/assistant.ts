import type { DatabaseSync } from 'node:sqlite';
import { classifyIntent, buildRefusalResponse } from './guardrails.ts';
import { createTools, type Tool } from './tools.ts';

export interface AssistantConfig {
  db: DatabaseSync;
  /** Check if user has active membership (for premium analysis). */
  isActiveMember: (telegramUserId: number) => boolean;
}

export interface QueryResult {
  answer: string;
  refused: boolean;
  toolUsed?: string;
  logged: boolean;
}

/**
 * AI Assistant — answers only from store-backed tools (AIA-1).
 * Refuses bolita/prediction queries (AIA-2).
 * Gates premium analysis behind membership (AIA-3).
 * Logs every query to ai_query_log.
 */
export function createAssistant(config: AssistantConfig) {
  const { db, isActiveMember } = config;
  const tools = createTools(db);

  return {
    /**
     * Process a user query. Returns an answer from tool results, or a refusal.
     */
    async handleQuery(telegramUserId: number | null, query: string): Promise<QueryResult> {
      // Step 1: Classify intent (AIA-2)
      const classification = classifyIntent(query);

      if (classification.refused) {
        logQuery(db, telegramUserId, query, classification.intent, true, classification.disclaimer ?? null);
        return {
          answer: classification.disclaimer ?? buildRefusalResponse(),
          refused: true,
          logged: true,
        };
      }

      // Step 2: Check for premium-only intent (AIA-3)
      const isPremiumQuery = detectPremiumIntent(query);
      if (isPremiumQuery) {
        const userIsMember = telegramUserId !== null && isActiveMember(telegramUserId);
        if (!userIsMember) {
          const denyMsg = '🔒 Este análisis requiere membresía premium. Usa /help para más información.';
          logQuery(db, telegramUserId, query, 'general', true, denyMsg);
          return { answer: denyMsg, refused: true, logged: true };
        }
      }

      // Step 3: Execute tool (AIA-1)
      const tool = matchTool(query, tools);
      if (tool) {
        const args = extractArgs(query);
        const answer = tool.execute(args);
        logQuery(db, telegramUserId, query, 'result_query', false, answer);
        return { answer, refused: false, toolUsed: tool.name, logged: true };
      }

      // Step 4: No tool matched — generic response
      const fallback = 'No pude entender tu consulta. Usa /help para ver los comandos disponibles, o pregúntame por resultados de lotería.';
      logQuery(db, telegramUserId, query, 'result_query', false, fallback);
      return { answer: fallback, refused: false, logged: true };
    },
  };
}

/** Detect premium-analysis intent keywords (AIA-3). */
function detectPremiumIntent(query: string): boolean {
  const lower = query.toLowerCase();
  return (
    lower.includes('análisis') ||
    lower.includes('analisis') ||
    lower.includes('análisis premium') ||
    lower.includes('análisis profundo') ||
    lower.includes('tendencia') ||
    lower.includes('tendencias') ||
    lower.includes('patrón') ||
    lower.includes('patron') ||
    lower.includes('estadística avanzada') ||
    lower.includes('estadistica avanzada')
  );
}

/** Match a query to a tool based on keywords. */
function matchTool(query: string, tools: Tool[]): Tool | null {
  const lower = query.toLowerCase();

  if (lower.includes('jackpot') || lower.includes('bote')) {
    return tools.find((t) => t.name === 'get_jackpot') ?? null;
  }
  if (lower.includes('historial') || lower.includes('history') || lower.includes('últimos') || lower.includes('ultimos')) {
    return tools.find((t) => t.name === 'get_history') ?? null;
  }
  if (lower.includes('premio') || lower.includes('prize') || lower.includes('tier')) {
    return tools.find((t) => t.name === 'get_prize_tiers') ?? null;
  }
  if (
    lower.includes('resultado') ||
    lower.includes('result') ||
    lower.includes('sorteo') ||
    lower.includes('números') ||
    lower.includes('numeros') ||
    lower.includes('qué salió') ||
    lower.includes('que salio')
  ) {
    return tools.find((t) => t.name === 'get_latest_result') ?? null;
  }

  // Default: try get_latest_result if state/game mentioned
  if (/\b(FL|GA|NY)\b/i.test(query)) {
    return tools.find((t) => t.name === 'get_latest_result') ?? null;
  }

  return null;
}

/** Extract simple key=value args from query text. */
function extractArgs(query: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const lower = query.toLowerCase();

  // Extract state
  const stateMatch = query.match(/\b(FL|GA|NY)\b/i);
  if (stateMatch) args.state = stateMatch[1].toUpperCase();

  // Extract game
  const gamePatterns: [RegExp, string][] = [
    [/pick\s*2/i, 'pick2'],
    [/pick\s*3/i, 'pick3'],
    [/pick\s*4/i, 'pick4'],
    [/pick\s*5/i, 'pick5'],
    [/fantasy\s*5/i, 'fantasy5'],
    [/power\s*ball/i, 'powerball'],
    [/mega\s*millions?/i, 'megaMillions'],
    [/cash\s*3/i, 'cash3'],
    [/cash\s*4/i, 'cash4'],
    [/numbers/i, 'numbers'],
    [/win\s*4/i, 'win4'],
    [/take\s*5/i, 'take5'],
  ];
  for (const [pattern, gameId] of gamePatterns) {
    if (pattern.test(query)) {
      args.game_id = gameId;
      break;
    }
  }

  // Default game if state mentioned but no game
  if (args.state && !args.game_id) {
    args.game_id = 'pick3';
  }

  // Extract limit for history
  const limitMatch = lower.match(/(?:últimos?|ultimos?|last|los)\s+(\d+)/);
  if (limitMatch) args.limit = parseInt(limitMatch[1], 10);

  return args;
}

/** Log a query to ai_query_log (AIA-1 audit). */
function logQuery(
  db: DatabaseSync,
  telegramUserId: number | null,
  query: string,
  intent: string,
  refused: boolean,
  answer: string | null,
): void {
  db.prepare(
    `INSERT INTO ai_query_log (telegram_user_id, query, intent, refused, answer)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(telegramUserId, query, intent, refused ? 1 : 0, answer);
}
