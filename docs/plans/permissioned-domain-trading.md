# Parallel Plan: Permissioned Domain Trading

## Context

The XRPL now supports permissioned domains (XLS-80, live on mainnet Feb 4 2026) and permissioned DEX trading (XLS-81). Users need the ability to view permissioned domain order books and place offers into them. This adds a domain selector to the trade page, threads domain ID through the entire data/API stack, and supports the hybrid flag for dual-book offers. Credential validation is deferred to issue #27.

## Shared Contract

### Types

```typescript
// lib/xrpl/types.ts — add "hybrid" to union, domainID to request
export type OfferFlag = "passive" | "immediateOrCancel" | "fillOrKill" | "sell" | "hybrid";

export interface CreateOfferRequest {
  seed: string;
  takerGets: DexAmount;
  takerPays: DexAmount;
  flags?: OfferFlag[];
  expiration?: number;
  offerSequence?: number;
  domainID?: string; // NEW
  network?: string;
}

// lib/wallet-adapter/types.ts — add domainID to params
export interface CreateOfferParams {
  takerGets: DexAmount;
  takerPays: DexAmount;
  flags?: OfferFlag[];
  expiration?: number;
  domainID?: string; // NEW
  network: string;
}

// lib/hooks/use-trading-data.ts — add domainID to offer, activeDomainID to options
export interface AccountOffer {
  seq: number;
  flags: number;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  expiration?: number;
  domainID?: string; // NEW
}

// lib/xrpl/constants.ts — domain validation
export const DOMAIN_ID_LENGTH = 64;
export const DOMAIN_ID_REGEX = /^[0-9A-F]{64}$/;
```

### API Contracts

```
GET /api/dex/market-data?...&domain={64-char-hex}
  → same response shape, orderbook fetched via raw book_offers RPC when domain set

GET /api/dex/orderbook?...&domain={64-char-hex}
  → same response shape, uses raw book_offers RPC when domain set

GET /api/dex/trades?...&domain={64-char-hex}
  → filters trades by DomainID field on OfferCreate txs

POST /api/dex/offers { ...existing, domainID?: string }
  → sets tx.DomainID on OfferCreate when present

GET /api/accounts/{address}/offers
  → response offers now include domainID?: string
```

### Import Paths

```
OfferFlag, CreateOfferRequest → import from "@/lib/xrpl/types"
CreateOfferParams             → import from "@/lib/wallet-adapter/types"
AccountOffer                  → import from "@/lib/hooks/use-trading-data"
DOMAIN_ID_REGEX, DOMAIN_ID_LENGTH → import from "@/lib/xrpl/constants"
fetchPermissionedOrderbook    → import from "@/lib/xrpl/orderbook-helpers"
useDomainMode                 → import from "@/lib/hooks/use-domain-mode"
DomainSelector                → import from "./components/domain-selector"
```

### Key Constants

```
OfferCreateFlags.tfHybrid = 1048576 (0x00100000) — exported by xrpl.js v4.5.0
xrpl.js v4.5.0 natively supports OfferCreate.DomainID and BookOffersRequest.domain
client.getOrderbook() does NOT support domain — must use raw book_offers RPC
```

### Amendments (post-review)

These amendments override corresponding sections in the agent prompts below:

1. **Hybrid-aware trade filtering (Agent B)**: The domain filter in `fetchAndCacheTrades` must also check the `tfHybrid` flag (0x00100000) so hybrid offers appear in both open and permissioned trade history. See Agent B Step 1 GREEN for updated filter logic.
2. **Preserve URL query params (Agent E)**: `useDomainMode` must preserve existing query params (base, quote, etc.) when updating the URL. Use `new URLSearchParams(searchParams.toString())` as the base, not fresh params.
3. **Explicit shared return type for orderbook functions (Agent B)**: Both `fetchAndNormalizeOrderbook` and `fetchPermissionedOrderbook` must share an explicit `OrderbookResult` return type to catch shape mismatches at compile time.
4. **Reset market data on domain change (Agent E)**: `useFetchMarketData` should reset its data state when `activeDomainID` changes to avoid a flash of stale data from the previous domain.
5. **Prefer native xrpl.js types (Agents B, C)**: Use native `OfferCreate.DomainID` and `BookOffersRequest.domain` types from xrpl.js v4.5.0. Only fall back to `Record<string, unknown>` casts if the types don't exist at compile time.

## Prompt Preamble

_The executor prepends the Shared Contract section (above) followed by this preamble to every agent prompt._

You are implementing part of a parallel plan for permissioned domain trading support.

### Project Commands

- Test: `pnpm test` (vitest, jsdom environment)
- Test single file: `pnpm test <path>`
- Build: `pnpm build` (Next.js build, also serves as type-check)
- Lint: `pnpm lint`

### TDD Workflow

For each change, follow RED → GREEN → REFACTOR:

1. **RED**: Write a failing test first. Run it — it MUST fail.
2. **GREEN**: Implement the minimal code to make the test pass.
3. **REFACTOR**: Clean up while tests stay green.

Run tests after each phase. Before finishing, run the full test suite: `pnpm test`

