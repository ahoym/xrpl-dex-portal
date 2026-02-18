# Parallel Plan: Credential Management (XLS-70) for Setup Page

## Context

The XRPL DEX Portal needs to support on-ledger credentials (XLS-70). Third parties can issue credentials (e.g., KYC attestations) to wallet addresses. The wallet owner should be able to view, accept, and delete these credentials from the `/setup` page. This is ported from `xrpl-issued-currencies-manager`, scoped to the single-wallet subject experience (no issuing, no domains).

## Shared Contract

### Types

```typescript
// lib/types.ts — add after DepthSummary
export interface CredentialInfo {
  issuer: string;
  credentialType: string;
  accepted: boolean;
  expiresAtMs?: number;  // JS epoch ms (converted from Ripple epoch by server)
  uri?: string;
}

// lib/xrpl/types.ts — add after CancelOfferRequest
export interface AcceptCredentialRequest {
  seed: string;
  issuer: string;
  credentialType: string;
  network?: string;
}

export interface DeleteCredentialRequest {
  seed: string;
  issuer: string;
  credentialType: string;
  network?: string;
}

// lib/xrpl/constants.ts — add in Validation bounds section
export const LSF_ACCEPTED = 0x00010000;
export const MAX_CREDENTIAL_TYPE_LENGTH = 128;

// lib/wallet-adapter/types.ts — add after TrustlineParams
export interface AcceptCredentialParams {
  issuer: string;
  credentialType: string;
  network: string;
}

export interface DeleteCredentialParams {
  issuer: string;
  credentialType: string;
  network: string;
}

// WalletAdapter interface — add methods:
//   acceptCredential(params: AcceptCredentialParams): Promise<TxResult>;
//   deleteCredential(params: DeleteCredentialParams): Promise<TxResult>;
```

### API Contracts

```
GET /api/accounts/{address}/credentials?network={network}
  → { address: string, credentials: CredentialInfo[] }
  Empty array for unfunded/not-found accounts.

POST /api/credentials/accept
  Body: { seed, issuer, credentialType, network? }
  → { result: TxResponse } (201) or { error: string } (400)

POST /api/credentials/delete
  Body: { seed, issuer, credentialType, network? }
  → { result: TxResponse } (201) or { error: string } (400)
```

### Import Paths

```
CredentialInfo          → import from "@/lib/types"
AcceptCredentialRequest → import from "@/lib/xrpl/types"
DeleteCredentialRequest → import from "@/lib/xrpl/types"
LSF_ACCEPTED            → import from "@/lib/xrpl/constants"
MAX_CREDENTIAL_TYPE_LENGTH → import from "@/lib/xrpl/constants"
fromRippleEpoch         → import from "@/lib/xrpl/constants"  (already exists)
encodeCredentialType    → import from "@/lib/xrpl/credentials" (server-side only)
decodeCredentialType    → import from "@/lib/xrpl/credentials" (server-side only)
validateCredentialType  → import from "@/lib/api"
useAccountCredentials   → import from "@/lib/hooks/use-account-credentials"
AcceptCredentialParams  → import from "@/lib/wallet-adapter/types"
DeleteCredentialParams  → import from "@/lib/wallet-adapter/types"
buildCredentialAcceptTx → import from "@/lib/wallet-adapter/build-transactions"
buildCredentialDeleteTx → import from "@/lib/wallet-adapter/build-transactions"
```

### Component Props

```typescript
// credential-management.tsx
interface CredentialManagementProps {
  wallet: WalletInfo;
  network: PersistedState["network"];
  refreshKey: number;
  onRefresh: () => void;
}
```

## Agents

### A: shared-types-and-lib

- **depends_on**: []
- **creates**: [`lib/xrpl/credentials.ts`, `lib/xrpl/__tests__/credentials.test.ts`, `lib/hooks/use-account-credentials.ts`]
- **modifies**: [`lib/types.ts`, `lib/xrpl/types.ts`, `lib/xrpl/constants.ts`, `lib/api.ts`, `lib/__tests__/api.test.ts`]
- **description**: Add all shared types, constants, credential encoding/decoding, API validation helper, and the credentials fetch hook. This is the foundation agent that unblocks B and D.
- **tdd_steps**:
    1. "encodeCredentialType converts UTF-8 to uppercase hex" → `lib/xrpl/__tests__/credentials.test.ts::encodes UTF-8 string to uppercase hex`
    2. "decodeCredentialType converts hex back to UTF-8" → `lib/xrpl/__tests__/credentials.test.ts::decodes hex back to UTF-8 string`
    3. "decodeCredentialType falls back for non-printable" → `lib/xrpl/__tests__/credentials.test.ts::falls back to raw hex for non-printable`
    4. "encodeCredentialType rejects empty and oversized" → `lib/xrpl/__tests__/credentials.test.ts::rejects empty or oversized input`
    5. "round-trip encode/decode" → `lib/xrpl/__tests__/credentials.test.ts::round-trip encode then decode`
    6. "validateCredentialType accepts valid and rejects invalid" → `lib/__tests__/api.test.ts::validateCredentialType`
