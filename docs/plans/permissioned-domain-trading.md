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
  domainID?: string;        // NEW
  network?: string;
}

// lib/wallet-adapter/types.ts — add domainID to params
export interface CreateOfferParams {
  takerGets: DexAmount;
  takerPays: DexAmount;
  flags?: OfferFlag[];
  expiration?: number;
  domainID?: string;        // NEW
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
  domainID?: string;        // NEW
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

## Agents

### A: types-and-constants

- **depends_on**: []
- **soft_depends_on**: []
- **creates**: []
- **modifies**: [lib/xrpl/types.ts, lib/xrpl/constants.ts, lib/xrpl/constants.test.ts, lib/xrpl/offers.ts, lib/xrpl/offers.test.ts, lib/wallet-adapter/types.ts, lib/wallet-adapter/__tests__/types.test.ts]
- **deletes**: []
- **description**: Add "hybrid" to OfferFlag, domainID to request types, domain validation constants, and hybrid flag mapping. This is the foundation that unblocks all other agents.
- **tdd_steps**:
    1. "DOMAIN_ID_REGEX validates 64-char hex" → `lib/xrpl/constants.test.ts::DOMAIN_ID_REGEX`
    2. "hybrid flag resolves to OfferCreateFlags.tfHybrid" → `lib/xrpl/offers.test.ts::resolveOfferFlags hybrid`
    3. "VALID_OFFER_FLAGS contains 5 flags" → `lib/xrpl/offers.test.ts::VALID_OFFER_FLAGS`
    4. "CreateOfferParams accepts domainID" → `lib/wallet-adapter/__tests__/types.test.ts::domainID`
- **prompt**: |
    ## Task

    Add permissioned domain type foundations: the "hybrid" offer flag, domain ID validation constants, and domainID fields on request types.

    ## Shared Contract

    ```typescript
    // lib/xrpl/types.ts
    export type OfferFlag = "passive" | "immediateOrCancel" | "fillOrKill" | "sell" | "hybrid";
    export interface CreateOfferRequest {
      seed: string; takerGets: DexAmount; takerPays: DexAmount;
      flags?: OfferFlag[]; expiration?: number; offerSequence?: number;
      domainID?: string;  // NEW
      network?: string;
    }

    // lib/wallet-adapter/types.ts
    export interface CreateOfferParams {
      takerGets: DexAmount; takerPays: DexAmount; flags?: OfferFlag[];
      expiration?: number;
      domainID?: string;  // NEW
      network: string;
    }

    // lib/xrpl/constants.ts
    export const DOMAIN_ID_LENGTH = 64;
    export const DOMAIN_ID_REGEX = /^[0-9A-F]{64}$/;
    ```

    ## TDD Workflow (mandatory)