For steps marked `build-verify`, TDD is impractical (see justification). Instead run `pnpm build` to verify compilation.

### Completion Report

When done, end your output with:

- Files created/modified
- TDD steps completed (N/N)
- Checkpoint: last completed step
- Discoveries: any gotchas, surprises, or learnings that other agents or future work should know about

### General Rules

- DO NOT modify files outside your listed scope
- Read each file before editing to confirm current line numbers
- Use `import type` for type-only imports
- Use `bignumber.js` for financial math, never native floats

## Agents

### A: types-and-constants

- **depends_on**: []
- **creates**: []
- **modifies**: [lib/xrpl/types.ts, lib/xrpl/constants.ts, lib/xrpl/constants.test.ts, lib/xrpl/offers.ts, lib/xrpl/offers.test.ts, lib/wallet-adapter/types.ts]
- **deletes**: []
- **estimated_duration**: 70s
- **description**: Add "hybrid" to OfferFlag, domainID to request types, domain validation constants, and hybrid flag mapping. Foundation agent that unblocks all others.
- **tdd_steps**:
  1. "DOMAIN_ID_REGEX validates 64-char hex" → `lib/xrpl/constants.test.ts::DOMAIN_ID_REGEX`
  2. "hybrid flag resolves to OfferCreateFlags.tfHybrid" → `lib/xrpl/offers.test.ts::resolveOfferFlags hybrid`
  3. "VALID_OFFER_FLAGS contains 5 flags" → `lib/xrpl/offers.test.ts::VALID_OFFER_FLAGS length`
- **prompt**: |

  ## Task

  Add permissioned domain type foundations: the "hybrid" offer flag, domain ID validation constants, and domainID fields on request types.

  ## TDD Steps

  **Step 1: Domain validation constants**
  - RED: In `lib/xrpl/constants.test.ts`, add a `describe("DOMAIN_ID_REGEX")` block:
    - `it("matches a valid 64-char uppercase hex string")` → test with `"A".repeat(64)` and `"0123456789ABCDEF".repeat(4)`
    - `it("rejects lowercase hex")` → test with `"a".repeat(64)`
    - `it("rejects wrong length")` → test with 63 and 65 char strings
    - `it("DOMAIN_ID_LENGTH equals 64")`
  - Run `pnpm test lib/xrpl/constants.test.ts` — MUST fail.
  - GREEN: Add `DOMAIN_ID_LENGTH` and `DOMAIN_ID_REGEX` to `lib/xrpl/constants.ts` (after the validation bounds section, around line 38).
  - Run tests — MUST pass.

  **Step 2: Hybrid flag in offers.ts**
  - RED: In `lib/xrpl/offers.test.ts`:
    - Update `"contains all 4 flag names"` → change to `"contains all 5 flag names"`, set `toHaveLength(5)`, add `expect(VALID_OFFER_FLAGS).toContain("hybrid")`
    - Add `it("returns correct numeric value for hybrid flag")` → `expect(resolveOfferFlags(["hybrid"])).toBe(OfferCreateFlags.tfHybrid)`
    - Update `"returns bitwise OR of all four flags combined"` → include "hybrid" in the array and expected value
  - Run `pnpm test lib/xrpl/offers.test.ts` — MUST fail.
  - GREEN: In `lib/xrpl/types.ts`, add `"hybrid"` to the `OfferFlag` union (line 42). In `lib/xrpl/offers.ts`, add `hybrid: OfferCreateFlags.tfHybrid` to FLAG_MAP (line 8).
  - Run tests — MUST pass.

  **Step 3: domainID on request types**
  - Add `domainID?: string` to `CreateOfferRequest` in `lib/xrpl/types.ts` (after `offerSequence`, line 50).
  - Add `domainID?: string` to `CreateOfferParams` in `lib/wallet-adapter/types.ts`.
  - No test needed — type-only change verified by build.

  **Step 4: Run full test suite** — `pnpm test`

  ## Files You Own
  - `lib/xrpl/types.ts` — modify (add "hybrid" to OfferFlag, domainID to CreateOfferRequest)
  - `lib/xrpl/constants.ts` — modify (add DOMAIN_ID_LENGTH, DOMAIN_ID_REGEX)
  - `lib/xrpl/constants.test.ts` — modify (add DOMAIN_ID_REGEX tests)
  - `lib/xrpl/offers.ts` — modify (add hybrid to FLAG_MAP)
  - `lib/xrpl/offers.test.ts` — modify (update flag count, add hybrid tests)
  - `lib/wallet-adapter/types.ts` — modify (add domainID to CreateOfferParams)

  ## DO NOT MODIFY

  Any other files. Other agents own all remaining changes.

### B: server-lib-orderbook-trades

