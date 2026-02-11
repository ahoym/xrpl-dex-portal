# Deployment Learnings

## Vercel Serverless + XRPL WebSocket Connections

On Vercel, each API route can run as a **separate serverless function instance**, and each instance opens its own WebSocket connection to the XRPL node (via the singleton in `lib/xrpl/client.ts` — but the singleton is per-process, not per-deployment).

### The Problem

XRPL public nodes enforce **IP-based connection limits**. When the client polls multiple API routes simultaneously (e.g., orderbook + trades + balances), each route may spawn a separate serverless invocation, each opening its own WebSocket. Under load, this can exhaust the connection limit for the Vercel deployment's outbound IP.

### The Mitigation

Combining multiple XRPL queries into a **single API route** (e.g., a `/api/dex/market-data` endpoint that fetches orderbook + trades in one handler) means:

- **One serverless invocation** per poll cycle instead of N
- **One WebSocket connection** per invocation (via the per-process singleton)
- Reduced connection pressure on XRPL public nodes

### Key Takeaway

The `lib/xrpl/client.ts` singleton only helps within a single serverless invocation. Across concurrent invocations, each process gets its own singleton instance and its own WebSocket. Reducing the number of concurrent API calls is the primary lever for managing connection count on Vercel.