- **prompt**: |
    You are adding credential management (XLS-70) support to the XRPL DEX Portal. Your job is to create the shared types, constants, encoding utilities, validation helpers, and a data-fetching hook that other agents depend on.

    ## Project Context

    - Next.js 16 App Router, TypeScript strict, `@/*` path alias → `./*`
    - Tests: Vitest (v4, jsdom, globals enabled). Test files live alongside source as `*.test.ts` or in `__tests__/` dirs.
    - Run tests: `pnpm test` (vitest run)

    ## Your File Scope

    **Create:**
    - `lib/xrpl/credentials.ts`
    - `lib/xrpl/__tests__/credentials.test.ts`
    - `lib/hooks/use-account-credentials.ts`

    **Modify:**
    - `lib/types.ts` — add `CredentialInfo` interface after `DepthSummary`
    - `lib/xrpl/types.ts` — add `AcceptCredentialRequest` and `DeleteCredentialRequest` after `CancelOfferRequest`
    - `lib/xrpl/constants.ts` — add `LSF_ACCEPTED` and `MAX_CREDENTIAL_TYPE_LENGTH` in Validation bounds section
    - `lib/api.ts` — add `validateCredentialType()` function and import `MAX_CREDENTIAL_TYPE_LENGTH`
    - `lib/__tests__/api.test.ts` — add tests for `validateCredentialType`

    **DO NOT modify any other files.** Other agents handle API routes, wallet adapters, and UI.

    ## Exact Types to Add

    In `lib/types.ts` after `DepthSummary`:
    ```typescript
    export interface CredentialInfo {
      issuer: string;
      credentialType: string;
      accepted: boolean;
      expiresAtMs?: number;
      uri?: string;
    }
    ```

    In `lib/xrpl/types.ts` after `CancelOfferRequest`:
    ```typescript
    export interface AcceptCredentialRequest {
      seed: string;
      issuer: string;
      credentialType: string;
      network?: string;
    }

    export interface DeleteCredentialRequest {
      seed: string;
      issuer: string;
      credentialType: string;
      network?: string;
    }
    ```

    In `lib/xrpl/constants.ts` — add in the "Validation bounds" section (after `HEX_CURRENCY_CODE_LENGTH`):
    ```typescript
    /** Ledger flag: credential has been accepted by the subject (lsfAccepted). */
    export const LSF_ACCEPTED = 0x00010000;

    /** Maximum length of a credential type string (before hex encoding). */
    export const MAX_CREDENTIAL_TYPE_LENGTH = 128;
    ```

    ## Credential Encoding — `lib/xrpl/credentials.ts`

    Port from the source project. Uses `Buffer` (server-side only — this file is only imported by API routes). Credential types use raw hex encoding (NOT the 40-char padded currency format).

    ```typescript
    export function encodeCredentialType(type: string): string
    // UTF-8 string → uppercase hex. Throws if empty or > MAX_CREDENTIAL_TYPE_LENGTH bytes.

    export function decodeCredentialType(hex: string): string
    // Hex → UTF-8. Falls back to raw hex if decoded text contains non-printable characters.
    // Use regex /^[\x20-\x7E]+$/ to check printability.
    ```

    Import `MAX_CREDENTIAL_TYPE_LENGTH` from `./constants`.

    ## API Validation — `lib/api.ts`

    Add `validateCredentialType()` following the exact pattern of `validatePositiveAmount()`. Place it after that function in the "Field-specific validation" section.

    ```typescript
    export function validateCredentialType(credentialType: string): Response | null {
      if (!credentialType || credentialType.length === 0) {
        return Response.json(
          { error: "credentialType is required" } satisfies ApiError,
          { status: 400 },
        );
      }
      if (credentialType.length > MAX_CREDENTIAL_TYPE_LENGTH) {
        return Response.json(
          { error: `credentialType exceeds maximum length of ${MAX_CREDENTIAL_TYPE_LENGTH}` } satisfies ApiError,
          { status: 400 },
        );
      }
      return null;
    }
    ```

    Add `import { MAX_CREDENTIAL_TYPE_LENGTH } from "./xrpl/constants";` to the imports.

    ## Hook — `lib/hooks/use-account-credentials.ts`

    Follow the exact pattern of `lib/hooks/use-trust-lines.ts` (read it first). Wraps `useApiFetch<CredentialInfo>`.

    ```typescript
    "use client";
    import { useApiFetch } from "./use-api-fetch";
    import type { PersistedState, CredentialInfo } from "../types";

    export function useAccountCredentials(
      address: string | undefined,
      network: PersistedState["network"],
      refreshKey: number,
    ) {
      const { data, loading, error, refresh, refetch } = useApiFetch<CredentialInfo>(
        () => {
          if (!address) return null;
          const params = new URLSearchParams({ network });
          return `/api/accounts/${encodeURIComponent(address)}/credentials?${params}`;
        },
        (json) => (json.credentials as CredentialInfo[]) ?? [],
        refreshKey,
      );
      return { credentials: data, loading, error, refresh, refetch };
    }
    ```

    ## TDD Workflow (mandatory)

    **Step 1: encodeCredentialType basic encoding**
    - RED: Create `lib/xrpl/__tests__/credentials.test.ts`. Write a test `encodes UTF-8 string to uppercase hex` that imports `encodeCredentialType` and expects `encodeCredentialType("KYC")` to equal `"4B5943"`. Run `pnpm test lib/xrpl/__tests__/credentials.test.ts` — it MUST fail (module doesn't exist).
    - GREEN: Create `lib/xrpl/credentials.ts` with `encodeCredentialType`. Run test — it passes.
    - REFACTOR: Clean up if needed.

    **Step 2: decodeCredentialType basic decoding**
    - RED: Add test `decodes hex back to UTF-8 string` — expects `decodeCredentialType("4B5943")` to equal `"KYC"`. Run — fails (function doesn't exist).
    - GREEN: Add `decodeCredentialType` to `credentials.ts`. Run — passes.

    **Step 3: decodeCredentialType non-printable fallback**
    - RED: Add test `falls back to raw hex for non-printable` — pass a hex string that decodes to non-printable chars (e.g., `"0001FF"`) and expect it returns `"0001FF"`.
    - GREEN: Add printability check (`/^[\x20-\x7E]+$/`) in `decodeCredentialType`. Run — passes.

    **Step 4: encodeCredentialType edge cases**
    - RED: Add test `rejects empty or oversized input` — expects `encodeCredentialType("")` to throw, and `encodeCredentialType("a".repeat(129))` to throw.
    - GREEN: Add length validation. Import `MAX_CREDENTIAL_TYPE_LENGTH` from constants (add the constant first). Run — passes.

    **Step 5: Round-trip**
    - RED: Add test `round-trip encode then decode` — several values roundtrip correctly.
    - GREEN: Should already pass if both functions are correct.

    **Step 6: validateCredentialType**
    - RED: In `lib/__tests__/api.test.ts`, add a `describe("validateCredentialType")` block. Import it. Test: valid type returns null, empty string returns 400 Response, too-long string returns 400. Run — fails.
    - GREEN: Add `validateCredentialType` to `lib/api.ts`. Run — passes.

    After all steps, also add the types to `lib/types.ts` and `lib/xrpl/types.ts`, the constants to `lib/xrpl/constants.ts`, and create the hook file. These are declarations that don't need RED/GREEN cycles.

    Run the full test suite at the end: `pnpm test`

    ## Completion Report

    When done, end your output with a brief report:
    - Files created/modified
    - TDD steps completed (N/N)
    - Checkpoint: last completed step
    - Discoveries: any gotchas, surprises, or learnings

### B: api-routes

- **depends_on**: [A]
- **creates**: [`app/api/accounts/[address]/credentials/route.ts`, `app/api/credentials/accept/route.ts`, `app/api/credentials/delete/route.ts`]
- **modifies**: []
- **description**: Create the three API routes for fetching, accepting, and deleting credentials. All new files — no file conflicts.
- **tdd_steps**:
    1. "Verify GET route compiles and exports GET function" → build check
    2. "Verify accept route compiles and exports POST function" → build check
    3. "Verify delete route compiles and exports POST function" → build check
- **prompt**: |
    You are adding credential management API routes to the XRPL DEX Portal. Create three new API routes for fetching, accepting, and deleting credentials.

    ## Project Context

    - Next.js 16 App Router (route params are `Promise`-based — must `await` them)
    - xrpl npm package v4.5.0 — exports `CredentialAccept`, `CredentialDelete` types
    - Run build: `pnpm build` (this is the type-check)

    ## Your File Scope

    **Create:**
    - `app/api/accounts/[address]/credentials/route.ts` — GET handler
    - `app/api/credentials/accept/route.ts` — POST handler
    - `app/api/credentials/delete/route.ts` — POST handler

    **DO NOT modify any existing files.** Types, constants, encoding, and validation are handled by another agent in these files (they will exist when you run):
    - `lib/types.ts` — exports `CredentialInfo`
    - `lib/xrpl/types.ts` — exports `AcceptCredentialRequest`, `DeleteCredentialRequest`
    - `lib/xrpl/constants.ts` — exports `LSF_ACCEPTED`, `fromRippleEpoch`
    - `lib/xrpl/credentials.ts` — exports `encodeCredentialType`, `decodeCredentialType`
    - `lib/api.ts` — exports `validateCredentialType` (plus existing helpers)

    ## Reference Files to Read First

    Read these existing routes to match their patterns exactly:
    - `app/api/accounts/[address]/trustlines/route.ts` — pattern for GET route
    - `app/api/transfers/route.ts` — pattern for POST mutation routes
    - `app/api/dex/offers/cancel/route.ts` — another POST mutation pattern

    Also read:
    - `lib/api.ts` — for helpers: `getAndValidateAddress`, `getXrplClient`, `getNetworkParam`, `validateRequired`, `requireWallet`, `validateAddress`, `validateCredentialType`, `submitTxAndRespond`, `apiErrorResponse`, `isAccountNotFound`

    ## GET `/api/accounts/[address]/credentials`

    Follow the trustlines GET route pattern exactly.

    ```typescript
    import { NextRequest } from "next/server";
    import { getAndValidateAddress, getXrplClient, apiErrorResponse, isAccountNotFound } from "@/lib/api";
    import { LSF_ACCEPTED, fromRippleEpoch } from "@/lib/xrpl/constants";
    import { decodeCredentialType } from "@/lib/xrpl/credentials";
    import type { CredentialInfo } from "@/lib/types";
    ```

    Key implementation details:
    - Use `account_objects` with `type: "credential"` and `ledger_index: "validated"`
    - Cast `account_objects` result to inline type: `Array<{ LedgerEntryType: string; Issuer: string; Subject: string; CredentialType: string; Flags: number; Expiration?: number; URI?: string }>`
    - Filter to only entries where `Subject === address` (we only want credentials issued TO this wallet)
    - For each credential object:
      - Check accepted: `(obj.Flags & LSF_ACCEPTED) !== 0`
      - Decode type: `decodeCredentialType(obj.CredentialType)`
      - Convert expiration: `fromRippleEpoch(obj.Expiration).getTime()` → `expiresAtMs` (only if Expiration exists)
      - Decode URI: `Buffer.from(obj.URI, "hex").toString("utf-8")` in try/catch (only if URI exists)
    - Return `{ address, credentials: CredentialInfo[] }`
    - For unfunded accounts (`isAccountNotFound`), return `{ address, credentials: [] }` (matching trustlines pattern)

    ## POST `/api/credentials/accept`

    ```typescript
    import { NextRequest } from "next/server";
    import type { CredentialAccept } from "xrpl";
    import { getClient } from "@/lib/xrpl/client";
    import { resolveNetwork } from "@/lib/xrpl/networks";
    import { encodeCredentialType } from "@/lib/xrpl/credentials";
    import { validateRequired, validateAddress, validateCredentialType, requireWallet, submitTxAndRespond, apiErrorResponse } from "@/lib/api";
    import type { AcceptCredentialRequest } from "@/lib/xrpl/types";
    ```

    - Parse body as `AcceptCredentialRequest`
    - `validateRequired` for `["seed", "issuer", "credentialType"]`
    - `validateAddress(body.issuer, "issuer")`
    - `validateCredentialType(body.credentialType)`
    - `requireWallet(body.seed)` (no expected address — subject can be any wallet)
    - Build `CredentialAccept` tx: `{ TransactionType: "CredentialAccept", Account: wallet.address, Issuer: body.issuer, CredentialType: encodeCredentialType(body.credentialType) }`
    - `submitTxAndRespond(client, tx, wallet)`

    ## POST `/api/credentials/delete`

    Same pattern as accept but with `CredentialDelete`:

    ```typescript
    import type { CredentialDelete } from "xrpl";
    ```

    - Build `CredentialDelete` tx: `{ TransactionType: "CredentialDelete", Account: wallet.address, Issuer: body.issuer, CredentialType: encodeCredentialType(body.credentialType) }`
    - When the subject deletes, `Account` = subject's address and `Issuer` field identifies the credential issuer

    ## Verification

    Since API routes can't be meaningfully unit-tested without heavy XRPL client mocking (and the project has no API route unit tests), verify via:
    1. `pnpm build` — confirms all routes compile with correct types
    2. Check that each route file exports the expected HTTP method function (`GET` or `POST`)

    ## Completion Report

    When done, end your output with a brief report:
    - Files created
    - Build result (pass/fail)
    - Discoveries: any gotchas or type issues

### C: wallet-adapter

- **depends_on**: []
- **creates**: []
- **modifies**: [`lib/wallet-adapter/types.ts`, `lib/wallet-adapter/build-transactions.ts`, `lib/wallet-adapter/seed-adapter.ts`, `lib/wallet-adapter/crossmark-adapter.ts`, `lib/wallet-adapter/gemwallet-adapter.ts`, `lib/wallet-adapter/xaman-adapter.ts`, `lib/wallet-adapter/metamask-snap-adapter.ts`, `lib/wallet-adapter/index.ts`, `lib/hooks/use-wallet-adapter.tsx`, `lib/wallet-adapter/__tests__/build-transactions.test.ts`, `lib/wallet-adapter/__tests__/seed-adapter.test.ts`, `lib/wallet-adapter/__tests__/types.test.ts`]
- **description**: Add credential accept/delete support to the entire wallet adapter layer — types, transaction builders, all 5 adapter implementations, barrel exports, and the React context provider.
- **tdd_steps**:
    1. "buildCredentialAcceptTx builds correct tx shape" → `lib/wallet-adapter/__tests__/build-transactions.test.ts::buildCredentialAcceptTx`
    2. "buildCredentialDeleteTx builds correct tx shape" → `lib/wallet-adapter/__tests__/build-transactions.test.ts::buildCredentialDeleteTx`
    3. "encodeCredentialTypeClient matches server encoding" → `lib/wallet-adapter/__tests__/build-transactions.test.ts::encodeCredentialTypeClient`
    4. "SeedWalletAdapter.acceptCredential calls correct API" → `lib/wallet-adapter/__tests__/seed-adapter.test.ts::acceptCredential`
    5. "SeedWalletAdapter.deleteCredential calls correct API" → `lib/wallet-adapter/__tests__/seed-adapter.test.ts::deleteCredential`
- **prompt**: |
    You are adding credential accept/delete support to the wallet adapter layer of the XRPL DEX Portal. This agent has NO dependencies on other agents — the wallet adapter types are self-contained.

    ## Project Context

    - TypeScript strict, `@/*` path alias → `./*`
    - xrpl npm package v4.5.0 — exports `CredentialAccept`, `CredentialDelete` types
    - Tests: Vitest (v4, jsdom, globals enabled). Run: `pnpm test`
    - The wallet adapter supports both seed wallets (API routes) and browser extension wallets (client-side signing)

    ## Your File Scope

    **Modify:**
    - `lib/wallet-adapter/types.ts` — add param interfaces + WalletAdapter methods
    - `lib/wallet-adapter/build-transactions.ts` — add credential tx builders
    - `lib/wallet-adapter/seed-adapter.ts` — add methods
    - `lib/wallet-adapter/crossmark-adapter.ts` — add methods
    - `lib/wallet-adapter/gemwallet-adapter.ts` — add methods (uses `submitTransaction`)
    - `lib/wallet-adapter/xaman-adapter.ts` — add methods
    - `lib/wallet-adapter/metamask-snap-adapter.ts` — add methods
    - `lib/wallet-adapter/index.ts` — re-export new types
    - `lib/hooks/use-wallet-adapter.tsx` — expose new methods via context
    - `lib/wallet-adapter/__tests__/build-transactions.test.ts` — add credential builder tests
    - `lib/wallet-adapter/__tests__/seed-adapter.test.ts` — add credential method tests
    - `lib/wallet-adapter/__tests__/types.test.ts` — add credential param type tests

    **DO NOT modify any files outside this scope.** Other agents handle types.ts, constants.ts, API routes, and UI.

    ## Read These Files First

    Read ALL of these to understand the exact patterns:
    - `lib/wallet-adapter/types.ts` — current interface and param types
    - `lib/wallet-adapter/build-transactions.ts` — current tx builders (match the pattern)
    - `lib/wallet-adapter/seed-adapter.ts` — current seed adapter (match postAndParse pattern)
    - `lib/wallet-adapter/crossmark-adapter.ts` — uses `buildXxxTx` + `this.signAndSubmit(tx)`
    - `lib/wallet-adapter/gemwallet-adapter.ts` — uses purpose-built API methods; for credential txs use `api.submitTransaction({ transaction: tx })` + `this.parseHashResponse(resp)` (confirmed: `@gemwallet/api` exports `submitTransaction` accepting `{ transaction: SubmittableTransaction }`)
    - `lib/wallet-adapter/xaman-adapter.ts` — uses `buildXxxTx` + `this.signViaPayload(tx)`
    - `lib/wallet-adapter/metamask-snap-adapter.ts` — uses `buildXxxTx` + `this.signAndSubmit(tx)`
    - `lib/wallet-adapter/index.ts` — barrel re-exports
    - `lib/hooks/use-wallet-adapter.tsx` — context provider pattern
    - `lib/wallet-adapter/__tests__/build-transactions.test.ts` — test pattern for builders
    - `lib/wallet-adapter/__tests__/seed-adapter.test.ts` — test pattern for seed adapter

    ## Types to Add — `lib/wallet-adapter/types.ts`

    After `TrustlineParams`:
    ```typescript
    export interface AcceptCredentialParams {
      issuer: string;
      credentialType: string;
      network: string;
    }

    export interface DeleteCredentialParams {
      issuer: string;
      credentialType: string;
      network: string;
    }
    ```

    Add to `WalletAdapter` interface (after `setTrustline`):
    ```typescript
    acceptCredential(params: AcceptCredentialParams): Promise<TxResult>;
    deleteCredential(params: DeleteCredentialParams): Promise<TxResult>;
    ```

    ## Transaction Builders — `lib/wallet-adapter/build-transactions.ts`

    **IMPORTANT**: This file runs client-side (in extension adapter code paths). `Buffer` is NOT available in the browser. Add a private client-safe encoding helper:

    ```typescript
    /**
     * Client-safe credential type encoding (TextEncoder instead of Buffer).
     * MUST stay in sync with server-side encodeCredentialType in lib/xrpl/credentials.ts.
     */
    function encodeCredentialTypeClient(type: string): string {
      const bytes = new TextEncoder().encode(type);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    }
    ```

    **Cross-implementation sync**: Both Agent A (server) and Agent C (client) encode credential types independently. To catch drift, both test suites MUST assert the same known fixtures: `"KYC"` → `"4B5943"`, `"AML Check"` → `"414D4C20436865636B"`. Agent C tests this indirectly through the builder output's `CredentialType` field.

    Then add the builders:
    ```typescript
    import type { CredentialAccept, CredentialDelete } from "xrpl";
    import type { AcceptCredentialParams, DeleteCredentialParams } from "./types";

    export function buildCredentialAcceptTx(params: AcceptCredentialParams, account: string): CredentialAccept {
      return {
        TransactionType: "CredentialAccept",
        Account: account,
        Issuer: params.issuer,
        CredentialType: encodeCredentialTypeClient(params.credentialType),
      };
    }

    export function buildCredentialDeleteTx(params: DeleteCredentialParams, account: string): CredentialDelete {
      return {
        TransactionType: "CredentialDelete",
        Account: account,
        Issuer: params.issuer,
        CredentialType: encodeCredentialTypeClient(params.credentialType),
      };
    }
    ```

    ## Seed Adapter — `lib/wallet-adapter/seed-adapter.ts`

    Follow `setTrustline` / `cancelOffer` pattern:
    ```typescript
    async acceptCredential(params: AcceptCredentialParams): Promise<TxResult> {
      return this.postAndParse("/api/credentials/accept", {
        seed: this.getSeed(),
        issuer: params.issuer,
        credentialType: params.credentialType,
        network: params.network,
      });
    }

    async deleteCredential(params: DeleteCredentialParams): Promise<TxResult> {
      return this.postAndParse("/api/credentials/delete", {
        seed: this.getSeed(),
        issuer: params.issuer,
        credentialType: params.credentialType,
        network: params.network,
      });
    }
    ```

    Import `AcceptCredentialParams`, `DeleteCredentialParams` from `"./types"`.

    ## Extension Adapters

    **Crossmark** (`crossmark-adapter.ts`):
    ```typescript
    async acceptCredential(params: AcceptCredentialParams): Promise<TxResult> {
      this.requireConnected();
      const tx = buildCredentialAcceptTx(params, this.address!);
      return this.signAndSubmit(tx);
    }
    async deleteCredential(params: DeleteCredentialParams): Promise<TxResult> {
      this.requireConnected();
      const tx = buildCredentialDeleteTx(params, this.address!);
      return this.signAndSubmit(tx);
    }
    ```
    Import builders from `"./build-transactions"` and param types from `"./types"`.

    **GemWallet** (`gemwallet-adapter.ts`):
    Uses `api.submitTransaction` (generic) since GemWallet has no purpose-built credential methods:
    ```typescript
    async acceptCredential(params: AcceptCredentialParams): Promise<TxResult> {
      this.requireConnected();
      const api = await getApi();
      const tx = buildCredentialAcceptTx(params, this.address!);
      const resp = await api.submitTransaction({ transaction: tx as Parameters<GemWalletApi["submitTransaction"]>[0]["transaction"] });
      return this.parseHashResponse(resp);
    }
    async deleteCredential(params: DeleteCredentialParams): Promise<TxResult> {
      this.requireConnected();
      const api = await getApi();
      const tx = buildCredentialDeleteTx(params, this.address!);
      const resp = await api.submitTransaction({ transaction: tx as Parameters<GemWalletApi["submitTransaction"]>[0]["transaction"] });
      return this.parseHashResponse(resp);
    }
    ```
    Import builders from `"./build-transactions"` and param types from `"./types"`.

    **Xaman** (`xaman-adapter.ts`):
    ```typescript
    async acceptCredential(params: AcceptCredentialParams): Promise<TxResult> {
      this.requireConnected();
      const tx = buildCredentialAcceptTx(params, this.address!);
      return this.signViaPayload(tx);
    }
    async deleteCredential(params: DeleteCredentialParams): Promise<TxResult> {
      this.requireConnected();
      const tx = buildCredentialDeleteTx(params, this.address!);
      return this.signViaPayload(tx);
    }
    ```
    Import builders from `"./build-transactions"` and param types from `"./types"`.

    **MetaMask Snap** (`metamask-snap-adapter.ts`):
    ```typescript
    async acceptCredential(params: AcceptCredentialParams): Promise<TxResult> {
      this.requireConnected();
      const tx = buildCredentialAcceptTx(params, this.address!);
      return this.signAndSubmit(tx);
    }
    async deleteCredential(params: DeleteCredentialParams): Promise<TxResult> {
      this.requireConnected();
      const tx = buildCredentialDeleteTx(params, this.address!);
      return this.signAndSubmit(tx);
    }
    ```
    Import builders from `"./build-transactions"` and param types from `"./types"`.

    ## Barrel Export — `lib/wallet-adapter/index.ts`

    Add `AcceptCredentialParams`, `DeleteCredentialParams` to the re-export line.

    ## Provider — `lib/hooks/use-wallet-adapter.tsx`

    Follow the exact pattern of `sendPayment`, `createOffer`, etc.:

    1. Import `AcceptCredentialParams`, `DeleteCredentialParams` from `"../wallet-adapter/types"`
    2. Add to `WalletAdapterContextValue` interface:
       ```typescript
       acceptCredential(params: AcceptCredentialParams): Promise<TxResult>;
       deleteCredential(params: DeleteCredentialParams): Promise<TxResult>;
       ```
    3. Add `useCallback` wrappers:
       ```typescript
       const acceptCredential = useCallback(
         (params: AcceptCredentialParams) => requireAdapter().acceptCredential(params),
         [requireAdapter],
       );
       const deleteCredential = useCallback(
         (params: DeleteCredentialParams) => requireAdapter().deleteCredential(params),
         [requireAdapter],
       );
       ```
    4. Add both to the `value` useMemo object AND its dependency array.

    ## TDD Workflow (mandatory)

    **Step 1: buildCredentialAcceptTx**
    - RED: In `lib/wallet-adapter/__tests__/build-transactions.test.ts`, add a `describe("buildCredentialAcceptTx")` block. Test that it returns `{ TransactionType: "CredentialAccept", Account, Issuer, CredentialType }` with credential type hex-encoded. Run `pnpm test lib/wallet-adapter/__tests__/build-transactions.test.ts` — fails (function doesn't exist).
    - GREEN: Add `buildCredentialAcceptTx` and the `encodeCredentialTypeClient` helper to `build-transactions.ts`. Run — passes.

    **Step 2: buildCredentialDeleteTx**
    - RED: Add `describe("buildCredentialDeleteTx")` test. Run — fails.
    - GREEN: Add `buildCredentialDeleteTx`. Run — passes.

    **Step 3: encodeCredentialTypeClient**
    - RED: Add a test that `encodeCredentialTypeClient` via `buildCredentialAcceptTx` correctly hex-encodes "KYC" to "4B5943". (Test indirectly through the builder since the helper is private.)
    - GREEN: Should already pass from step 1.

    **Step 4: SeedWalletAdapter.acceptCredential**
    - RED: In `lib/wallet-adapter/__tests__/seed-adapter.test.ts`, add a test `acceptCredential calls /api/credentials/accept with correct payload` (follow the existing `sendPayment` test pattern with `vi.stubGlobal("fetch", mockFetch)`). Run — fails.
    - GREEN: Add `acceptCredential` method to `seed-adapter.ts`. Add types to `types.ts` first. Run — passes.

    **Step 5: SeedWalletAdapter.deleteCredential**
    - RED: Add test `deleteCredential calls /api/credentials/delete with correct payload`. Run — fails.
    - GREEN: Add `deleteCredential` method. Run — passes.

    After TDD steps, add the methods to all extension adapters, update the barrel export, and update the provider. These follow mechanical patterns that don't need individual RED/GREEN cycles.

    Run the full test suite: `pnpm test`

    ## Completion Report

    When done, end your output with a brief report:
    - Files modified
    - TDD steps completed (N/N)
    - Checkpoint: last completed step
    - Discoveries: any gotchas (especially around GemWallet `submitTransaction` typing)

### D: ui-and-page

- **depends_on**: [A, C]
- **creates**: [`app/setup/components/credential-management.tsx`, `app/setup/components/error-boundary.tsx` (if no project-wide ErrorBoundary exists)]
- **modifies**: [`app/setup/page.tsx`]
- **description**: Create the CredentialManagement UI component and wire it into the setup page with an error boundary. Depends on Agent A (types + hook) and Agent C (wallet adapter methods).
- **tdd_steps**:
    1. "Build compiles with new component wired in" → `pnpm build`
- **prompt**: |
    You are creating the Credentials UI section for the `/setup` page of the XRPL DEX Portal.

    ## Project Context

    - Next.js 16 App Router, React 19, Tailwind CSS 4, TypeScript strict
    - `@/*` path alias → `./*`
    - Run build: `pnpm build` (also serves as type-check)

    ## Your File Scope

    **Create:**
    - `app/setup/components/credential-management.tsx`
    - `app/setup/components/error-boundary.tsx` (if no project-wide ErrorBoundary exists in `app/components/`)

    **Modify:**
    - `app/setup/page.tsx` — add CredentialManagement component wrapped in ErrorBoundary

    **DO NOT modify any other files.**

    ## Read These Files First

    Essential — read ALL of these:
    - `app/setup/page.tsx` — current page structure (you'll add to it)
    - `app/setup/components/trust-line-management.tsx` — **primary pattern to follow** (card, loading, error, action handlers, wallet adapter usage)
    - `app/components/explorer-link.tsx` — reusable address display component
    - `lib/ui/ui.ts` — shared Tailwind class constants (`cardClass`, `errorTextClass`, `primaryButtonClass`, `dangerButtonClass`, `secondaryButtonClass`)
    - `lib/wallet-ui.ts` — `getSigningLoadingText()`, `extractErrorMessage()`
    - `lib/hooks/use-wallet-adapter.tsx` — `useWalletAdapter()` hook (exposes `adapter`, `acceptCredential`, `deleteCredential`)
    - `lib/hooks/use-account-credentials.ts` — `useAccountCredentials(address, network, refreshKey)` returns `{ credentials, loading, error }`
    - `lib/types.ts` — `CredentialInfo`, `WalletInfo`, `PersistedState`

    ## Dependencies (created by other agents, will exist when you run)

    ```typescript
    // From lib/types.ts
    interface CredentialInfo {
      issuer: string;
      credentialType: string;
      accepted: boolean;
      expiresAtMs?: number;
      uri?: string;
    }

    // From lib/hooks/use-account-credentials.ts
    function useAccountCredentials(address, network, refreshKey)
      → { credentials: CredentialInfo[], loading, error, refresh }

    // From lib/hooks/use-wallet-adapter.tsx
    useWalletAdapter() exposes:
      adapter: WalletAdapter | null
      acceptCredential(params: { issuer, credentialType, network }): Promise<TxResult>
      deleteCredential(params: { issuer, credentialType, network }): Promise<TxResult>
    ```

    ## Component Design — `credential-management.tsx`

    Props:
    ```typescript
    interface CredentialManagementProps {
      wallet: WalletInfo;
      network: PersistedState["network"];
      refreshKey: number;
      onRefresh: () => void;
    }
    ```

    Follow the `TrustLineManagement` pattern closely:

    **Layout:**
    - Wrapped in `cardClass`
    - Header row: "Credentials" title + subtitle "Credentials issued to your wallet by third parties" + Refresh button (right-aligned)
    - Error display if fetch fails
    - Empty state message when no credentials
    - List of credential cards

    **Empty state:**
    ```
    No credentials found. Credentials are on-ledger attestations issued to your wallet
    by third parties (e.g., identity verifiers, compliance providers). When someone
    issues a credential to you, it will appear here for you to accept or reject.
    ```

    **Credential card (each credential):**
    - Bordered div with padding
    - Credential type as bold heading
    - Issuer address via `<ExplorerLink address={cred.issuer} />`
    - Status badges:
      - Green "Accepted" badge if `cred.accepted`
      - Amber "Pending" badge if not accepted
      - Red "Expired" badge if `cred.expiresAtMs && cred.expiresAtMs < Date.now()`
    - Expiration date: `new Date(cred.expiresAtMs).toLocaleString()` with "Expires:" or "Expired:" prefix
    - URI: if `cred.uri` exists, render as clickable link ONLY if `isSafeHttpUrl(cred.uri)` returns true (check protocol is `http:` or `https:` via `new URL(uri).protocol`). Otherwise render as plain text. In both cases, truncate long URIs for display using `max-w-xs truncate` (the full URI is preserved in the `href` / `title` attribute).
    - Action buttons (right-aligned):
      - **Accept** button (blue, `primaryButtonClass` style but smaller `px-3 py-1.5 text-xs`): shown only if NOT accepted AND NOT expired. Loading text via `getSigningLoadingText(adapter, "Accepting...")`
      - **Delete** button (red outline, danger style but smaller): always shown. Loading text via `getSigningLoadingText(adapter, "Deleting...")`
    - Expired credentials: entire card dimmed with `opacity-60`

    **Sorting:** Flat list, pending first then accepted. Within each group, alphabetical by credentialType.

    **Action handlers:** Follow trust-line-management pattern:
    ```typescript
    const [acting, setActing] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    async function handleAccept(cred: CredentialInfo) {
      const key = `${cred.issuer}:${cred.credentialType}`;
      setActing(key);
      setActionError(null);
      try {
        const result = await acceptCredential({
          issuer: cred.issuer,
          credentialType: cred.credentialType,
          network,
        });
        if (!result.success) {
          setActionError(result.resultCode ?? "Failed to accept credential");
        } else {
          onRefresh();
        }
      } catch (err) {
        setActionError(extractErrorMessage(err));
      } finally {
        setActing(null);
      }
    }
    // handleDelete follows same pattern with deleteCredential
    ```

    **URI safety helper (private to this file):**
    ```typescript
    function isSafeHttpUrl(uri: string): boolean {
      try {
        const url = new URL(uri);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }
    ```

    ## Wiring Into Setup Page — `app/setup/page.tsx`

    1. Add import: `import { CredentialManagement } from "./components/credential-management";`
    2. Render AFTER `TrustLineManagement`, inside the same `{state.wallet && (...)}` conditional. Wrap in an error boundary so a bad credential object doesn't crash the entire setup page:
       ```tsx
       {state.wallet && (
         <ErrorBoundary fallback={<div className={cardClass}><p className={errorTextClass}>Failed to load credentials section.</p></div>}>
           <CredentialManagement
             wallet={state.wallet}
             network={state.network}
             refreshKey={refreshKey}
             onRefresh={() => setRefreshKey((k) => k + 1)}
           />
         </ErrorBoundary>
       )}
       ```
    3. Check if the project already has an `ErrorBoundary` component in `app/components/`. If not, create a minimal one in `app/setup/components/error-boundary.tsx` (class component with `componentDidCatch` that renders the `fallback` prop). Import `cardClass` and `errorTextClass` from `@/lib/ui/ui`.

    ## Verification

    Run `pnpm build` to confirm everything compiles.

    ## Completion Report

    When done, end your output with a brief report:
    - Files created/modified
    - Build result (pass/fail)
    - Discoveries: any gotchas

## DAG Visualization

```
A ──→ B
A ──┐
    ├──→ D
C ──┘
```

- **A** and **C** run in parallel (no dependencies between them)
- **B** starts after A completes (needs types/encoders/validators)
- **D** starts after both A and C complete (needs types + hook from A, adapter methods from C)
- **B** is off the critical path (leaf node, doesn't block D)

## Pre-Execution Verification

```bash
pnpm test --help
pnpm build --help 2>&1 | head -5
pnpm lint --help 2>&1 | head -5
```

## Integration Tests

After all agents complete:
1. `pnpm build` — full project type-check (catches cross-agent type mismatches)
2. `pnpm test` — full test suite (catches regressions)
3. `pnpm lint` — no ESLint errors

## Verification

After all agents complete and integration tests pass:
1. Start dev server: `pnpm dev`
2. Navigate to `/setup` with a testnet wallet
3. Verify the Credentials section appears after Trust Lines
4. Test with testnet address `rwZZv2GG7x8CEFR2etV4ZaB6fMPQ3fEoAy` — should display 2 accepted KYC credentials from issuer `rfVv72NsV4xSP2WRYJSe5Ub5YgpK46W7UL`
5. Verify Accept button is hidden for already-accepted credentials
6. Verify Delete button is shown for all credentials
7. Verify issuer addresses link to explorer

## Execution State

_This section is managed by `/execute-parallel-plan`. Do not edit manually._

| Agent | Status | Agent ID | Duration | Notes |
|-------|--------|----------|----------|-------|
| A | completed | a9a395b | 242s | 6/6 TDD. Discovery: buf.length for multi-byte UTF-8 validation |
| B | completed | a3d6bc2 | 77s | Build pass. account_objects needs inline type cast for credential fields |
| C | completed | a021a85 | 235s | 5/5 TDD. GemWallet cast via Parameters<> confirmed working |
| D | completed | a421fe0 | 117s | Build pass. ErrorBoundary created. URI truncation + safety check in place |

Started: 2026-02-18 11:58:36
Last updated: 2026-02-18 12:09:30
Build: pass
Integration: pass (437 tests, 0 lint errors)