- **depends_on**: []
- **soft_depends_on**: [A]
- **creates**: []
- **modifies**: [lib/xrpl/orderbook-helpers.ts, lib/xrpl/trades.ts, lib/xrpl/__tests__/trades-fetch.test.ts]
- **deletes**: []
- **estimated_duration**: 100s
- **description**: Add `fetchPermissionedOrderbook()` using raw `book_offers` RPC with domain param, and add domain filtering to `fetchAndCacheTrades()` with updated cache keys.
- **tdd_steps**:
  1. "fetchAndCacheTrades filters by domain when domain set" → `lib/xrpl/__tests__/trades-fetch.test.ts::domain filtering includes matching`
  2. "fetchAndCacheTrades excludes domain trades when no domain" → `lib/xrpl/__tests__/trades-fetch.test.ts::domain filtering excludes non-matching`
  3. "fetchAndCacheTrades includes hybrid trades in both modes" → `lib/xrpl/__tests__/trades-fetch.test.ts::domain filtering hybrid`
  4. "tradesCacheKey includes domain" → `lib/xrpl/__tests__/trades-fetch.test.ts::tradesCacheKey with domain`
  5. build-verify → "pnpm build" (fetchPermissionedOrderbook + OrderbookResult type — impractical to unit test without full client mock)
- **prompt**: |

  ## Task

  Add permissioned orderbook fetching and domain-aware trade filtering to the server-side lib modules.

  ## Context

  `client.getOrderbook()` does NOT support the `domain` parameter. For permissioned orderbooks, we must use raw `book_offers` RPC requests (two parallel: asks + bids). xrpl.js v4.5.0 types include `BookOffersRequest.domain` natively.

  **Amendment 1 — Hybrid-aware trade filtering**: The domain filter must account for hybrid offers (tfHybrid = 0x00100000). Hybrid offers should appear in both open-DEX and permissioned trade history.

  **Amendment 3 — Shared return type**: Both `fetchAndNormalizeOrderbook` and `fetchPermissionedOrderbook` must use an explicit shared return type so shape mismatches are caught at compile time. Define `OrderbookResult` in `orderbook-helpers.ts` and annotate both functions.

  **Amendment 5 — Native types**: Use native `BookOffersRequest.domain` from xrpl.js v4.5.0 without `as` casts if possible. Only fall back to `Record<string, unknown>` casts if TypeScript rejects the native type.

  ## TDD Steps

  **Step 1: Domain filtering in trades**
  - RED: In `lib/xrpl/__tests__/trades-fetch.test.ts`, add a `describe("domain filtering")` block.
    The `makeEntry` helper builds entries with `tx_json` objects. To add DomainID, spread it into the tx_json override:
    ```typescript
    makeEntry({
      tx_json: {
        TransactionType: "OfferCreate",
        Account: TRADER,
        TakerPays: "10000000",
        TakerGets: { currency: "USD", issuer: ISSUER, value: "5" },
        Fee: "12",
        hash: "DOMAIN_HASH",
        DomainID: "A".repeat(64),
      },
    });
    ```
    Tests:
    - `it("includes trades with matching DomainID when domain is set")` — entry with DomainID "A"×64, call with domain "A"×64 → expect 1 trade
    - `it("excludes trades with non-matching DomainID when domain is set")` — entry with DomainID "B"×64, call with domain "A"×64 → expect 0 trades
    - `it("excludes trades with DomainID when no domain is set")` — entry with DomainID set, call without domain → expect 0 trades
    - `it("includes trades without DomainID when no domain is set")` — normal entry, no domain → expect 1 trade (existing behavior)
    - `it("includes hybrid trades in open-DEX mode")` — entry with DomainID set AND Flags containing tfHybrid (0x00100000), call without domain → expect 1 trade
    - `it("includes hybrid trades in permissioned mode even with non-matching domain")` — entry with DomainID "B"×64 AND Flags containing tfHybrid, call with domain "A"×64 → expect 1 trade
  - Run `pnpm test lib/xrpl/__tests__/trades-fetch.test.ts` — new tests MUST fail.
  - GREEN: Add `domain?: string` param to `fetchAndCacheTrades()` (after quoteIssuer, line 49). After the `TransactionType !== "OfferCreate"` check (line 68), add:
    ```typescript
    const txDomainID = (tx as Record<string, unknown>).DomainID as string | undefined;
    const txFlags = (tx as Record<string, unknown>).Flags as number | undefined;
    const isHybrid = ((txFlags ?? 0) & 0x00100000) !== 0;
    if (!isHybrid) {
      if (domain) {
        if (txDomainID !== domain) continue;
      } else {
        if (txDomainID) continue;
      }
    }
    ```
  - Run tests — MUST pass.

  **Step 2: Cache key with domain**
  - RED: In same test file:
    - `it("includes domain in cache key")` — `expect(tradesCacheKey("net", "XRP", undefined, "USD", "rI", "ABCD".repeat(16))).toContain("ABCD")`
    - `it("uses different cache keys for domain vs no-domain")` — compare two keys, expect different
  - Run — MUST fail.
  - GREEN: Add `domain?: string` param to `tradesCacheKey()` (line 31). Change return to append `:${domain ?? ""}`. Update the call site in `fetchAndCacheTrades()` (line 122) to pass `domain`.
  - Run — MUST pass.

  **Step 3: Shared return type + fetchPermissionedOrderbook**
  - First, define the shared return type in `lib/xrpl/orderbook-helpers.ts`:

    ```typescript
    import type { BookOffersRequest, BookOffer } from "xrpl";
    import type { DepthSummary } from "@/lib/types";

    /** Return shape shared by fetchAndNormalizeOrderbook and fetchPermissionedOrderbook. */
    export interface OrderbookResult {
      buy: ReturnType<typeof normalizeOffer>[];
      sell: ReturnType<typeof normalizeOffer>[];
      depth: DepthSummary;
    }
    ```

  - Annotate the existing `fetchAndNormalizeOrderbook` with `: Promise<OrderbookResult>`.
  - Add `fetchPermissionedOrderbook` alongside it:
    ```typescript
    export async function fetchPermissionedOrderbook(
      client: Client,
      pair: CurrencyPair,
      domain: string,
    ): Promise<OrderbookResult> {
      const { currency1, currency2 } = encodeCurrencyPair(pair);
      const [askRes, bidRes] = await Promise.all([
        client.request({
          command: "book_offers",
          taker_gets: currency1,
          taker_pays: currency2,
          limit: MAX_API_LIMIT,
          domain,
        } satisfies BookOffersRequest),
        client.request({
          command: "book_offers",
          taker_gets: currency2,
          taker_pays: currency1,
          limit: MAX_API_LIMIT,
          domain,
        } satisfies BookOffersRequest),
      ]);
      const sell = (askRes.result.offers as BookOffer[]).map(normalizeOffer);
      const buy = (bidRes.result.offers as BookOffer[]).map(normalizeOffer);
      const { depth } = aggregateDepth(buy, sell);
      return { buy, sell, depth };
    }
    ```
    Note: Use `satisfies BookOffersRequest` instead of `as BookOffersRequest` — this validates the object shape at compile time rather than silently casting. If `domain` isn't in the type, `satisfies` will error (which is what we want — see Amendment 5).
  - Run `pnpm build` to verify compilation.

  **Step 4: Run full test suite** — `pnpm test`

  ## Files You Own
  - `lib/xrpl/orderbook-helpers.ts` — modify (add fetchPermissionedOrderbook)
  - `lib/xrpl/trades.ts` — modify (add domain param + filtering + cache key)
  - `lib/xrpl/__tests__/trades-fetch.test.ts` — modify (add domain tests)

  ## DO NOT MODIFY

  `lib/xrpl/types.ts`, `lib/xrpl/constants.ts`, `lib/xrpl/offers.ts` (Agent A), any API routes (Agent D), any UI files (Agent F).

