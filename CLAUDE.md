# XRPL DEX Portal

Single-wallet DEX trading portal for the XRP Ledger. Built by adapting `xrpl-issued-currencies-manager` — stripped multi-wallet management, credentials, domains, permissioned DEX, and currency issuance. Added mainnet support, contacts for transfers, and streamlined trust line management.

## Stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 with dark mode
- **XRPL**: `xrpl` npm package v4.5.0
- **Package manager**: pnpm

## Commands

```bash
pnpm dev      # Start dev server
pnpm build    # Production build
pnpm lint     # ESLint
```

## Architecture

### Pages

| Route | Purpose |
|-------|---------|
| `/setup` | Wallet generation/import, trust line management, data import/export |
| `/transact` | Contacts manager, send XRP/tokens to contacts or ad-hoc addresses |
| `/trade` | DEX trading: order book, place orders, cancel orders, make-market ladder |

### API Routes (`app/api/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `accounts/generate` | POST | Generate wallet (keypair on mainnet, funded on testnet/devnet) |
| `accounts/[address]` | GET | Account info |
| `accounts/[address]/offers` | GET | Account's open offers |
| `balances` | GET | Account balances |
| `trustlines` | POST | Set trust line |
| `transfers` | POST | Send payment (supports DestinationTag) |
| `transactions` | GET | Transaction history |
| `dex/offers` | POST | Create DEX offer |
| `dex/offers/cancel` | POST | Cancel DEX offer |
| `dex/orderbook` | GET | Order book for a currency pair |
| `dex/trades` | GET | Recent trades for a pair |

### Lib Modules

- `lib/types.ts` — Core types: `PersistedState`, `WalletInfo`, `Contact`, `BalanceEntry`
- `lib/xrpl/client.ts` — Singleton XRPL WebSocket client per network
- `lib/xrpl/networks.ts` — Network configs (devnet, testnet, mainnet)
- `lib/xrpl/currency.ts` — Currency code encoding (3-char standard, 4-20 non-standard → hex)
- `lib/xrpl/decode-currency-client.ts` — Client-side currency hex decoding
- `lib/xrpl/build-dex-amount.ts` — Build XRPL Amount objects for DEX operations
- `lib/xrpl/match-currency.ts` — Compare currency+issuer pairs
- `lib/xrpl/offers.ts` — Offer flag mapping
- `lib/xrpl/constants.ts` — XRPL epoch, currency code limits
- `lib/xrpl/types.ts` — Request/response types for XRPL operations
- `lib/assets.ts` — Well-known currency issuers per network (RLUSD, BBRL)
- `lib/rate-limit.ts` — Token-bucket rate limiter for API routes
- `lib/api.ts` — Shared API validation helpers
- `lib/ui/ui.ts` — Shared Tailwind class constants

### Hooks (`lib/hooks/`)

- `use-app-state.tsx` — React Context provider for persisted state + contacts
- `use-local-storage.ts` — localStorage with SSR safety
- `use-api-fetch.ts` / `use-api-mutation.ts` — Data fetching abstractions
- `use-balances.ts` — Account balance polling
- `use-trust-lines.ts` — Trust line fetching and creation
- `use-trust-line-validation.ts` — Trust line form validation
- `use-wallet-generation.ts` — Wallet generation with API call
- `use-trading-data.ts` — Aggregates order book, offers, trades, balances for trade page
- `use-make-market-execution.ts` — Make-market ladder execution logic

## localStorage Keys

| Key | Shape | Purpose |
|-----|-------|---------|
| `xrpl-dex-portal-network` | `"devnet" \| "testnet" \| "mainnet"` | Selected network |
| `xrpl-dex-portal-state-{network}` | `{ wallet: WalletInfo \| null }` | Per-network wallet |
| `xrpl-dex-portal-contacts-{network}` | `Contact[]` | Per-network contacts |

## Gotchas

- **Next.js 16 async params**: Route handler params are `Promise`-based — must `await` them (e.g., `const { address } = await params`)
- **XRPL client singleton**: `lib/xrpl/client.ts` maintains one WebSocket connection per network. Don't instantiate new clients.
- **Mainnet restrictions**: No faucet — wallet generation creates keypair only (balance = 0). Users must fund externally. Red "REAL FUNDS" warning shown in UI.
- **Currency encoding**: Standard codes are 3 chars. Non-standard (4-20 chars) get hex-encoded to 40-char uppercase. Use `encodeCurrency()` / `decodeCurrencyClient()`.
- **Rate limiting**: API routes use a token-bucket limiter. Default: 20 requests/second, burst of 5.
- **Single wallet model**: One wallet per network, not the multi-wallet issuer/recipient model from the source project.
