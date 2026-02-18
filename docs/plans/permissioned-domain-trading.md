# Permissioned Domain Support for Trade Page

## Context

The XRPL now supports permissioned domains (XLS-80, live on mainnet Feb 4 2026) and permissioned DEX trading (XLS-81). Users need the ability to view permissioned domain order books and place offers into them. This adds a domain selector to the trade page, threads domain ID through the entire data/API stack, and supports the hybrid flag for dual-book offers. Credential validation is deferred to issue #27.

---

## Implementation Plan

### Step 1: Type Changes

**`lib/xrpl/types.ts`**
- Add `"hybrid"` to `OfferFlag` union
- Add `domainID?: string` to `CreateOfferRequest`

**`lib/wallet-adapter/types.ts`**
- Add `domainID?: string` to `CreateOfferParams`

**`lib/hooks/use-trading-data.ts`** (interfaces only)
- Add `domainID?: string` to `AccountOffer` interface
- Add `activeDomainID?: string` to `UseTradingDataOptions` interface

---

### Step 2: Lib Utilities

**`lib/xrpl/offers.ts`** — Add hybrid to FLAG_MAP
- Add `hybrid: OfferCreateFlags.tfHybrid` (value 1048576 / 0x00100000). xrpl.js v4.5.0 exports this natively — no fallback needed.
- Add `"hybrid"` to `VALID_OFFER_FLAGS` (automatic via `Object.keys`)

**`lib/xrpl/constants.ts`** — Add domain validation constants
- `DOMAIN_ID_LENGTH = 64`
- `DOMAIN_ID_REGEX = /^[0-9A-F]{64}$/`

**`lib/xrpl/orderbook-helpers.ts`** — Add `fetchPermissionedOrderbook()`
- New function alongside existing `fetchAndNormalizeOrderbook()`
- Uses raw `book_offers` RPC with `domain` field (two parallel requests: asks + bids)
- `client.getOrderbook()` doesn't support `domain`, but `BookOffersRequest` in xrpl.js v4.5.0 does include `domain` as a typed field
- Reuses existing `encodeCurrencyPair()`, `normalizeOffer()`, `aggregateDepth()`
- Signature: `fetchPermissionedOrderbook(client: Client, pair: CurrencyPair, domain: string)`

**`lib/xrpl/trades.ts`** — Add domain filtering
- Add optional `domain?: string` param to `fetchAndCacheTrades()`
- When set: filter OfferCreate txs to those with matching `DomainID` field; when not set: exclude txs that have a `DomainID` (to keep open DEX trades clean)
- Add `domain` to `tradesCacheKey()` to separate caches

---

### Step 3: API Route Changes

**`app/api/dex/market-data/route.ts`** — Primary endpoint (combines orderbook + trades)
- Read optional `domain` query param, validate 64-char hex
- Branch: `domain` set → `fetchPermissionedOrderbook()`, else → `fetchAndNormalizeOrderbook()`
- Pass `domain` to `fetchAndCacheTrades()`

**`app/api/dex/orderbook/route.ts`** — Standalone orderbook endpoint
- Same domain branching pattern as market-data

**`app/api/dex/trades/route.ts`** — Standalone trades endpoint
- Pass `domain` query param through to `fetchAndCacheTrades()`

**`app/api/dex/offers/route.ts`** — Offer creation
- Read `body.domainID`, validate format
- Set `tx.DomainID = body.domainID` on the OfferCreate transaction (xrpl.js v4.5.0 types support this natively)

**`app/api/accounts/[address]/offers/route.ts`** — Account offers
- Include `domainID` from each raw offer's `DomainID` field in mapped response

---

### Step 4: Wallet Adapter Changes

**`lib/wallet-adapter/seed-adapter.ts`**
- In `createOffer()`: pass `params.domainID` in payload to API

**`lib/wallet-adapter/build-transactions.ts`**
- In `buildOfferCreateTx()`: set `tx.DomainID = params.domainID` when present
- This automatically propagates to all extension adapters (crossmark, gemwallet, metamask-snap, xaman)

---

### Step 5: Hooks

**NEW: `lib/hooks/use-domain-mode.ts`**
- Manages domain state: `domainID` (string | null), `expanded` (boolean), `isActive` (boolean)
- Syncs to localStorage key `xrpl-dex-portal-domain` AND URL search param `?domain=...`
- On hydration: URL takes precedence over localStorage
- Uses `useSearchParams()` + `router.replace()` with `{ scroll: false }`
- Input validation: only accepts 64-char uppercase hex strings
- Exports: `{ domainID, setDomainID, clearDomain, expanded, setExpanded, isActive, hydrated }`

**`lib/hooks/use-fetch-market-data.ts`**
- Add `activeDomainID?: string` param
- Include `domain` in API query params when set
- Add `activeDomainID` to useEffect/useCallback dependency arrays

**`lib/hooks/use-trading-data.ts`**
- Accept `activeDomainID` from options, pass to `useFetchMarketData()`

---

### Step 6: UI Components

**NEW: `app/trade/components/domain-selector.tsx`** — Collapsible domain panel
- Collapsed by default: shows "Permissioned Domain" toggle button + purple "Active" badge when domain is set
- Expanded: shows 64-char hex input with validation, Apply/Clear buttons
- Validates input format, shows error for invalid hex
- Uses existing UI constants (`inputClass`, `labelClass`, `errorTextClass` from `lib/ui/ui.ts`)