### C: wallet-adapters

- **depends_on**: []
- **soft_depends_on**: [A]
- **creates**: []
- **modifies**: [lib/wallet-adapter/seed-adapter.ts, lib/wallet-adapter/__tests__/seed-adapter.test.ts, lib/wallet-adapter/build-transactions.ts, lib/wallet-adapter/__tests__/build-transactions.test.ts]
- **deletes**: []
- **estimated_duration**: 80s
- **description**: Pass domainID through seed adapter to API and set DomainID on OfferCreate in build-transactions. Propagates to all extension adapters automatically.
- **tdd_steps**:
  1. "seed adapter includes domainID in createOffer payload" → `lib/wallet-adapter/__tests__/seed-adapter.test.ts::createOffer with domainID`
  2. "seed adapter omits domainID when not provided" → `lib/wallet-adapter/__tests__/seed-adapter.test.ts::createOffer without domainID`
  3. "buildOfferCreateTx sets DomainID when provided" → `lib/wallet-adapter/__tests__/build-transactions.test.ts::buildOfferCreateTx with domainID`
  4. "buildOfferCreateTx omits DomainID when not provided" → `lib/wallet-adapter/__tests__/build-transactions.test.ts::buildOfferCreateTx without domainID`
- **prompt**: |

  ## Task

  Add domainID support to the wallet adapter layer so offers can be placed in permissioned domains.

  ## Landmarks
  - `lib/wallet-adapter/seed-adapter.ts:43-53`: `createOffer()` builds a payload and posts to `/api/dex/offers`. Add `if (params.domainID) payload.domainID = params.domainID;` after line 51 (expiration).
  - `lib/wallet-adapter/build-transactions.ts:48-66`: `buildOfferCreateTx()` builds an `OfferCreate` tx. Add `if (params.domainID) { tx.DomainID = params.domainID; }` after line 63 (expiration). xrpl.js v4.5.0 `OfferCreate` should natively support `DomainID` (Amendment 5). If TypeScript rejects it, fall back to `(tx as Record<string, unknown>).DomainID = params.domainID`.

  ## TDD Steps

  **Step 1: Seed adapter domainID**
  - RED: In `lib/wallet-adapter/__tests__/seed-adapter.test.ts`, in the `createOffer` describe block:
    - `it("includes domainID in payload when provided")` — Call `adapter.createOffer({ takerGets: { currency: "XRP", value: "100" }, takerPays: { currency: "USD", issuer: "rISSUER", value: "50" }, domainID: "A".repeat(64), network: "testnet" })`. Assert the fetch body contains `domainID: "A".repeat(64)`.
    - `it("omits domainID from payload when not provided")` — Call without domainID. Assert body does not have `domainID` key.
  - Run `pnpm test lib/wallet-adapter/__tests__/seed-adapter.test.ts` — MUST fail.
  - GREEN: In `seed-adapter.ts` line 51, add: `if (params.domainID) payload.domainID = params.domainID;`
  - Run — MUST pass.

  **Step 2: Build transactions domainID**
  - RED: In `lib/wallet-adapter/__tests__/build-transactions.test.ts`, in `buildOfferCreateTx` describe:
    - `it("sets DomainID when domainID is provided")` — Call with `domainID: "B".repeat(64)`. Assert `(tx as Record<string, unknown>).DomainID === "B".repeat(64)`.
    - `it("does not set DomainID when domainID is not provided")` — Call without domainID. Assert `(tx as Record<string, unknown>).DomainID` is undefined.
  - Run `pnpm test lib/wallet-adapter/__tests__/build-transactions.test.ts` — MUST fail.
  - GREEN: In `build-transactions.ts` after line 63, add: `if (params.domainID) { tx.DomainID = params.domainID; }` (use native xrpl.js type; fall back to `(tx as Record<string, unknown>).DomainID` only if TS rejects it)
  - Run — MUST pass.

  **Step 3: Run full test suite** — `pnpm test`

  ## Files You Own
  - `lib/wallet-adapter/seed-adapter.ts` — modify
  - `lib/wallet-adapter/__tests__/seed-adapter.test.ts` — modify
  - `lib/wallet-adapter/build-transactions.ts` — modify
  - `lib/wallet-adapter/__tests__/build-transactions.test.ts` — modify

  ## DO NOT MODIFY

  `lib/wallet-adapter/types.ts` (Agent A), any API routes (Agent D), any UI files (Agent F).

