# Browser Wallet Extension Support

## Overview

Adds support for browser wallet extensions (Crossmark, GemWallet, Xaman, MetaMask Snap) as an alternative to seed-based wallet management. Users can now connect their existing XRPL wallets without exposing private keys to the application.

**Key improvement:** Extension wallets sign transactions in their own secure context and never expose seeds to the app, providing a more secure and user-friendly experience compared to importing/storing raw seeds in localStorage.

## Supported Wallets

| Wallet | Type | Implementation |
|--------|------|----------------|
| **Crossmark** | Chrome extension | `@crossmarkio/sdk` |
| **GemWallet** | Chrome extension | `@gemwallet/api` with native DEX methods |
| **Xaman (Xumm)** | Mobile (QR/deeplink) | `xumm` SDK with async signing workflow |
| **MetaMask Snap** | MetaMask extension | `xrpl-snap` via `wallet_invokeSnap` |
| **Seed wallets** | Local storage | Existing API route implementation (unchanged) |

## Features Added

### Core Architecture
- **`WalletAdapter` abstraction** (`lib/wallet-adapter/`) - Unified interface for all wallet types
- **Client-side transaction building** - Mirrors API route logic for extension wallets
- **Lazy-loaded adapters** - Extension SDKs loaded on-demand via dynamic imports
- **React Context integration** - `useWalletAdapter()` hook provides adapters to all components
- **Adapter registry** - Easy to add new wallets in the future

### UI Enhancements
- **Browser wallet connector** - Auto-detects available extensions with connect buttons
- **Wallet logos** - Visual identification for each wallet type (20px buttons, 16px status)
- **Dynamic button text** - "Confirm in Crossmark..." during extension signing
- **Reconnection flow** - Auto-detects expired sessions, prompts reconnection
- **QR code modal** - For Xaman mobile wallet signing (shows QR + deeplink)
- **Security warnings** - Different messaging for extension vs seed wallets
- **Testnet faucet** - One-click funding for empty testnet/devnet wallets

### Transaction Support
All four transaction types work across all wallet adapters:
- ✅ Send payments (XRP + issued currencies)
- ✅ Create DEX offers
- ✅ Cancel DEX offers
- ✅ Set trust lines

### Error Handling
- Extension not detected → Button disabled with "(not detected)" label
- User rejects signing → "Signing cancelled" error message
- Network mismatch detection (where supported by wallet)
- Transaction failure → Parse and display XRPL result codes
- Xaman payload timeout → Show countdown, allow retry
- Session expiration → Reconnection prompt with retry/disconnect options

## Implementation Highlights

### Adapter Pattern
```typescript
interface WalletAdapter {
  type: WalletType;
  displayName: string;
  isAvailable(): Promise<boolean>;
  connect(network: string): Promise<{ address: string; publicKey: string }>;
  disconnect(): void;
  sendPayment(params: PaymentParams): Promise<TxResult>;
  createOffer(params: CreateOfferParams): Promise<TxResult>;
  cancelOffer(params: CancelOfferParams): Promise<TxResult>;
  setTrustline(params: TrustlineParams): Promise<TxResult>;
}
```

### Zero Breaking Changes
- Seed wallets continue using existing API routes (`SeedAdapter` wraps fetch calls)
- Extension wallets bypass API routes, sign client-side
- `WalletInfo` type extended: `seed` now optional, `type` field added
- localStorage migration: wallets without `type` field default to `type: 'seed'`

### Browser-Safe Currency Encoding
Fixed `lib/xrpl/currency.ts` to use `TextEncoder` instead of Node.js `Buffer` for hex encoding non-standard currency codes.

## Code Quality

### Fixes Applied (from professional code review)
**Critical:**
- ✅ Fixed orphaned adapter instances in `WalletConnector`
- ✅ Fixed Xaman `publicKey` being set to address instead of empty string
- ✅ Fixed Xumm SDK singleton not cleared on disconnect

**Important:**
- ✅ Memoized React Context values to prevent cascading re-renders
- ✅ Moved Xaman payload callback from render to `useEffect`
- ✅ Replaced non-null assertions with explicit validation
- ✅ Fixed `SeedAdapter` always returning `success: true`
- ✅ Added close/cancel to `XamanSigningModal`, surfaced QR errors
- ✅ Surfaced cancel offer errors instead of swallowing
- ✅ Removed unused `xrpl-snap` dependency

