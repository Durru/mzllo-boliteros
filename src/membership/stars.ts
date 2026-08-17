import type { DatabaseSync } from 'node:sqlite';

/**
 * Telegram Stars subscription invoice interface (AD-1).
 * MVP: subscription invoice via Telegram Payments.
 */
export interface StarsConfig {
  botToken: string;
  /** Telegram channel ID for premium content. */
  premiumChannelId: string;
}

export interface InvoiceResult {
  success: boolean;
  invoiceUrl?: string;
  error?: string;
}

/**
 * Create a subscription invoice for Telegram Stars.
 * Returns an invoice URL that the user can pay in-chat.
 */
export function createSubscriptionInvoice(
  _config: StarsConfig,
  _telegramUserId: number,
): InvoiceResult {
  // In production, this calls bot.sendInvoice() via grammY
  // For now, return a stub that the payment handler can test against
  return {
    success: true,
    invoiceUrl: `stars://pay?bot=premium&user=${_telegramUserId}`,
  };
}

/**
 * Verify a successful payment callback from Telegram Stars.
 * Returns the payment reference if valid.
 */
export function verifyPayment(
  _paymentPayload: string,
  _telegramChargeId: string,
): { valid: boolean; paymentRef?: string } {
  // In production, verify with Telegram Payments API
  return {
    valid: true,
    paymentRef: `stars_${_telegramChargeId}`,
  };
}