### D: api-routes

- **depends_on**: [B]
- **soft_depends_on**: [A]
- **creates**: []
- **modifies**: [app/api/dex/market-data/route.ts, app/api/dex/orderbook/route.ts, app/api/dex/trades/route.ts, app/api/dex/offers/route.ts, app/api/accounts/[address]/offers/route.ts]
- **deletes**: []
- **estimated_duration**: 90s
- **description**: Add domain parameter handling to all DEX API routes — orderbook branching, trade filtering, offer creation with DomainID, and account offers including domainID in response.
- **tdd_steps**:
  1. build-verify → "pnpm build" (API route handlers require running server — tested via integration)
- **prompt**: |

  ## Task

  Add domain parameter support to all DEX API routes. These are Next.js server-side route handlers.

  ## Landmarks and Changes

  **`app/api/dex/market-data/route.ts`** (primary combined endpoint):
  - Add import: `import { DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";`
  - Add import: `import { fetchPermissionedOrderbook } from "@/lib/xrpl/orderbook-helpers";`
  - Line 9: After network param, read `const domain = request.nextUrl.searchParams.get("domain") ?? undefined;`
  - After pair validation (line 12), add domain validation: `if (domain && !DOMAIN_ID_REGEX.test(domain)) { return Response.json({ error: "Invalid domain ID format" }, { status: 400 }); }`
  - Lines 22-31: In the orderbook try/catch, branch: `domain ? fetchPermissionedOrderbook(client, pairOrError as CurrencyPair, domain) : fetchAndNormalizeOrderbook(client, pairOrError as CurrencyPair)`
  - Lines 35-42: Pass `domain` as 7th argument to `fetchAndCacheTrades()`

  **`app/api/dex/orderbook/route.ts`**:
  - Add imports for `DOMAIN_ID_REGEX` and `fetchPermissionedOrderbook`
  - Read + validate domain param
  - Branch orderbook fetch based on domain presence

  **`app/api/dex/trades/route.ts`**:
  - Read domain param from query string
  - Pass domain as 7th argument to `fetchAndCacheTrades()`

  **`app/api/dex/offers/route.ts`**:
  - Add import: `import { DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";`
  - After offerSequence validation (line 39), add domainID validation:
    ```typescript
    if (body.domainID !== undefined) {
      if (typeof body.domainID !== "string" || !DOMAIN_ID_REGEX.test(body.domainID)) {
        return Response.json(
          { error: "domainID must be a 64-character uppercase hex string" } satisfies ApiError,
          { status: 400 },
        );
      }
    }
    ```
  - After offerSequence assignment (line 75), add: `if (body.domainID) { tx.DomainID = body.domainID; }` (use native xrpl.js type per Amendment 5; fall back to `(tx as Record<string, unknown>).DomainID` only if TS rejects it)

  **`app/api/accounts/[address]/offers/route.ts`**:
  - In the `.map()` at lines 33-40, extract and include domainID:
    ```typescript
    const offers =
      response.result.offers?.map((offer) => {
        const domainID = (offer as unknown as Record<string, unknown>).DomainID as
          | string
          | undefined;
        return {
          seq: offer.seq,
          flags: offer.flags,
          taker_gets: fromXrplAmount(offer.taker_gets),
          taker_pays: fromXrplAmount(offer.taker_pays),
          quality: offer.quality,
          expiration: offer.expiration,
          ...(domainID ? { domainID } : {}),
        };
      }) ?? [];
    ```

  ## Verification
  - Run `pnpm build` to verify all routes compile.
  - Run `pnpm test` to verify no regressions.

  ## Files You Own
  - `app/api/dex/market-data/route.ts` — modify
  - `app/api/dex/orderbook/route.ts` — modify
  - `app/api/dex/trades/route.ts` — modify
  - `app/api/dex/offers/route.ts` — modify
  - `app/api/accounts/[address]/offers/route.ts` — modify

  ## DO NOT MODIFY

  Any lib modules (`lib/xrpl/*`, `lib/wallet-adapter/*`) — owned by Agents A, B, C. Any UI files — owned by Agents E, F.

