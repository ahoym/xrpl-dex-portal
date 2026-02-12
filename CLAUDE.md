# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single-wallet DEX trading portal for the XRP Ledger. Built by adapting `xrpl-issued-currencies-manager` — stripped multi-wallet management, credentials, domains, permissioned DEX, and currency issuance. Added mainnet support, contacts for transactions, and streamlined trust line management.

## Stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript 5 (strict mode, path alias `@/*` → `./*`)
- **Styling**: Tailwind CSS 4 with dark mode
- **XRPL**: `xrpl` npm package v4.5.0
- **Math**: `bignumber.js` for all financial/trading calculations (never use native floats for currency math)
- **Package manager**: pnpm
- **Node**: 22 (via `.node-version` / `mise.toml`)

## Commands

```bash
pnpm install  # Install dependencies
pnpm dev      # Start dev server (http://localhost:3000)
pnpm build    # Production build (also serves as type-check — no separate tsc)
pnpm start    # Serve production build
pnpm lint     # ESLint (flat config, v9)
```

```bash
pnpm test       # Run tests once (vitest run)
pnpm test:watch # Run tests in watch mode (vitest)
```

Tests use **Vitest** (v4, jsdom environment, globals enabled). Test files live alongside source as `*.test.ts` or in `__tests__/` directories. Path alias `@/*` is resolved in `vitest.config.ts`.

### E2E Tests

E2E smoke tests use **Playwright** (Chromium) against XRPL **testnet** with real network calls. Test files live in `e2e/`.

```bash
pnpm e2e          # Run all E2E tests
pnpm e2e:ui       # Playwright UI mode
pnpm e2e:headed   # Run with visible browser
pnpm e2e:report   # View HTML test report
```

The suite uses a **setup project** pattern: `e2e/global-setup.ts` generates a testnet wallet + RLUSD trust line and saves `storageState` to `.auth/wallet.json`. Trade and transact test projects depend on this setup and load the saved state automatically. The `setup.spec.ts` project runs independently in clean browser state.

## Architecture

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/setup` |
| `/setup` | Wallet generation/import, trust line management, data import/export |
| `/transact` | Contacts manager, send XRP/tokens to contacts or ad-hoc addresses |
| `/trade` | DEX trading: order book, place orders, cancel orders, make-market ladder |

### App Shell

`app/layout.tsx` → `<Providers>` → `<NavBar>` → page content
- `Providers` (`app/components/providers.tsx`) wraps `AppStateProvider` (React Context)
- `NavBar` (`app/components/nav-bar.tsx`) — nav links: Setup, Trade, Transact + NetworkSelector
- No nested layouts — single flat layout for all routes

### State Flow

All client state flows through `AppStateProvider` (via `useAppState()` hook):
- Network selection → drives which localStorage keys are read
- `wallet` and `contacts` are per-network, stored in localStorage
- No server state / no database — everything is client-side localStorage
- `hydrated` flag gates rendering to avoid SSR mismatches
- API routes are stateless — wallet `seed` is sent from the client on each request

### Shared Components

Reusable UI components live in `app/components/`. Before creating a new component, check there first — it likely already exists (modals, loading states, balance formatting, explorer links, etc.).

### API Routes (`app/api/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `accounts/generate` | POST | Generate wallet (keypair on mainnet, funded on testnet/devnet) |
| `accounts/[address]` | GET | Account info |
| `accounts/[address]/balances` | GET | Account balances |
| `accounts/[address]/offers` | GET | Account's open offers |
| `accounts/[address]/transactions` | GET | Transaction history |
| `accounts/[address]/trustlines` | POST | Set trust line |
| `transfers` | POST | Send payment (supports DestinationTag) |
| `dex/offers` | POST | Create DEX offer |
| `dex/offers/cancel` | POST | Cancel DEX offer |
| `dex/orderbook` | GET | Order book for a currency pair |
| `dex/trades` | GET | Recent trades for a pair |
| `dex/market-data` | GET | Market data for a pair |

### API Conventions

- All mutations send `{ network, seed, ... }` in the request body — no auth/sessions
- All reads take `?network=` and `?address=` as query params
- Responses follow `{ success: true, data }` or `{ error: "message" }` shape
- Rate limited via token-bucket (see `lib/rate-limit.ts`)

### Key Lib Modules

- `lib/types.ts` — Core types: `PersistedState`, `WalletInfo`, `Contact`, `BalanceEntry`
- `lib/xrpl/client.ts` — Singleton XRPL WebSocket client per network
- `lib/xrpl/networks.ts` — Network configs (devnet, testnet, mainnet); default is **mainnet**
- `lib/xrpl/currency.ts` — Currency code encoding (3-char standard, 4-20 non-standard → hex)
- `lib/xrpl/decode-currency-client.ts` — Client-side currency hex decoding
- `lib/xrpl/build-dex-amount.ts` — Build XRPL Amount objects for DEX operations
- `lib/xrpl/aggregate-depth.ts` — Server-side order book depth aggregation
- `lib/xrpl/normalize-offer.ts` — Normalize raw XRPL offers for display
- `lib/xrpl/trades.ts` — Trade history parsing
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
- `use-page-visible.ts` — Page visibility detection (pauses polling when tab is hidden)

## localStorage Keys

| Key | Shape | Purpose |
|-----|-------|---------|
| `xrpl-dex-portal-network` | `"devnet" \| "testnet" \| "mainnet"` | Selected network |
| `xrpl-dex-portal-state-{network}` | `{ wallet: WalletInfo \| null }` | Per-network wallet |
| `xrpl-dex-portal-contacts-{network}` | `Contact[]` | Per-network contacts |

## Gotchas

- **Next.js 16 async params**: Route handler params are `Promise`-based — must `await` them (e.g., `const { address } = await params`)
- **XRPL client singleton**: `lib/xrpl/client.ts` maintains one WebSocket connection per network. Don't instantiate new clients.
- **Default network is mainnet**: `lib/xrpl/networks.ts` defaults to mainnet. No faucet — wallet generation creates keypair only (balance = 0). Users must fund externally. Red "REAL FUNDS" warning shown in UI.
- **Currency encoding**: Standard codes are 3 chars. Non-standard (4-20 chars) get hex-encoded to 40-char uppercase. Use `encodeCurrency()` / `decodeCurrencyClient()`.
- **Rate limiting**: API routes use a token-bucket limiter. Default: 20 requests/second, burst of 5.
- **Single wallet model**: One wallet per network, not the multi-wallet issuer/recipient model from the source project.
- **CSP headers**: `next.config.ts` sets strict Content-Security-Policy (self-only for scripts, styles, connections; no iframes). If adding external resources (CDN, analytics, WebSocket URLs), update the CSP or requests will be silently blocked.
- **XRPL WebSocket not in CSP**: The `connect-src 'self'` CSP directive does not include the XRPL WebSocket URLs. This works because API routes (server-side) make the WebSocket connections, not the browser. If you move XRPL calls to the client, you must add the WSS URLs to `connect-src`.
