# Trade Page Patterns

Patterns and techniques discovered while building the `/trade` page for the XRPL DEX Portal.

## Reactive Refresh Over Polling

Instead of polling open orders every 3s alongside market data, watch the `recentTrades` array for new trade hashes matching the user's wallet address. Track seen hashes in a `useRef(new Set())`. On first load, seed the set without triggering a refresh. On subsequent updates, if any new hash has `trade.account === address`, silently refetch open orders. This reduces API calls while keeping data fresh — orders disappear within one poll cycle of the trade appearing.

**Key points:**
- Use `useRef(new Set())` to track already-seen trade hashes
- On initial load, populate the set without triggering side effects
- On subsequent updates, diff against the set to detect new fills
- Only refetch open orders when a new trade involves the user's address

## Client-Side Expiration Tracking

For XRPL offers with an `expiration` field (Ripple epoch seconds), convert to JS timestamp via `fromRippleEpoch()`, compute the delay until expiry, and `setTimeout` to trigger a silent refetch of open orders 1 second after expiration. Only schedule timers for offers expiring within 5 minutes. Clean up timers on unmount or when the offers list changes. This avoids continuous polling while ensuring expired orders don't linger in the UI.

**Key points:**
- Convert XRPL Ripple epoch to JS via `fromRippleEpoch()`
- Schedule `setTimeout` for 1 second after computed expiry time
- Only bother with offers expiring within a 5-minute window
- Clean up all timers on unmount or when the offers list re-renders

## Silent Fetch Pattern

Add a `silent = false` parameter to fetch callbacks (e.g., `fetchAccountOffers`). When `silent` is true, skip `setLoading(true)` and don't clear data on error — only update state on success. Use `silent: true` for background/reactive refreshes triggered by fill detection or expiration timers, so the UI doesn't flash loading skeletons. Use `silent: false` (default) for initial loads and explicit user-triggered refreshes.

**Key points:**
- Default `silent` to `false` for backward compatibility
- When silent, skip `setLoading(true)` to avoid loading skeleton flashes
- When silent, don't clear existing data on error — fail gracefully
- Use `silent: true` for all background/automated refreshes
- Use `silent: false` for user-initiated actions and initial page load

## Balance Validation for DEX Orders

The trade form must check the user's available balance for the currency being *spent* before allowing order submission.

**Key detail:** Buy orders spend the **quote currency** (the `total` = amount x price), while sell orders spend the **base currency** (the `amount`).

Look up the balance using `matchesCurrency()` which works with any object having `{ currency, issuer? }` shape. Show an inline error ("Insufficient X balance — you have Y but need Z") and disable the submit button when `spendAmount > availableBalance`.

**Key points:**
- Buy side: validate `total` (amount x price) against quote currency balance
- Sell side: validate `amount` against base currency balance
- Use `matchesCurrency()` for flexible currency matching
- Disable submit button and show inline error with specific amounts
