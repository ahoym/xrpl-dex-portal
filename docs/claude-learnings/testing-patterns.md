# Testing Pattern Learnings

## Testing Response-returning validators

When testing Next.js API validator functions that return `Response | null`:

```typescript
// Assert success (null = valid)
expect(validateAddress("rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh", "addr")).toBeNull();

// Assert failure (Response with status and JSON body)
const resp = validateAddress("invalid", "addr");
expect(resp).not.toBeNull();
expect(resp!.status).toBe(400);
const body = await resp!.json();
expect(body.error).toContain("Invalid");
```

The `!` non-null assertion is safe after the `not.toBeNull()` check. The `await resp!.json()` is needed because `Response.json()` returns a Promise.