### E: hooks-and-domain-mode

- **depends_on**: []
- **soft_depends_on**: [A]
- **creates**: [lib/hooks/use-domain-mode.ts, lib/hooks/__tests__/use-domain-mode.test.ts]
- **modifies**: [lib/hooks/use-fetch-market-data.ts, lib/hooks/__tests__/use-fetch-market-data.test.ts, lib/hooks/use-trading-data.ts]
- **deletes**: []
- **estimated_duration**: 120s
- **description**: Create the `useDomainMode` hook (localStorage + URL sync) and thread `activeDomainID` through `useFetchMarketData` and `useTradingData`.
- **tdd_steps**:
  1. "useFetchMarketData includes domain in fetch URL" → `lib/hooks/__tests__/use-fetch-market-data.test.ts::includes domain param`
  2. "useFetchMarketData omits domain from URL when not set" → `lib/hooks/__tests__/use-fetch-market-data.test.ts::omits domain param`
  3. "useDomainMode returns null domainID by default" → `lib/hooks/__tests__/use-domain-mode.test.ts::initial state`
  4. "useDomainMode validates domain ID format" → `lib/hooks/__tests__/use-domain-mode.test.ts::validation`
- **prompt**: |

  ## Task

  Create the `useDomainMode` hook and thread `activeDomainID` through market data hooks.

  ## TDD Steps

  **Amendment 4 — Stale data reset**: When `activeDomainID` changes, `useFetchMarketData` should reset its data state to avoid a flash of stale data from the previous domain. Add a `useEffect` that clears orderbook/trades data when `activeDomainID` changes, before the new fetch fires.

  **Step 1: useFetchMarketData domain param**
  - RED: In `lib/hooks/__tests__/use-fetch-market-data.test.ts`:
    - `it("includes domain param in fetch URL when activeDomainID is set")` — Render with `useFetchMarketData(XRP, RLUSD, "testnet", 0, "A".repeat(64))`. Assert fetch URL contains `domain=${"A".repeat(64)}`.
    - `it("does not include domain param when activeDomainID is undefined")` — Render without 5th param. Assert URL does NOT contain "domain=".
  - Run `pnpm test lib/hooks/__tests__/use-fetch-market-data.test.ts` — MUST fail.
  - GREEN: In `lib/hooks/use-fetch-market-data.ts`:
    - Add `activeDomainID?: string` as 5th param (line 20)
    - Line 42 (after building params): `if (activeDomainID) params.set("domain", activeDomainID);`
    - Add `activeDomainID` to useCallback deps (line 77) and useEffect deps (line 84)
    - Add a `useEffect` that resets orderbook/trades state when `activeDomainID` changes (Amendment 4): clear the data to initial/empty state so stale data from the previous domain is not shown while the new fetch is in flight.
  - Run — MUST pass.

  **Step 2: useTradingData threading**
  - In `lib/hooks/use-trading-data.ts`:
    - Add `domainID?: string` to `AccountOffer` interface (line 35)
    - Add `activeDomainID?: string` to `UseTradingDataOptions` (line 43)
    - Destructure `activeDomainID` in function params (line 51)
    - Pass as 5th arg to `useFetchMarketData` (line 82)
  - No new tests — pure interface threading. Verified by build.

  **Step 3: useDomainMode hook**
  - Create `lib/hooks/use-domain-mode.ts`:
    - `"use client"` directive
    - Imports: `useState`, `useEffect`, `useCallback` from react; `useSearchParams`, `useRouter`, `usePathname` from `next/navigation`; `DOMAIN_ID_REGEX` from `@/lib/xrpl/constants`
    - localStorage key: `"xrpl-dex-portal-domain"`
    - State: `domainID: string | null`, `expanded: boolean`, `hydrated: boolean`
    - On mount: check URL param first (`searchParams.get("domain")`), then localStorage fallback
    - `setDomainID(id)`: validate with DOMAIN_ID_REGEX, update state + localStorage + URL. **Amendment 2**: Preserve existing query params by cloning them: `const newParams = new URLSearchParams(searchParams.toString()); newParams.set("domain", id); router.replace(pathname + "?" + newParams.toString(), { scroll: false });`
    - `clearDomain()`: set null, remove from localStorage, remove domain from URL. Same pattern: clone searchParams, `newParams.delete("domain")`, replace.
    - `isActive`: `domainID !== null`
    - Returns: `{ domainID, setDomainID, clearDomain, expanded, setExpanded, isActive, hydrated }`

  - Create `lib/hooks/__tests__/use-domain-mode.test.ts`:
    - Mock `next/navigation`: `useSearchParams` → returns mock with `.get()`, `useRouter` → returns `{ replace: vi.fn() }`, `usePathname` → returns "/trade"
    - `it("returns null domainID and collapsed by default")`
    - `it("isActive is false when domainID is null")`
    - `it("validates domain format — rejects lowercase")`
    - `it("validates domain format — rejects wrong length")`
    - `it("preserves existing query params when setting domain")` — mock searchParams with `base=XRP&quote=USD`, call setDomainID, assert router.replace URL contains both `base=XRP` and `domain=...` (Amendment 2)
  - Run tests — MUST pass.

  **Step 4: Run full test suite** — `pnpm test`

  ## Files You Own
  - `lib/hooks/use-domain-mode.ts` — create
  - `lib/hooks/__tests__/use-domain-mode.test.ts` — create
  - `lib/hooks/use-fetch-market-data.ts` — modify
  - `lib/hooks/__tests__/use-fetch-market-data.test.ts` — modify
  - `lib/hooks/use-trading-data.ts` — modify

  ## DO NOT MODIFY

  `lib/xrpl/types.ts`, `lib/xrpl/constants.ts` (Agent A), `lib/xrpl/trades.ts` (Agent B), any UI components (Agent F).

