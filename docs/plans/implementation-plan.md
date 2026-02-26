# XRPL DEX Portal — Implementation Plan

## Context

We're building `xrpl-dex-portal` by adapting the existing `xrpl-issued-currencies-manager` project. The new app focuses on a **single-wallet DEX trading experience** — stripping out multi-wallet issuer/recipient management, compliance (credentials/domains), permissioned DEX, and currency issuance. Adding mainnet support, a contacts system for transfers, and streamlined trust line management.

**Source**: `../xrpl-issued-currencies-manager`
**Target**: this repo (`xrpl-dex-portal`)

---

## Phase 1: Project Scaffolding

| File                 | Action | Notes                                     |
| -------------------- | ------ | ----------------------------------------- |
| `package.json`       | Adapt  | Name → `xrpl-dex-portal`, same deps       |
| `tsconfig.json`      | Copy   |                                           |
| `next.config.ts`     | Copy   | CSP headers fine as-is                    |
| `postcss.config.mjs` | Copy   |                                           |
| `eslint.config.mjs`  | Copy   |                                           |
| `.gitignore`         | Adapt  | Remove `examples/setup-state-*.json` line |
| `app/globals.css`    | Copy   |                                           |
| `app/favicon.ico`    | Copy   |                                           |
| `public/*`           | Copy   | SVG assets                                |
| Run `pnpm install`   |        |                                           |

## Phase 2: Shared Libraries

### Copy as-is

- `lib/xrpl/client.ts`
- `lib/xrpl/currency.ts`
- `lib/xrpl/decode-currency-client.ts`
- `lib/xrpl/build-dex-amount.ts`
- `lib/xrpl/match-currency.ts`
- `lib/rate-limit.ts`
- `lib/ui/ui.ts`

### Adapt

**`lib/types.ts`** — New state model:

```typescript
interface PersistedState {
  network: "devnet" | "testnet" | "mainnet";
  wallet: WalletInfo | null;
}
interface Contact {
  label: string;
  address: string;
  destinationTag?: number;
}
```

- Keep: `WalletInfo`, `TrustLine`, `BalanceEntry`, `OrderBookAmount`, `OrderBookEntry`
- Remove: `CredentialInfo`, `DomainInfo`, old `PersistedState` shape

**`lib/xrpl/types.ts`**:

- Remove: `IssueCurrencyRequest`, all credential/domain request types
- Remove `"hybrid"` from `OfferFlag`, `domainID` from `CreateOfferRequest`
- Add `destinationTag?: number` to `TransferRequest`

**`lib/xrpl/networks.ts`** — Add mainnet:

- `mainnet: { name: "Mainnet", url: "wss://xrplcluster.com", faucet: null }`
- Explorer: `mainnet: "https://livenet.xrpl.org"`

**`lib/assets.ts`** — Add BBRL + mainnet issuers:

- `Assets`: add `BBRL: "BBRL"`
- `WELL_KNOWN_CURRENCIES.mainnet`: `{ RLUSD: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", BBRL: "rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt" }`

**`lib/xrpl/constants.ts`** — Remove credential constants (`MIN_DOMAIN_CREDENTIALS`, `MAX_DOMAIN_CREDENTIALS`, `MAX_CREDENTIAL_TYPE_LENGTH`, `LSF_ACCEPTED`)

**`lib/xrpl/offers.ts`** — Remove `hybrid` from `FLAG_MAP`

**`lib/api.ts`** — Remove `validateCredentialType` function + its import

### Exclude

- `lib/xrpl/credentials.ts`

## Phase 3: Hooks

### Copy as-is

- `lib/hooks/use-local-storage.ts`
- `lib/hooks/use-api-fetch.ts`
- `lib/hooks/use-api-mutation.ts`
- `lib/hooks/use-balances.ts`
- `lib/hooks/use-trust-lines.ts`
- `lib/hooks/use-wallet-generation.ts`
- `lib/hooks/use-trust-line-validation.ts`

### Adapt

**`lib/hooks/use-app-state.tsx`** — Major rewrite for single wallet + contacts:

- Keys: `xrpl-dex-portal-network`, `xrpl-dex-portal-state-{network}`, `xrpl-dex-portal-contacts-{network}`
- Remove legacy migration, all issuer/recipient/credential/domain methods
- Add: `setWallet`, `addContact`, `updateContact`, `removeContact`, `setContacts`
- `readNetwork()` accepts `"mainnet"`

**`lib/hooks/use-trading-data.ts`** — Remove `activeDomainID` from options, fetch calls, effects, and `AccountOffer` interface

**`lib/hooks/use-make-market-execution.ts`** — Remove `activeDomainID` from options and payload

### Exclude

- `use-domain-mode.ts`, `use-account-domains.ts`, `use-account-credentials.ts`, `use-issuer-currencies.ts`

## Phase 4: API Routes

### Copy as-is

- `app/api/accounts/[address]/route.ts`
- `app/api/accounts/[address]/balances/route.ts`
- `app/api/accounts/[address]/trustlines/route.ts` (GET + POST)
- `app/api/accounts/[address]/transactions/route.ts`
- `app/api/dex/offers/cancel/route.ts`

### Adapt

**`app/api/accounts/generate/route.ts`** — Remove `isIssuer`/DefaultRipple logic. Add mainnet guard (400: "Wallet generation not available on mainnet").

**`app/api/accounts/[address]/offers/route.ts`** — Remove `domainID` from offer mapping.

