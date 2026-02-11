# XRPL API Learnings

## `client.getOrderbook()` Internals

`client.getOrderbook()` always makes **two** internal `book_offers` RPC calls (one per direction: bids and asks), then separates the results into `buy` and `sell` arrays via `separateBuySellOrders()`.

Key implications:

- **There is no option to request only one side.** Even if you only need bids, the client will still fetch both directions.
- **Client-side filtering** (e.g., slicing the returned arrays to limit depth) only saves payload size and rendering cost — it does **not** reduce XRPL WebSocket/connection load.
- Each `getOrderbook()` call = 2 RPC round trips over the WebSocket, regardless of how the results are consumed.

This is relevant when optimizing polling intervals or combining API calls to reduce connection pressure on XRPL public nodes.