    **Step 1: Domain validation constants**
    - RED: In `lib/xrpl/constants.test.ts`, add a new `describe("DOMAIN_ID_REGEX")` block with tests:
      - `it("matches a valid 64-char uppercase hex string")` → test with `"A".repeat(64)` and `"0123456789ABCDEF".repeat(4)`
      - `it("rejects lowercase hex")` → test with `"a".repeat(64)`
      - `it("rejects wrong length")` → test with 63 and 65 char strings
      - `it("DOMAIN_ID_LENGTH equals 64")`
    - Run `pnpm test lib/xrpl/constants.test.ts` — MUST fail (exports don't exist yet).
    - GREEN: Add `DOMAIN_ID_LENGTH` and `DOMAIN_ID_REGEX` to `lib/xrpl/constants.ts`.
    - Run tests — MUST pass.

    **Step 2: Hybrid flag in offers.ts**
    - RED: In `lib/xrpl/offers.test.ts`:
      - Update the existing `"contains all 4 flag names"` test → change to `"contains all 5 flag names"`, update `toHaveLength(5)`, add `expect(VALID_OFFER_FLAGS).toContain("hybrid")`
      - Add `it("returns correct numeric value for hybrid flag")` → `expect(resolveOfferFlags(["hybrid"])).toBe(OfferCreateFlags.tfHybrid)`
      - Add `it("returns bitwise OR of all five flags combined")` → update the existing all-flags test to include "hybrid"
    - Run `pnpm test lib/xrpl/offers.test.ts` — MUST fail.
    - GREEN: In `lib/xrpl/offers.ts`, add `hybrid: OfferCreateFlags.tfHybrid` to FLAG_MAP. In `lib/xrpl/types.ts`, add `"hybrid"` to the OfferFlag union.
    - Run tests — MUST pass.

    **Step 3: domainID on request types**
    - RED: In `lib/wallet-adapter/__tests__/types.test.ts`, add a test that constructs a `CreateOfferParams` with `domainID: "A".repeat(64)` and verifies it compiles. (Check the existing test pattern in that file.)
    - Run `pnpm test lib/wallet-adapter/__tests__/types.test.ts` — MUST fail.
    - GREEN: Add `domainID?: string` to `CreateOfferParams` in `lib/wallet-adapter/types.ts`. Add `domainID?: string` to `CreateOfferRequest` in `lib/xrpl/types.ts`.
    - Run tests — MUST pass.

    **Step 4: Run full test suite**
    - Run `pnpm test` to verify no regressions.

    ## Files You Own
    - `lib/xrpl/types.ts` — modify
    - `lib/xrpl/constants.ts` — modify
    - `lib/xrpl/constants.test.ts` — modify
    - `lib/xrpl/offers.ts` — modify
    - `lib/xrpl/offers.test.ts` — modify
    - `lib/wallet-adapter/types.ts` — modify
    - `lib/wallet-adapter/__tests__/types.test.ts` — modify

    ## DO NOT MODIFY
    Any other files. Other agents own the remaining changes.

    ## Completion Report
    When done, end your output with:
    - Files created/modified
    - TDD steps completed (N/N)
    - Checkpoint: last completed step
    - Discoveries: any gotchas or learnings

### B: server-lib-orderbook-trades

- **depends_on**: []
- **soft_depends_on**: [A]
- **creates**: []
- **modifies**: [lib/xrpl/orderbook-helpers.ts, lib/xrpl/trades.ts, lib/xrpl/__tests__/trades-fetch.test.ts]
- **deletes**: []
- **description**: Add `fetchPermissionedOrderbook()` using raw `book_offers` RPC with domain param, and add domain filtering to `fetchAndCacheTrades()` with updated cache keys.
- **tdd_steps**:
    1. "fetchAndCacheTrades filters by domain when domain param set" → `lib/xrpl/__tests__/trades-fetch.test.ts::domain filtering includes matching`
    2. "fetchAndCacheTrades excludes domain trades when no domain param" → `lib/xrpl/__tests__/trades-fetch.test.ts::domain filtering excludes non-matching`
    3. "tradesCacheKey includes domain in key" → `lib/xrpl/__tests__/trades-fetch.test.ts::tradesCacheKey with domain`
- **prompt**: |
    ## Task

    Add permissioned orderbook fetching and domain-aware trade filtering to the server-side lib modules.

    ## Context

    `client.getOrderbook()` does NOT support the `domain` parameter. For permissioned orderbooks, we must use raw `book_offers` RPC requests (two parallel: asks + bids). xrpl.js v4.5.0 types include `BookOffersRequest.domain` natively.

    The `fetchAndCacheTrades()` function needs to filter by `DomainID` on each OfferCreate transaction when a domain is specified.

    ## Shared Contract

    ```typescript
    // New function in lib/xrpl/orderbook-helpers.ts
    export async function fetchPermissionedOrderbook(
      client: Client,
      pair: CurrencyPair,
      domain: string,
    ): Promise<{ buy: NormalizedOffer[], sell: NormalizedOffer[], depth: DepthSummary }>

    // Updated signature in lib/xrpl/trades.ts
    export async function fetchAndCacheTrades(
      client: Client, network: string,
      baseCurrency: string, baseIssuer: string | undefined,
      quoteCurrency: string, quoteIssuer: string | undefined,
      domain?: string,  // NEW optional param
    ): Promise<Trade[]>

    // Updated cache key
    export function tradesCacheKey(
      network: string, baseCurrency: string, baseIssuer: string | undefined,
      quoteCurrency: string, quoteIssuer: string | undefined,
      domain?: string,  // NEW optional param
    ): string
    ```

    ## Landmarks

    - `lib/xrpl/orderbook-helpers.ts`: Currently has `encodeCurrencyPair()` and `fetchAndNormalizeOrderbook()`. Add `fetchPermissionedOrderbook()` alongside them. Reuse `encodeCurrencyPair()`, `normalizeOffer()` from `./normalize-offer`, and `aggregateDepth()` from `./aggregate-depth`.
    - `lib/xrpl/trades.ts`: `fetchAndCacheTrades()` iterates `response.result.transactions`. Add domain filtering after the `TransactionType !== "OfferCreate"` check: if `domain` is set, skip txs where `(tx as Record<string, unknown>).DomainID !== domain`; if no domain, skip txs where `(tx as Record<string, unknown>).DomainID` is truthy. Update `tradesCacheKey()` to append `:${domain ?? ""}`.

    ## Reference: Source project implementation

    The source project (`xrpl-issued-currencies-manager`) implements permissioned orderbook as:
    ```typescript
    const askReq: BookOffersRequest = {
      command: "book_offers",
      taker_gets: currency1,
      taker_pays: currency2,
      limit,
      domain,
    };
    ```
    Two parallel requests for asks (base→quote) and bids (quote→base).

    ## TDD Workflow (mandatory)

    **Step 1: Domain filtering in trades**
    - RED: In `lib/xrpl/__tests__/trades-fetch.test.ts`, add a new `describe("domain filtering")` block:
      - `it("includes trades with matching DomainID when domain param is set")`: Create a `makeEntry` with `tx_json` that has `DomainID: "A".repeat(64)`. Call `fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER, "A".repeat(64))`. Expect 1 trade.
      - `it("excludes trades with non-matching DomainID when domain param is set")`: Create entry with DomainID "B".repeat(64), call with domain "A".repeat(64). Expect 0 trades.
      - `it("excludes trades with DomainID when no domain param is set")`: Create entry with DomainID set, call without domain param. Expect 0 trades.
      - `it("includes trades without DomainID when no domain param is set")`: Create a normal entry (no DomainID), call without domain. Expect 1 trade (existing behavior).
    - Run `pnpm test lib/xrpl/__tests__/trades-fetch.test.ts` — new tests MUST fail.
    - GREEN: Implement domain filtering in `fetchAndCacheTrades()`. Add `domain?: string` parameter. After the `TransactionType !== "OfferCreate"` check, add domain filtering logic.
    - Run tests — MUST pass.

    **Step 2: Cache key with domain**
    - RED: In same test file, add:
      - `it("includes domain in cache key")`: `expect(tradesCacheKey("net", "XRP", undefined, "USD", "rI", "ABCD1234".padEnd(64, "0"))).toContain("ABCD1234")`
      - `it("uses different cache keys for domain vs no-domain")`: compare two keys, expect them to be different.
    - Run tests — MUST fail.
    - GREEN: Update `tradesCacheKey()` to include domain.
    - Run tests — MUST pass.

    **Step 3: fetchPermissionedOrderbook**
    - This function makes raw XRPL RPC calls which are hard to unit test without mocking the entire client. Implement it without TDD, following the source project pattern. Ensure it:
      - Uses `encodeCurrencyPair()` to build currency objects
      - Makes two parallel `client.request()` calls with `command: "book_offers"` and `domain` field
      - Maps results through `normalizeOffer()`
      - Computes depth via `aggregateDepth()`
    - Use `import type { BookOffersRequest, BookOffer } from "xrpl"` for types.

    **Step 4: Run full test suite**
    - Run `pnpm test` to verify no regressions.

    IMPORTANT: The `makeEntry` helper in the test file creates entries with `tx_json` objects. To add `DomainID`, you need to override the `tx_json` or extend `makeEntry` to accept a `domainID` option. Look at how the existing `makeEntry` helper works and extend it appropriately.

    ## Files You Own
    - `lib/xrpl/orderbook-helpers.ts` — modify (add fetchPermissionedOrderbook)
    - `lib/xrpl/trades.ts` — modify (add domain param + filtering + cache key)
    - `lib/xrpl/__tests__/trades-fetch.test.ts` — modify (add domain tests)

    ## DO NOT MODIFY
    Any other files. Specifically do NOT modify types.ts, constants.ts, offers.ts, or any API routes.

    ## Completion Report
    When done, end your output with:
    - Files created/modified
    - TDD steps completed (N/N)
    - Checkpoint: last completed step
    - Discoveries: any gotchas or learnings

### C: wallet-adapters

- **depends_on**: []
- **soft_depends_on**: [A]
- **creates**: []
- **modifies**: [lib/wallet-adapter/seed-adapter.ts, lib/wallet-adapter/__tests__/seed-adapter.test.ts, lib/wallet-adapter/build-transactions.ts, lib/wallet-adapter/__tests__/build-transactions.test.ts]
- **deletes**: []
- **description**: Pass domainID through seed adapter to API and set DomainID on OfferCreate in build-transactions. Propagates to all extension adapters automatically.
- **tdd_steps**:
    1. "seed adapter includes domainID in createOffer payload" → `lib/wallet-adapter/__tests__/seed-adapter.test.ts::createOffer with domainID`
    2. "seed adapter omits domainID when not provided" → `lib/wallet-adapter/__tests__/seed-adapter.test.ts::createOffer without domainID`
    3. "buildOfferCreateTx sets DomainID when provided" → `lib/wallet-adapter/__tests__/build-transactions.test.ts::buildOfferCreateTx with domainID`
    4. "buildOfferCreateTx omits DomainID when not provided" → `lib/wallet-adapter/__tests__/build-transactions.test.ts::buildOfferCreateTx without domainID`
- **prompt**: |
    ## Task

    Add domainID support to the wallet adapter layer so offers can be placed in permissioned domains.

    ## Shared Contract

    ```typescript
    // lib/wallet-adapter/types.ts (modified by Agent A)
    export interface CreateOfferParams {
      takerGets: DexAmount; takerPays: DexAmount; flags?: OfferFlag[];
      expiration?: number;
      domainID?: string;  // NEW
      network: string;
    }
    ```

    xrpl.js v4.5.0 natively supports `OfferCreate.DomainID` as a typed field.

    ## Landmarks

    - `lib/wallet-adapter/seed-adapter.ts:43-53`: `createOffer()` builds a payload object and posts to `/api/dex/offers`. Add `if (params.domainID) payload.domainID = params.domainID;` after the expiration line.
    - `lib/wallet-adapter/build-transactions.ts:48-66`: `buildOfferCreateTx()` builds an `OfferCreate` transaction. Add `if (params.domainID) { tx.DomainID = params.domainID; }` after the expiration line. The xrpl.js `OfferCreate` type includes `DomainID` natively in v4.5.0.

    ## TDD Workflow (mandatory)

    **Step 1: Seed adapter domainID**
    - RED: In `lib/wallet-adapter/__tests__/seed-adapter.test.ts`, add:
      - `it("createOffer includes domainID when provided")`: Call `adapter.createOffer({ takerGets: { currency: "XRP", value: "100" }, takerPays: { currency: "USD", issuer: "rISSUER", value: "50" }, domainID: "A".repeat(64), network: "testnet" })`. Assert `body.domainID` equals `"A".repeat(64)`.
      - `it("createOffer omits domainID when not provided")`: Use existing createOffer test pattern without domainID, assert `body.domainID` is undefined.
    - Run `pnpm test lib/wallet-adapter/__tests__/seed-adapter.test.ts` — new tests MUST fail.
    - GREEN: In `seed-adapter.ts`, add `if (params.domainID) payload.domainID = params.domainID;` in the `createOffer` method.
    - Run tests — MUST pass.

    **Step 2: Build transactions domainID**
    - RED: In `lib/wallet-adapter/__tests__/build-transactions.test.ts`, add to the `buildOfferCreateTx` describe block:
      - `it("sets DomainID when domainID is provided")`: Call with `domainID: "B".repeat(64)`. Assert `(tx as Record<string, unknown>).DomainID` equals `"B".repeat(64)`. Note: use the cast because TypeScript may need it depending on how DomainID is defined.
      - `it("does not set DomainID when domainID is not provided")`: Use existing test pattern without domainID, assert `(tx as Record<string, unknown>).DomainID` is undefined.
    - Run `pnpm test lib/wallet-adapter/__tests__/build-transactions.test.ts` — new tests MUST fail.
    - GREEN: In `build-transactions.ts`, add `if (params.domainID) { tx.DomainID = params.domainID; }` after the expiration block. If TypeScript complains about DomainID not being on OfferCreate, try `tx.DomainID = params.domainID` directly first (xrpl.js v4.5.0 should support it). If it doesn't compile, use `(tx as Record<string, unknown>).DomainID = params.domainID`.
    - Run tests — MUST pass.

    **Step 3: Run full test suite**
    - Run `pnpm test` to verify no regressions.

    ## Files You Own
    - `lib/wallet-adapter/seed-adapter.ts` — modify
    - `lib/wallet-adapter/__tests__/seed-adapter.test.ts` — modify
    - `lib/wallet-adapter/build-transactions.ts` — modify
    - `lib/wallet-adapter/__tests__/build-transactions.test.ts` — modify

    ## DO NOT MODIFY
    Any other files. Do NOT modify types.ts (owned by Agent A) or any API routes.

    ## Completion Report
    When done, end your output with:
    - Files created/modified
    - TDD steps completed (N/N)
    - Checkpoint: last completed step
    - Discoveries: any gotchas or learnings

### D: api-routes

- **depends_on**: [A, B]
- **soft_depends_on**: []
- **creates**: []
- **modifies**: [app/api/dex/market-data/route.ts, app/api/dex/orderbook/route.ts, app/api/dex/trades/route.ts, app/api/dex/offers/route.ts, app/api/accounts/[address]/offers/route.ts]
- **deletes**: []
- **description**: Add domain parameter handling to all DEX API routes — orderbook branching, trade filtering, offer creation with DomainID, and account offers including domainID in response.
- **tdd_steps**:
    1. "API routes accept domain parameter" → manual verification via build
- **prompt**: |
    ## Task

    Add domain parameter support to all DEX API routes. These are server-side Next.js route handlers.

    ## Shared Contract

    ```
    GET /api/dex/market-data?...&domain={64-char-hex}
    GET /api/dex/orderbook?...&domain={64-char-hex}
    GET /api/dex/trades?...&domain={64-char-hex}
    POST /api/dex/offers { ...existing, domainID?: string }
    GET /api/accounts/{address}/offers → offers include domainID?: string

    Domain validation: /^[0-9A-F]{64}$/
    ```

    Import `DOMAIN_ID_REGEX` from `@/lib/xrpl/constants` for validation.
    Import `fetchPermissionedOrderbook` from `@/lib/xrpl/orderbook-helpers` for permissioned orderbook fetching.

    ## Landmarks and Changes

    **`app/api/dex/market-data/route.ts`** (primary combined endpoint):
    - Line 9: Read `const domain = request.nextUrl.searchParams.get("domain") ?? undefined;`
    - After pair validation, add domain validation: `if (domain && !DOMAIN_ID_REGEX.test(domain)) { return Response.json({ error: "Invalid domain ID format" }, { status: 400 }); }`
    - Lines 22-31: Replace the orderbook try/catch. When `domain` is set, call `fetchPermissionedOrderbook(client, pairOrError as CurrencyPair, domain)` instead of `fetchAndNormalizeOrderbook(...)`.
    - Lines 35-45: Pass `domain` as the 7th argument to `fetchAndCacheTrades(...)`.

    **`app/api/dex/orderbook/route.ts`**:
    - Read domain param from query string.
    - Validate domain format.
    - When domain is set, call `fetchPermissionedOrderbook(client, pair, domain)` instead of `fetchAndNormalizeOrderbook(client, pair)`.
    - Return same response shape.

    **`app/api/dex/trades/route.ts`**:
    - Read domain param from query string.
    - Pass domain as 7th argument to `fetchAndCacheTrades(...)`.

    **`app/api/dex/offers/route.ts`**:
    - After line 39 (offerSequence validation), add domainID validation:
      ```typescript
      if (body.domainID !== undefined) {
        if (typeof body.domainID !== "string" || !DOMAIN_ID_REGEX.test(body.domainID)) {
          return Response.json({ error: "domainID must be a 64-character uppercase hex string" }, { status: 400 });
        }
      }
      ```
    - After line 75 (offerSequence assignment), add: `if (body.domainID) { tx.DomainID = body.domainID; }`
    - The xrpl.js `OfferCreate` type supports `DomainID` natively in v4.5.0.

    **`app/api/accounts/[address]/offers/route.ts`**:
    - In the `.map()` at lines 33-40, add `domainID` to the mapped object:
      ```typescript
      const offers = response.result.offers?.map((offer) => {
        const domainID = (offer as unknown as Record<string, unknown>).DomainID as string | undefined;
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

    ## TDD Workflow (mandatory)

    These are server-side API routes without existing unit tests. The verification is via build:

    **Step 1: Implement all route changes**
    - Modify each route file as described above.

    **Step 2: Type-check**
    - Run `pnpm build` to verify all routes compile without type errors.
    - If build fails, fix type issues.

    **Step 3: Run full test suite**
    - Run `pnpm test` to verify no regressions.

    ## Files You Own
    - `app/api/dex/market-data/route.ts` — modify
    - `app/api/dex/orderbook/route.ts` — modify
    - `app/api/dex/trades/route.ts` — modify
    - `app/api/dex/offers/route.ts` — modify
    - `app/api/accounts/[address]/offers/route.ts` — modify

    ## DO NOT MODIFY
    Any other files. The lib modules are owned by Agents A and B.

    ## Completion Report
    When done, end your output with:
    - Files created/modified
    - TDD steps completed (N/N)
    - Checkpoint: last completed step
    - Discoveries: any gotchas or learnings

### E: hooks-and-domain-mode

- **depends_on**: [A]
- **soft_depends_on**: []
- **creates**: [lib/hooks/use-domain-mode.ts, lib/hooks/__tests__/use-domain-mode.test.ts]
- **modifies**: [lib/hooks/use-fetch-market-data.ts, lib/hooks/__tests__/use-fetch-market-data.test.ts, lib/hooks/use-trading-data.ts]
- **deletes**: []
- **description**: Create the `useDomainMode` hook (localStorage + URL sync) and thread `activeDomainID` through `useFetchMarketData` and `useTradingData`.
- **tdd_steps**:
    1. "useFetchMarketData includes domain in fetch URL when activeDomainID is set" → `lib/hooks/__tests__/use-fetch-market-data.test.ts::includes domain param`
    2. "useFetchMarketData omits domain from URL when not set" → `lib/hooks/__tests__/use-fetch-market-data.test.ts::omits domain param`
    3. "useDomainMode returns correct initial state" → `lib/hooks/__tests__/use-domain-mode.test.ts::initial state`
    4. "useDomainMode validates domain ID format" → `lib/hooks/__tests__/use-domain-mode.test.ts::validation`
- **prompt**: |
    ## Task

    Create the `useDomainMode` hook for managing domain state (localStorage + URL sync) and thread `activeDomainID` through the market data fetching hooks.

    ## Shared Contract

    ```typescript
    // lib/hooks/use-domain-mode.ts (NEW)
    export function useDomainMode(): {
      domainID: string | null;
      setDomainID: (id: string | null) => void;
      clearDomain: () => void;
      expanded: boolean;
      setExpanded: (expanded: boolean) => void;
      isActive: boolean;
      hydrated: boolean;
    }

    // localStorage key: "xrpl-dex-portal-domain"
    // URL search param: "domain"
    // On hydration: URL takes precedence over localStorage
    // Validation: DOMAIN_ID_REGEX from @/lib/xrpl/constants

    // lib/hooks/use-fetch-market-data.ts — add activeDomainID param
    export function useFetchMarketData(
      sellingCurrency: CurrencyOption | null,
      buyingCurrency: CurrencyOption | null,
      network: string,
      refreshKey: number,
      activeDomainID?: string,  // NEW
    )

    // lib/hooks/use-trading-data.ts — add activeDomainID to options
    interface UseTradingDataOptions {
      address: string | undefined;
      sellingValue: string;
      buyingValue: string;
      refreshKey: number;
      customCurrencies: { currency: string; issuer: string }[];
      activeDomainID?: string;  // NEW
    }
    ```

    ## Landmarks

    - `lib/hooks/use-fetch-market-data.ts:16-21`: Function signature. Add `activeDomainID?: string` as 5th param. At line 36, after building `params`, add `if (activeDomainID) params.set("domain", activeDomainID);`. Add `activeDomainID` to useEffect deps at line 84 and useCallback deps at line 90.
    - `lib/hooks/use-trading-data.ts:38-44`: `UseTradingDataOptions` interface. Add `activeDomainID?: string`. At line 82, pass `activeDomainID` as 5th arg to `useFetchMarketData`. Also add `domainID?: string` to the `AccountOffer` interface at line 29-36.

    ## Implementation Notes for useDomainMode

    - Use `useSearchParams()` from `next/navigation` to read URL params
    - Use `useRouter()` and `usePathname()` for URL updates via `router.replace()`
    - On mount (useEffect with []), check URL param first, then localStorage fallback
    - `setDomainID(id)`: if valid (matches DOMAIN_ID_REGEX), update state + localStorage + URL; if null, clear all
    - `clearDomain()`: set state to null, remove from localStorage, remove from URL
    - `isActive`: `domainID !== null && DOMAIN_ID_REGEX.test(domainID)`
    - Use `{ scroll: false }` on router.replace to avoid scroll jumps

    ## TDD Workflow (mandatory)

    **Step 1: useFetchMarketData domain param**
    - RED: In `lib/hooks/__tests__/use-fetch-market-data.test.ts`, add:
      - `it("includes domain param in fetch URL when activeDomainID is set")`: Render with `useFetchMarketData(XRP, RLUSD, "testnet", 0, "A".repeat(64))`. Assert fetch URL contains `domain=${"A".repeat(64)}`.
      - `it("does not include domain param when activeDomainID is undefined")`: Render without the 5th param. Assert fetch URL does NOT contain "domain=".
    - Run `pnpm test lib/hooks/__tests__/use-fetch-market-data.test.ts` — new tests MUST fail.
    - GREEN: Add `activeDomainID` param to `useFetchMarketData`, include in params, add to deps.
    - Run tests — MUST pass.

    **Step 2: useTradingData threading**
    - Modify `UseTradingDataOptions` and `AccountOffer` interfaces. Pass `activeDomainID` to `useFetchMarketData`.
    - No new tests needed — this is pure interface threading.

    **Step 3: useDomainMode hook**
    - Create `lib/hooks/use-domain-mode.ts` with the implementation.
    - Create `lib/hooks/__tests__/use-domain-mode.test.ts` with tests:
      - `it("returns null domainID and collapsed by default")`
      - `it("isActive is false when domainID is null")`
      - `it("isActive is true when domainID is valid 64-char hex")`
      - Mock `useSearchParams`, `useRouter`, `usePathname` from `next/navigation`.
    - Run tests — MUST pass.

    **Step 4: Run full test suite**
    - Run `pnpm test` to verify no regressions.

    ## Files You Own
    - `lib/hooks/use-domain-mode.ts` — create
    - `lib/hooks/__tests__/use-domain-mode.test.ts` — create
    - `lib/hooks/use-fetch-market-data.ts` — modify
    - `lib/hooks/__tests__/use-fetch-market-data.test.ts` — modify
    - `lib/hooks/use-trading-data.ts` — modify

    ## DO NOT MODIFY
    Any other files. Do NOT modify types.ts, constants.ts (Agent A), trades.ts (Agent B), or any UI components (Agent F).

    ## Completion Report
    When done, end your output with:
    - Files created/modified
    - TDD steps completed (N/N)
    - Checkpoint: last completed step
    - Discoveries: any gotchas or learnings

### F: ui-components

- **depends_on**: [A, C, E]
- **soft_depends_on**: []
- **creates**: [app/trade/components/domain-selector.tsx]
- **modifies**: [app/trade/page.tsx, app/trade/components/trade-grid.tsx, app/trade/components/trade-form.tsx, app/trade/components/order-book.tsx, app/trade/components/recent-trades.tsx, app/trade/components/orders-sheet.tsx]
- **deletes**: []
- **description**: Create the DomainSelector component, integrate domain mode into the trade page, add hybrid checkbox and credential warning to trade form, domain column to orders table, and domain-aware empty states.
- **tdd_steps**:
    1. "UI integration compiles correctly" → manual verification via build
- **prompt**: |
    ## Task

    Create the DomainSelector UI component and integrate permissioned domain support across all trade page components.

    ## Shared Contract

    ```typescript
    // From Agent A (lib/xrpl/constants.ts):
    import { DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";

    // From Agent E (lib/hooks/use-domain-mode.ts):
    import { useDomainMode } from "@/lib/hooks/use-domain-mode";
    // Returns: { domainID, setDomainID, clearDomain, expanded, setExpanded, isActive, hydrated }

    // From Agent A (lib/hooks/use-trading-data.ts):
    // AccountOffer now has domainID?: string
    // UseTradingDataOptions now has activeDomainID?: string

    // From Agent A (lib/wallet-adapter/types.ts):
    // CreateOfferParams now has domainID?: string

    // From Agent A (lib/xrpl/types.ts):
    // OfferFlag now includes "hybrid"

    // tfHybrid bitmask for checking offer flags:
    const TF_HYBRID = 0x00100000; // 1048576
    ```

    ## Component Changes

    ### NEW: `app/trade/components/domain-selector.tsx`
    Collapsible panel below currency pair selector:
    - Props: `{ domainID: string | null; onDomainChange: (id: string | null) => void; onClear: () => void; expanded: boolean; onToggleExpanded: (expanded: boolean) => void; isActive: boolean; }`
    - Collapsed: shows "Permissioned Domain" button with chevron + purple "Active" badge when active
    - Expanded: 64-char hex input with validation, Apply/Clear buttons
    - Validates with `DOMAIN_ID_REGEX`, auto-uppercases input
    - Uses `inputClass`, `labelClass`, `errorTextClass` from `@/lib/ui/ui`

    ### `app/trade/page.tsx` — Central integration
    - Import `useDomainMode`, `DomainSelector`
    - Call `useDomainMode()` hook
    - Pass `activeDomainID: domainActive ? domainID! : undefined` to `useTradingData()`
    - Render `<DomainSelector>` between `<CurrencyPairSelector>` and `{showCustomForm && ...}`
    - Update `pairOffers` useMemo filter: in domain mode show offers where `o.domainID === domainID` OR `(o.flags & 0x00100000) !== 0` (hybrid). In open mode show offers where `!o.domainID` OR `(o.flags & 0x00100000) !== 0` (hybrid).
    - Pass `activeDomainID` to `TradeGrid`, `OrdersSheet`, `OrdersSection`

    ### `app/trade/components/trade-grid.tsx` — Thread props
    - Add `activeDomainID?: string` to `TradeGridProps`
    - Pass to `TradeForm`, `OrderBook`, `RecentTrades`

    ### `app/trade/components/trade-form.tsx` — Domain offer placement
    - Add `activeDomainID?: string` prop
    - Add `hybridMode` state (boolean, default false), reset when `activeDomainID` changes
    - When `activeDomainID` is set, show amber warning banner: "Placing offers in a permissioned domain requires valid credentials for that domain."
    - When `activeDomainID` is set, show Hybrid checkbox in the flags section (next to Sell Mode): `Hybrid — Places offer on both open DEX and permissioned domain order books`
    - In `buildFlags()`: if `hybridMode && activeDomainID`, push `"hybrid"`
    - In `handleSubmit()`: if `activeDomainID`, set `offerParams.domainID = activeDomainID`

    ### `app/trade/components/order-book.tsx` — Empty state
    - Add `activeDomainID?: string` prop
    - When book is empty and `activeDomainID` is set: "No orders in this permissioned domain" instead of generic empty state

    ### `app/trade/components/recent-trades.tsx` — Empty state
    - Add `activeDomainID?: string` prop
    - When trades are empty and `activeDomainID` is set: "No recent trades in this permissioned domain"

    ### `app/trade/components/orders-sheet.tsx` — Domain column
    - Add `domainID?: string` to local `AccountOffer` interface
    - Add `activeDomainID?: string` to `OrdersSheetProps`
    - Pass `activeDomainID` to `OpenOrdersContent`
    - In open orders table, add "Domain" column header after "Expiry"
    - In each row, show: `offer.domainID ? offer.domainID.slice(0, 8) + "..." : "—"` (use "—" for open DEX)
    - Cancel button visibility logic: `canCancel = (isHybrid) || (activeDomainID ? offer.domainID === activeDomainID : !offer.domainID)` where `isHybrid = (offer.flags & 0x00100000) !== 0`

    ## Styling Notes
    - Purple badge: `className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"`
    - Amber warning: `className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"`
    - Chevron for collapsible: use the SVG pattern from orders-sheet.tsx line 98-104
    - Domain column header style: match existing th styles in orders-sheet.tsx

    ## TDD Workflow (mandatory)

    UI components don't have unit tests in this codebase. Verification is via build:

    **Step 1: Create DomainSelector component**
    **Step 2: Modify page.tsx integration**
    **Step 3: Modify trade-grid.tsx prop threading**
    **Step 4: Modify trade-form.tsx**
    **Step 5: Modify order-book.tsx and recent-trades.tsx empty states**
    **Step 6: Modify orders-sheet.tsx domain column**
    **Step 7: Run `pnpm build` to verify compilation**
    **Step 8: Run `pnpm test` to verify no regressions**

    ## Files You Own
    - `app/trade/components/domain-selector.tsx` — create
    - `app/trade/page.tsx` — modify
    - `app/trade/components/trade-grid.tsx` — modify
    - `app/trade/components/trade-form.tsx` — modify
    - `app/trade/components/order-book.tsx` — modify
    - `app/trade/components/recent-trades.tsx` — modify
    - `app/trade/components/orders-sheet.tsx` — modify

    ## DO NOT MODIFY
    Any other files. Types, lib modules, API routes, and hooks are owned by other agents.

    ## Completion Report
    When done, end your output with:
    - Files created/modified
    - TDD steps completed (N/N)
    - Checkpoint: last completed step
    - Discoveries: any gotchas or learnings

## DAG Visualization

```
A (types+constants) ──soft──┬──→ B (orderbook+trades) ──┐
                            │                            ├──→ D (api routes) ──┐
                            ├──→ C (wallet adapters)  ───────────────────────── ├──→ F (ui)
                            │                                                  │
                            └──→ E (hooks+domain mode) ────────────────────────┘
```

Critical path: A → B → D → F (or A → E → F)

## Pre-Execution Verification

```bash
pnpm install                  # ensure deps are installed
pnpm test -- --run --reporter=verbose 2>&1 | tail -5   # verify test suite works
```

## Integration Tests

After all agents complete, run:

```bash
pnpm build    # Full type-check + Next.js compilation
pnpm test     # All unit tests pass
pnpm lint     # No lint errors
```

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

| Agent | Status | Agent ID | Duration | Notes |
|-------|--------|----------|----------|-------|
| A | pending | — | — | |
| B | pending | — | — | soft-blocked by: A |
| C | pending | — | — | soft-blocked by: A |
| D | pending | — | — | blocked by: A, B |
| E | pending | — | — | blocked by: A |
| F | pending | — | — | blocked by: A, C, E |

Started: —
Last updated: —
Build: not yet run
