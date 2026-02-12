# XRPL Internals — Learnings

## RippleState Balance Sign Convention

In XRPL `RippleState` ledger entries, the balance field follows this convention:

- **Positive balance** → the **low** account holds the IOU (has the asset)
- **Negative balance** → the **high** account holds the IOU

The "low" and "high" accounts are determined by the `LowLimit.issuer` and `HighLimit.issuer` fields in the `RippleState` object.

**When computing balance deltas** (finalValue - previousValue):
- A positive delta means the **low** account gained tokens
- A negative delta means the **high** account gained tokens

**Common mistake**: Assuming positive balance means the high account holds the asset. This silently zeroes out balance changes in trade/fill parsers, causing filled orders to not appear.

**Reference**: See `lib/xrpl/filled-orders.ts` — the `getBalanceChangesClient()` function implements this correctly with:
```
addDelta(lowAccount, currency, highAccount, delta);
addDelta(highAccount, currency, lowAccount, -delta);
```

## Detecting Filled Orders from account_tx

To determine if an `OfferCreate` transaction resulted in a fill (partial or full), parse the transaction metadata:

1. **Filter**: Only look at `OfferCreate` transactions with `TransactionResult === "tesSUCCESS"`
2. **Parse `AffectedNodes`**:
   - `AccountRoot` modifications → XRP balance changes (in drops, divide by 1,000,000)
   - `RippleState` modifications → Token balance changes (see sign convention above)
3. **Compute per-account deltas** for the wallet address
4. **Identify fills**: A fill means the wallet gained one currency and lost another (opposite signs on base/quote deltas)
5. **Filter fee-only changes**: Unfilled offers still modify `AccountRoot` by the tx fee (~12 drops = 0.000012 XRP). Use a threshold of `< 0.001` on both base and quote amounts to skip these false positives.
6. **Determine side**: If the wallet's base currency delta is positive, it's a buy; if negative, it's a sell.

**Reference**: See `lib/xrpl/filled-orders.ts` — `parseFilledOrders()` implements this pattern.
