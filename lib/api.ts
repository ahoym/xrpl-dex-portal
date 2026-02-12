import type { NextRequest } from "next/server";
import { Wallet, isValidClassicAddress } from "xrpl";
import type { TxResponse } from "xrpl";
import type { ApiError, DexAmount } from "./xrpl/types";
import { Assets } from "./assets";

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/** Extract the optional `network` query param from a NextRequest. */
export function getNetworkParam(request: NextRequest): string | undefined {
  return request.nextUrl.searchParams.get("network") ?? undefined;
}

/**
 * Parse an integer query parameter, falling back to `defaultValue` when the
 * param is missing or not a valid integer, and clamping to `maxValue`.
 */
export function parseIntQueryParam(
  searchParams: URLSearchParams,
  key: string,
  defaultValue: number,
  maxValue: number,
): number {
  const raw = parseInt(searchParams.get(key) ?? "", 10);
  return Math.min(Number.isNaN(raw) ? defaultValue : raw, maxValue);
}

/**
 * Validate that all `fields` are truthy on `data`.
 * Returns a 400 Response listing missing fields, or null if all present.
 */
export function validateRequired(
  data: Record<string, unknown>,
  fields: string[],
): Response | null {
  const missing = fields.filter((f) => !data[f]);
  if (missing.length > 0) {
    return Response.json(
      { error: `Missing required fields: ${missing.join(", ")}` } satisfies ApiError,
      { status: 400 },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Seed / wallet helpers
// ---------------------------------------------------------------------------

/**
 * Try to derive a Wallet from a seed string.
 * Returns `{ wallet }` on success or `{ error: Response }` on failure.
 */
export function walletFromSeed(seed: string): { wallet: Wallet } | { error: Response } {
  try {
    return { wallet: Wallet.fromSeed(seed) };
  } catch {
    return {
      error: Response.json(
        { error: "Invalid seed format" } satisfies ApiError,
        { status: 400 },
      ),
    };
  }
}

// ---------------------------------------------------------------------------
// Address validation
// ---------------------------------------------------------------------------

/**
 * Return a 400 Response if `address` is not a valid XRPL classic address.
 * `fieldName` is used in the error message (e.g. "recipientAddress").
 */
export function validateAddress(address: string, fieldName: string): Response | null {
  if (!isValidClassicAddress(address)) {
    return Response.json(
      { error: `Invalid ${fieldName}` } satisfies ApiError,
      { status: 400 },
    );
  }
  return null;
}

/**
 * Return a 400 Response if the wallet's address doesn't match the expected address.
 */
export function validateSeedMatchesAddress(wallet: Wallet, address: string): Response | null {
  if (wallet.address !== address) {
    return Response.json(
      { error: "Seed does not match the account address in the URL" } satisfies ApiError,
      { status: 400 },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Field-specific validation
// ---------------------------------------------------------------------------

/**
 * Return a 400 Response if `amount` is not a finite positive number.
 * `fieldName` is used in the error message (e.g. "amount", "takerGets.value").
 */
export function validatePositiveAmount(amount: string, fieldName: string): Response | null {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Response.json(
      { error: `${fieldName} must be a positive number` } satisfies ApiError,
      { status: 400 },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// DexAmount validation
// ---------------------------------------------------------------------------

/**
 * Validate a DexAmount object (currency + value + optional issuer).
 * Returns a 400 Response on the first validation failure, or null if valid.
 *
 * Checks:
 * 1. `currency` and `value` are present
 * 2. Non-XRP currencies have an `issuer`
 * 3. The `issuer` (when present) is a valid XRPL classic address
 * 4. The `value` is a finite positive number
 */
export function validateDexAmount(amount: DexAmount, fieldName: string): Response | null {
  if (!amount.currency || !amount.value) {
    return Response.json(
      { error: `${fieldName} must include currency and value` } satisfies ApiError,
      { status: 400 },
    );
  }

  if (amount.currency !== Assets.XRP && !amount.issuer) {
    return Response.json(
      { error: `${fieldName}.issuer is required for non-XRP currencies` } satisfies ApiError,
      { status: 400 },
    );
  }

  if (amount.currency !== Assets.XRP && amount.issuer) {
    const bad = validateAddress(amount.issuer, `${fieldName}.issuer address`);
    if (bad) return bad;
  }

  const bad = validatePositiveAmount(amount.value, `${fieldName}.value`);
  if (bad) return bad;

  return null;
}

// ---------------------------------------------------------------------------
// Currency pair validation (orderbook / trades)
// ---------------------------------------------------------------------------

/** Validated currency pair returned by `validateCurrencyPair`. */
export interface CurrencyPair {
  baseCurrency: string;
  baseIssuer: string | undefined;
  quoteCurrency: string;
  quoteIssuer: string | undefined;
}

/**
 * Validate base/quote currency pair query params from a NextRequest.
 * Returns either a 400 Response (error) or a validated CurrencyPair object.
 */
export function validateCurrencyPair(request: NextRequest): Response | CurrencyPair {
  const sp = request.nextUrl.searchParams;
  const baseCurrency = sp.get("base_currency");
  const baseIssuer = sp.get("base_issuer") ?? undefined;
  const quoteCurrency = sp.get("quote_currency");
  const quoteIssuer = sp.get("quote_issuer") ?? undefined;

  if (!baseCurrency || !quoteCurrency) {
    return Response.json(
      { error: "Missing required query params: base_currency, quote_currency" } satisfies ApiError,
      { status: 400 },
    );
  }

  if (baseCurrency !== Assets.XRP && !baseIssuer) {
    return Response.json(
      { error: "base_issuer is required for non-XRP base currency" } satisfies ApiError,
      { status: 400 },
    );
  }

  if (quoteCurrency !== Assets.XRP && !quoteIssuer) {
    return Response.json(
      { error: "quote_issuer is required for non-XRP quote currency" } satisfies ApiError,
      { status: 400 },
    );
  }

  if (baseIssuer && !isValidClassicAddress(baseIssuer)) {
    return Response.json(
      { error: "Invalid base_issuer address" } satisfies ApiError,
      { status: 400 },
    );
  }

  if (quoteIssuer && !isValidClassicAddress(quoteIssuer)) {
    return Response.json(
      { error: "Invalid quote_issuer address" } satisfies ApiError,
      { status: 400 },
    );
  }

  return { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer };
}

// ---------------------------------------------------------------------------
// Transaction result helpers
// ---------------------------------------------------------------------------

/**
 * Extract the TransactionResult string from an XRPL submit response's meta.
 * Returns undefined if meta is missing or not in the expected shape.
 */
export function getTransactionResult(meta: unknown): string | undefined {
  if (typeof meta === "object" && meta !== null && "TransactionResult" in meta) {
    const value = (meta as Record<string, unknown>).TransactionResult;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/**
 * Return a 400 error Response if the transaction failed, or null on success.
 * Replaces the common 5-line result-check pattern in API routes.
 */
export function txFailureResponse(result: TxResponse): Response | null {
  const txResult = getTransactionResult(result.result.meta);
  if (txResult && txResult !== "tesSUCCESS") {
    return Response.json(
      { error: `Transaction failed: ${txResult}`, result: result.result },
      { status: 400 },
    );
  }
  return null;
}

/**
 * Check whether an error from xrpl.js is an "account not found" error.
 * RippledError sets `message` to `error_message` ("Account not found.")
 * and stores the error code in `data.error` ("actNotFound").
 */
export function isAccountNotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message.includes("actNotFound") || err.message.includes("Account not found")) {
    return true;
  }
  const data = (err as Error & { data?: { error?: string } }).data;
  return data?.error === "actNotFound";
}

/**
 * Build a JSON error Response from a caught error.
 * When checkNotFound is true, returns 404 for XRPL "actNotFound" errors.
 */
export function apiErrorResponse(
  err: unknown,
  fallbackMessage: string,
  { checkNotFound = false } = {},
): Response {
  const message = process.env.NODE_ENV === "production" || !(err instanceof Error)
    ? fallbackMessage
    : err.message;
  const status = checkNotFound && isAccountNotFound(err) ? 404 : 500;
  return Response.json({ error: message } satisfies ApiError, { status });
}