**Moderate:**
- ✅ Fixed ESLint `@typescript-eslint/no-explicit-any` error
- ✅ Changed adapter detection from sequential to parallel (`Promise.allSettled`)
- ✅ Tightened `AdapterInfo` constructor type

**Not Fixed (pre-existing):**
- 2 ESLint `react-hooks/exhaustive-deps` warnings (existed before this branch)

### Testing
- ✅ Build passes: `pnpm build` (TypeScript + production build)
- ✅ Lint passes (except 2 pre-existing warnings)
- ✅ Manual testing on testnet:
  - Crossmark: connect, place offer, cancel offer, send payment, set trust line
  - GemWallet: connect, full transaction flow
  - MetaMask Snap: connect (fixed connection + trust line issues), transactions
  - Xaman: connect via QR, sign on mobile, complete transactions
  - Seed wallet: verified zero regression

## Files Changed

### New Files
- `lib/wallet-adapter/` (9 files)
  - `types.ts` - Core adapter interface
  - `index.ts` - Registry and factory
  - `build-transactions.ts` - Client-side tx builder
  - `seed-adapter.ts` - Wraps existing API routes
  - `crossmark-adapter.ts` - Crossmark SDK integration
  - `gemwallet-adapter.ts` - GemWallet API integration
  - `xaman-adapter.ts` - Xumm SDK integration
  - `metamask-snap-adapter.ts` - MetaMask Snap RPC
- `lib/hooks/use-wallet-adapter.tsx` - React Context provider
- `lib/wallet-ui.ts` - Shared logo/name helpers
- `app/setup/components/wallet-connector.tsx` - Extension detection UI
- `app/components/xaman-signing-modal.tsx` - QR code modal
- `public/wallets/*.svg` - Wallet logos (4 files)

### Modified Files
- `lib/types.ts` - `WalletInfo.seed` now optional, added `type` field
- `lib/hooks/use-app-state.tsx` - localStorage migration, context memoization
- `lib/xrpl/currency.ts` - Browser-safe hex encoding
- `app/components/providers.tsx` - Wrap `WalletAdapterProvider`
- `app/setup/components/wallet-setup.tsx` - Extension connector + logos
- `app/trade/components/trade-form.tsx` - Use adapter for offers
- `app/trade/components/trade-grid.tsx` - Use adapter for cancel
- `app/trade/components/my-open-orders.tsx` - Surface cancel errors
- `app/transact/components/transfer-modal.tsx` - Use adapter for payments
- `app/setup/components/trust-line-management.tsx` - Use adapter for trust lines
- `app/setup/components/custom-trust-line-form.tsx` - Use adapter, remove seed prop
- `app/setup/components/security-warning.tsx` - Extension-specific warnings
- `next.config.ts` - CSP updates for Xaman (xumm.app, blob: for QR)
- `package.json` - Added 4 wallet SDK dependencies

### Dependencies Added
```json
{
  "@crossmarkio/sdk": "^1.0.7",
  "@gemwallet/api": "^3.8.2",
  "xumm": "^2.0.0",
  "qrcode": "^1.5.4"
}
```

## Migration Path

1. **Existing users:** Seed wallets continue working with zero changes
2. **New users:** Can choose extension wallet or seed at setup
3. **Switching:** Users can disconnect seed wallet and connect extension (or vice versa)
4. **Network switching:** Extension wallets auto-disconnect when switching networks

## Future Enhancements

- [ ] Network mismatch detection for Crossmark/GemWallet
- [ ] Exclude extension wallets from data export
- [ ] Add ledger hardware wallet support
- [ ] Remember last-used wallet type per network
- [ ] Multi-wallet support (multiple wallets per network)

## Screenshots

Browser wallet connection buttons:
- Shows logos + names for detected wallets
- "not detected" state for unavailable extensions

Connected wallet display:
- Logo + "Connected via {wallet}" badge
- Reconnection prompt when session expires

Xaman QR modal:
- QR code + deeplink button
- "Waiting for signature..." state
- Error handling for QR generation failures

---

**Closes:** N/A (new feature)
**Breaking Changes:** None
**Rollback Plan:** Revert all 12 commits - seed wallets unaffected
