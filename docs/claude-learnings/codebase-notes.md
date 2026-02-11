# Codebase Notes

## Rate Limiter is Dead Code

`lib/rate-limit.ts` defines a token-bucket `rateLimit()` function, but as of Feb 2026 it is **not imported or called** by any API route or middleware. It is dead code.

The function exists and is syntactically valid, but no route in `app/api/` references it. If rate limiting is needed in the future, the implementation is ready to use — it just needs to be wired into the relevant route handlers or a Next.js middleware.