### F: ui-components

- **depends_on**: []
- **soft_depends_on**: [A, E]
- **creates**: [app/trade/components/domain-selector.tsx]
- **modifies**: [app/trade/page.tsx, app/trade/components/trade-grid.tsx, app/trade/components/trade-form.tsx, app/trade/components/order-book.tsx, app/trade/components/recent-trades.tsx, app/trade/components/orders-sheet.tsx]
- **deletes**: []
- **estimated_duration**: 150s
- **description**: Create the DomainSelector component, integrate domain mode into the trade page, add hybrid checkbox and credential warning to trade form, domain column to orders table, and domain-aware empty states.
- **tdd_steps**:
  1. build-verify → "pnpm build" (UI prop-threading and component wiring — no unit tests for UI in this codebase)
- **prompt**: |

  ## Task

  Create the DomainSelector UI component and integrate permissioned domain support across all trade page components. UI components in this codebase do not have unit tests — verification is via build.

  ## Component Changes

  ### NEW: `app/trade/components/domain-selector.tsx`

  Collapsible panel below currency pair selector:
  - Props: `{ domainID: string | null; onDomainChange: (id: string | null) => void; onClear: () => void; expanded: boolean; onToggleExpanded: (expanded: boolean) => void; isActive: boolean; }`
  - Collapsed: "Permissioned Domain" button with chevron + purple "Active" badge when active
  - Expanded: 64-char hex input with validation, Apply/Clear buttons
  - Validates with `DOMAIN_ID_REGEX` from `@/lib/xrpl/constants`, auto-uppercases input
  - Uses `inputClass`, `labelClass`, `errorTextClass` from `@/lib/ui/ui`
  - Purple badge: `className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"`

  ### `app/trade/page.tsx` — Central integration
  - Import `useDomainMode` from `@/lib/hooks/use-domain-mode`, `DomainSelector` from `./components/domain-selector`
  - Call `const { domainID, setDomainID, clearDomain, expanded, setExpanded, isActive: domainActive } = useDomainMode();`
  - Pass `activeDomainID: domainActive ? domainID! : undefined` to `useTradingData()`
  - Render `<DomainSelector>` between `<CurrencyPairSelector>` and `{showCustomForm && ...}`
  - Update `pairOffers` useMemo: in domain mode → `o.domainID === domainID || (o.flags & 0x00100000) !== 0`; in open mode → `!o.domainID || (o.flags & 0x00100000) !== 0`
  - Pass `activeDomainID={domainActive ? domainID! : undefined}` to `TradeGrid`, `OrdersSheet`, `OrdersSection`

  ### `app/trade/components/trade-grid.tsx` — Thread props
  - Add `activeDomainID?: string` to props, pass to `TradeForm`, `OrderBook`, `RecentTrades`

  ### `app/trade/components/trade-form.tsx` — Domain offer placement
  - Add `activeDomainID?: string` prop
  - Add `hybridMode` state (boolean, default false), reset via useEffect when `activeDomainID` changes
  - When `activeDomainID`: show amber warning banner `"Placing offers in a permissioned domain requires valid credentials for that domain."`
  - When `activeDomainID`: show Hybrid checkbox: `"Hybrid — Places offer on both open DEX and permissioned domain order books"`
  - In flag building: if `hybridMode && activeDomainID`, include `"hybrid"`
  - In submit: if `activeDomainID`, set `domainID` on offer params
  - Amber banner: `className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"`

  ### `app/trade/components/order-book.tsx` — Empty state
  - Add `activeDomainID?: string` prop
  - Empty + domain active: "No orders in this permissioned domain"

  ### `app/trade/components/recent-trades.tsx` — Empty state
  - Add `activeDomainID?: string` prop
  - Empty + domain active: "No recent trades in this permissioned domain"

  ### `app/trade/components/orders-sheet.tsx` — Domain column + cancel filtering
  - Add `domainID?: string` to local `AccountOffer` interface
  - Add `activeDomainID?: string` to `OrdersSheetProps`, pass to `OpenOrdersContent`
  - Add "Domain" column header after "Expiry"
  - Each row: `offer.domainID ? offer.domainID.slice(0, 8) + "..." : "—"`
  - Cancel button visibility: `const isHybrid = (offer.flags & 0x00100000) !== 0; const canCancel = isHybrid || (activeDomainID ? offer.domainID === activeDomainID : !offer.domainID);`
  - Chevron SVG: reuse pattern from orders-sheet.tsx line 98-104

  ## Verification
  - Run `pnpm build` to verify compilation.
  - Run `pnpm test` to verify no regressions.

  ## Files You Own
  - `app/trade/components/domain-selector.tsx` — create
  - `app/trade/page.tsx` — modify
  - `app/trade/components/trade-grid.tsx` — modify
  - `app/trade/components/trade-form.tsx` — modify
  - `app/trade/components/order-book.tsx` — modify
  - `app/trade/components/recent-trades.tsx` — modify
  - `app/trade/components/orders-sheet.tsx` — modify

  ## DO NOT MODIFY

  Any lib modules, API routes, or hooks — owned by Agents A, B, C, D, E.