**`app/trade/page.tsx`** — Central integration
- Import and use `useDomainMode()` hook
- Pass `activeDomainID` to `useTradingData()`
- Render `<DomainSelector>` below `<CurrencyPairSelector>`
- Update `pairOffers` filter: in domain mode show matching + hybrid offers; in open mode show non-domain + hybrid offers. Hybrid detected via `flags & 0x00100000` (tfHybrid)
- Pass `activeDomainID` through to `TradeGrid`, `OrdersSheet`, `OrdersSection`

**`app/trade/components/trade-grid.tsx`** — Thread props
- Accept `activeDomainID?: string`, pass to `TradeForm`, `OrderBook`, `RecentTrades`

**`app/trade/components/trade-form.tsx`** — Offer placement with domain support
- Accept `activeDomainID?: string` prop
- Show credential warning banner (amber) when domain is active
- Add Hybrid checkbox (only visible when domain is active) with explanation text: "Places offer on both open DEX and permissioned domain order books"
- Include `domainID` and `"hybrid"` flag in `adapterCreateOffer()` call
- Reset hybridMode when activeDomainID changes

**`app/trade/components/order-book.tsx`** — Domain-aware empty state
- Accept `activeDomainID?: string`
- When domain is active and book is empty: "No orders in this permissioned domain"

**`app/trade/components/recent-trades.tsx`** — Domain-aware empty state
- Accept `activeDomainID?: string`
- When domain is active and trades are empty: "No recent trades in this permissioned domain"

**`app/trade/components/orders-sheet.tsx`** — Domain column + cancel filtering
- Add `domainID?: string` to local `AccountOffer` interface
- Add `activeDomainID?: string` to `OrdersSheetProps`
- Add "Domain" column to open orders table: show truncated domainID or "--" for open DEX
- Cancel button visibility: show only when offer matches active domain, or offer is hybrid, or (no domain active and offer has no domainID)

---

## Key Technical Notes

- **xrpl.js v4.5.0** natively supports `OfferCreate.DomainID`, `OfferCreateFlags.tfHybrid` (value 1048576), and `BookOffersRequest.domain` — no type casts or fallback values needed
- **`client.getOrderbook()`** does NOT support the `domain` parameter — must use raw `book_offers` RPC for permissioned orderbooks
- **Hybrid offers have `DomainID` set** — they are domain offers with an additional flag that also places them on the open book. In the offers table, they appear in both views.
- **`useSearchParams()`** in Next.js 16 may need a `<Suspense>` boundary — check if the existing layout handles this

---

## Files Modified (summary)

| File | Change |
|------|--------|
| `lib/xrpl/types.ts` | Add `"hybrid"` to OfferFlag, `domainID?` to CreateOfferRequest |
| `lib/xrpl/offers.ts` | Add `hybrid: OfferCreateFlags.tfHybrid` to FLAG_MAP |
| `lib/xrpl/constants.ts` | Add `DOMAIN_ID_LENGTH`, `DOMAIN_ID_REGEX` |
| `lib/xrpl/orderbook-helpers.ts` | Add `fetchPermissionedOrderbook()` |
| `lib/xrpl/trades.ts` | Add `domain?` param, filter by DomainID, update cache key |
| `lib/wallet-adapter/types.ts` | Add `domainID?` to CreateOfferParams |
| `lib/wallet-adapter/seed-adapter.ts` | Pass domainID in createOffer payload |
| `lib/wallet-adapter/build-transactions.ts` | Set `tx.DomainID` in buildOfferCreateTx |
| `app/api/dex/market-data/route.ts` | Read domain param, branch fetchers |
| `app/api/dex/orderbook/route.ts` | Read domain param, branch to permissioned path |
| `app/api/dex/trades/route.ts` | Pass domain to fetchAndCacheTrades |
| `app/api/dex/offers/route.ts` | Read domainID from body, set on OfferCreate tx |
| `app/api/accounts/[address]/offers/route.ts` | Include domainID in response |
| `lib/hooks/use-domain-mode.ts` | **NEW** — domain state + localStorage + URL sync |
| `lib/hooks/use-fetch-market-data.ts` | Accept + pass activeDomainID |
| `lib/hooks/use-trading-data.ts` | Accept + pass activeDomainID, update AccountOffer type |
| `app/trade/components/domain-selector.tsx` | **NEW** — collapsible domain input UI |
| `app/trade/page.tsx` | Wire up useDomainMode, domain-aware offer filtering |
| `app/trade/components/trade-grid.tsx` | Thread activeDomainID prop |
| `app/trade/components/trade-form.tsx` | Credential warning, hybrid checkbox, domainID on offer |
| `app/trade/components/order-book.tsx` | Domain-specific empty state |
| `app/trade/components/recent-trades.tsx` | Domain-specific empty state |
| `app/trade/components/orders-sheet.tsx` | Domain column, cancel button filtering |

---

## Verification

1. **Build**: `pnpm build` — should pass with no type errors
2. **Unit tests**: `pnpm test` — existing tests should pass; may need minor updates if test mocks don't include `domainID`
3. **Manual testing (testnet)**:
   - Open trade page → domain selector should be collapsed
   - Enter a valid domain ID → purple "Active" badge appears
   - Order book should fetch from permissioned endpoint (check Network tab for `?domain=` param)
   - Enter an invalid domain ID → validation error shown
   - Place an offer with domain active → check tx on explorer for `DomainID` field
   - Toggle hybrid checkbox → verify `tfHybrid` flag in request
   - Refresh page → domain ID persisted from localStorage
   - Share URL with `?domain=...` → domain auto-populated
   - Clear domain → returns to open DEX, badge disappears
   - Check orders table → "Domain" column shows truncated ID or "--"
4. **Lint**: `pnpm lint` — should pass