**`app/api/transfers/route.ts`** — Add `DestinationTag` support to Payment tx.

**`app/api/dex/offers/route.ts`** — Remove `domainID` handling from tx construction.

**`app/api/dex/orderbook/route.ts`** — Remove `domain` query param, remove entire permissioned DEX `book_offers` branch. Keep only `client.getOrderbook()` path.

**`app/api/dex/trades/route.ts`** — Remove `domain` query param and domain filtering logic.

### Exclude

- `currencies/issue/`, `credentials/*`, `domains/*`, `accounts/[address]/credentials/`, `accounts/[address]/domains/`, `accounts/[address]/rippling/`

## Phase 5: Shared Components

### Copy as-is

- `app/components/providers.tsx`
- `app/components/explorer-link.tsx`
- `app/components/loading-screen.tsx`
- `app/components/modal-shell.tsx`
- `app/components/balance-display.tsx`

### Adapt

**`app/layout.tsx`** — Title: "XRPL DEX Portal", description updated.

**`app/page.tsx`** — Copy as-is (redirects to `/setup`).

**`app/components/nav-bar.tsx`** — 3 links: Setup, Transfer, Trade. Brand: "XRPL DEX Portal".

**`app/components/network-selector.tsx`** — Add mainnet option + red "REAL FUNDS" indicator when mainnet selected.

**`app/components/empty-wallets.tsx`** — Update message for single-wallet model.

## Phase 6: Setup Page

**`app/setup/page.tsx`** — New, single-wallet layout:

1. Security warning (amber for testnet/devnet, **critical red** for mainnet)
2. Wallet section: generate (testnet/devnet only) or import via seed (paste seed into input, derive address/publicKey via `Wallet.fromSeed()`)
3. Trust lines section (if wallet exists): existing trust lines, one-click buttons from `WELL_KNOWN_CURRENCIES[network]`, custom trust line form
4. Data management: import/export/view JSON, clear all data

**Components:**
| File | Action | Source |
|------|--------|--------|
| `wallet-setup.tsx` | New | Generate or import single wallet |
| `trust-line-management.tsx` | New | One-click trust buttons + existing lines |
| `custom-trust-line-form.tsx` | Copy | From source setup components |
| `trust-line-list.tsx` | Adapt | Remove isLocal/issuer color distinction |
| `secret-field.tsx` | Copy | |
| `security-warning.tsx` | Adapt | Add red mainnet warning |
| `data-management.tsx` | New | Import/export/view/clear with red warning. Export format: `{ network, wallet, contacts }` — includes both wallet and contacts in one JSON file. |

## Phase 7: Transact (Transfer) Page

**`app/transact/page.tsx`** — New:

- Sender is always `state.wallet`
- Contacts manager section (add/edit/remove contacts with label + address + optional dest tag)
- Send button opens transfer modal

**Components:**
| File | Action | Notes |
|------|--------|-------|
| `contacts-manager.tsx` | New | CRUD for contacts (label, address, dest tag) |
| `transfer-modal.tsx` | Adapt | Recipient from contacts or ad-hoc, add dest tag field |

## Phase 8: Trade Page

### Copy as-is

- `order-book.tsx`, `my-open-orders.tsx`, `recent-trades.tsx`
- `balances-panel.tsx`, `currency-pair-selector.tsx`, `custom-currency-form.tsx`

### Adapt

**`app/trade/page.tsx`** — Remove: `useDomainMode`, `WalletSelector`, `DomainSelector`, domain props. `focusedWallet = state.wallet`.

**`trade-grid.tsx`** — Remove domain filtering from `pairOffers` and domain badge rendering.

**`trade-form.tsx`** — Remove `domainID` prop, `hybrid` state/checkbox/flag.

**`make-market-modal.tsx`** — Single wallet (remove wallet selection). Both bids + asks from `wallet` prop.

### Exclude

- `domain-selector.tsx`, `wallet-selector.tsx`

---

## Execution Strategy — Parallelization

```
Batch 1: Phase 1 + Phase 2 (scaffolding + libs — sequential, foundational)
Batch 2: Phase 3 ‖ Phase 4 (hooks + API routes — parallel)
Batch 3: Phase 5 (shared components — needs hooks)
Batch 4: Phase 6 ‖ Phase 7 ‖ Phase 8 (setup + transact + trade — parallel)
Batch 5: Phase 9 (CLAUDE.md + pnpm build verification)
```

---

## Phase 9: CLAUDE.md

Create a `CLAUDE.md` at the project root documenting:

- Project overview and stack
- Commands (`pnpm dev`, `pnpm build`, `pnpm lint`)
- Architecture (pages, API routes, lib module map, hooks)
- localStorage keys and state shapes
- Gotchas (Next.js 16 async params, XRPL client singleton, mainnet restrictions, etc.)

---

## Verification

1. `pnpm build` — must compile without errors
2. `pnpm dev` — manual test each page:
   - **Setup**: Generate wallet (testnet), import wallet (all networks), one-click trust RLUSD/BBRL, custom trust line, export/import JSON, clear data, mainnet red warning
   - **Transfer**: Add/edit/remove contacts, send to contact, send to ad-hoc address with dest tag
   - **Trade**: Select currency pair, place buy/sell orders, view order book, cancel orders, make market, click-to-prefill from order book
3. Verify no stale imports to removed modules (credentials, domains, domain-mode, issuer-currencies)