## DAG Visualization

```
      ┌··→ B (server-libs) ──→ D (api-routes)
A ··──┼··→ C (wallet-adapters)
      └··→ E (hooks) ··→ F (ui)
```

All arrows from A are soft (··→). B→D is hard (──→). E→F is soft (··→). C has no downstream deps — it runs in parallel and is verified via integration tests.

## Pre-Execution Verification

```bash
pnpm install                  # ensure deps are installed
pnpm test -- --run --reporter=verbose 2>&1 | tail -5   # verify test suite works
```

## Critical Path Estimate

| Path          | Agents                           | Estimated Wall-Clock |
| ------------- | -------------------------------- | -------------------- |
| A ··→ B ──→ D | types → server-libs → api-routes | ~210s                |
| A ··→ E ··→ F | types → hooks → ui               | ~200s                |
| A ··→ C       | types → wallet-adapters          | ~100s                |

Total sequential estimate: ~610s
Parallel estimate: ~210s (critical path: A → B → D)
Speedup: ~2.9x

Note: With soft deps, B/C/E start at ~30% of A's duration (~21s). Concurrent agent overhead (3 parallel) adds ~20-30%, realistic estimate ~250s.

## Integration Tests

After all agents complete, verify these cross-agent data flows:

1. **Domain ID flows from hook → API → orderbook**: Write a test or manually verify: set `activeDomainID` in `useTradingData` → `useFetchMarketData` builds URL with `?domain=` → `market-data/route.ts` calls `fetchPermissionedOrderbook()` instead of `fetchAndNormalizeOrderbook()`. Verify by checking that the `domain` query param appears in the fetch URL (hook test) and that the route imports and calls the correct function (code review).

2. **Hybrid flag round-trips through wallet adapter**: Call `buildOfferCreateTx({ ..., flags: ["hybrid"], domainID: "A".repeat(64) })` → verify the returned tx has both `Flags` containing `tfHybrid` (1048576) AND `DomainID` set. This crosses Agent A (flag mapping) + Agent C (tx building).

3. **Account offers include domain metadata through to UI**: The API route (Agent D) maps `DomainID` from raw offers → `domainID` in response. The `AccountOffer` type (Agent A/E) includes `domainID`. The orders table (Agent F) renders the domain column. Verify by reviewing the full chain: route → type → component.

## Verification

1. **Build**: `pnpm build` — no type errors
2. **Tests**: `pnpm test` — all pass including new domain tests
3. **Lint**: `pnpm lint` — clean
4. **Manual testing** (testnet):
   - Trade page → domain selector collapsed by default
   - Enter valid domain ID → purple "Active" badge
   - Order book fetches with `?domain=` param (check Network tab)
   - Invalid domain ID → validation error
   - Place offer with domain → DomainID on tx
   - Hybrid checkbox → tfHybrid flag
   - Page refresh → domain persisted from localStorage
   - URL with `?domain=...` → auto-populated
   - Clear domain → back to open DEX
   - Orders table → Domain column shows ID or "—"

## Execution State

_This section is managed by `/execute-parallel-plan`. Do not edit manually._

| Agent | Status    | Agent ID | Notes                                          |
| ----- | --------- | -------- | ---------------------------------------------- |
| A     | completed | ad3c4dd  | 4/4 TDD steps                                  |
| B     | completed | abb4670  | 4/4 TDD steps                                  |
| C     | completed | a9c9214  | 3/3 TDD steps                                  |
| D     | completed | a082702  | 1/1 build-verify                               |
| E     | completed | a629828  | 4/4 TDD steps                                  |
| F     | completed | a06cb5c  | 1/1 build-verify + 2 lint fixes by coordinator |

Started: 2026-02-18 15:04:25
Last updated: 2026-02-18 15:28:37
Build: pass
Tests: 450/450 pass
Lint: 0 errors, 18 warnings (all pre-existing)
