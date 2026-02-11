# XRPL API Notes

## `account_offers` does not return transaction hashes

The XRPL `account_offers` command only returns these fields per offer:
- `seq` (offer sequence number)
- `flags`
- `taker_gets`
- `taker_pays`
- `quality`
- `expiration` (optional)

**No transaction hash is included.** To get the hash of the transaction that created an offer, you must cross-reference `account_tx` results, filtering for `OfferCreate` transactions and matching by sequence number. This requires an additional API call and matching logic, adding network overhead.
