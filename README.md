# XRPL DEX Portal

A self-custodial trading portal for the [XRP Ledger](https://xrpl.org/) decentralized exchange. Trade tokens, manage trust lines, and send payments — all from a single wallet you control, with no sign-ups, no databases, and no third-party custody.

## What It Does

### Wallet Management (Setup)

- **Generate or import** an XRPL wallet (seed-based)
- **Manage trust lines** to opt in to tokens like RLUSD and BBRL
- **Export/import** your wallet data for backup and portability
- Works on **mainnet**, **testnet**, and **devnet** — switch networks at any time

### DEX Trading (Trade)

- **Live order book** showing bids and asks for any token pair, with aggregated depth
- **Place limit orders** to buy or sell tokens at a specific price
- **Cancel open orders** individually
- **Make-market ladder** to place multiple orders across a price range
- **Recent trade history** and market data for the selected pair

### Payments (Transact)

- **Send XRP or any trusted token** to any XRPL address
- **Contacts manager** to save and label frequently used addresses
- **Destination Tag** support for exchanges and hosted wallets

## How It Works

The app runs entirely in your browser. Your wallet seed is stored in localStorage and never leaves your machine except to sign transactions through the app's server-side API routes, which connect to the XRPL network over WebSocket and submit on your behalf. There is no backend database, no user accounts, and no server-side state — every API call is stateless.

## Getting Started

1. `pnpm install`
2. `pnpm dev`
3. Open http://localhost:3000
4. Go to **Setup** to generate or import a wallet

## Development

```bash
pnpm build       # Production build + type-check
pnpm lint        # ESLint
pnpm test        # Unit tests (Vitest)
pnpm e2e         # E2E tests (Playwright, runs against testnet)
```

## Documentation

See [CLAUDE.md](./CLAUDE.md) for architecture, API routes, state management, and conventions.
