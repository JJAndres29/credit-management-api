# Engineering Highlights

Decisions that demonstrate production maturity — not exhaustive, but representative of how the private codebase is structured.

## 1. Zero coupling in use cases

Use cases receive **interfaces only** (`PaymentRepository`, `EventEmitterPort`, `PdfService`). No Prisma, no Express, no Nodemailer imports in domain layer.

A structural test (`no-http-in-domain.test.ts`) fails CI if any domain file imports HTTP libraries.

## 2. Customer ↔ Staff isolation

The Customer bounded context **cannot** import `ClientRepository` or `ClientEntity`. Cross-context data flows through `ClientLookupPort` — verified by a structural guard test.

JWT isolation uses separate secrets **and** JWT `audience: 'customer'` so tokens are mutually rejected across contexts.

## 3. Atomic financial integrity

Every payment, sale, or deletion that touches `Client.balance` runs inside `prisma.$transaction()`:

- Update balance
- Update sale status (if applicable)
- Write AuditLog with `before`, `after`, `userId`, `ip`

Failure at any step → full rollback. No partial ledger states.

## 4. Idempotency on money writes

Network retries and double-clicks are handled with `Idempotency-Key` + body hash stored in `IdempotencyRecord`. Same key + same body = cached response; same key + different body = 409.

## 5. Webhook trust model (Mercado Pago)

```
Webhook received
  → Verify HMAC on raw bytes (timingSafeEqual)
  → Check ProcessedWebhook (no double processing)
  → GET payment from MP API (never trust webhook body amount)
  → Atomic order status update
```

## 6. Notification resilience

- Events fire **after** DB commit
- Subscribers use `Promise.allSettled` — WhatsApp failure doesn't block email
- Throttle: max 3 notifications/client/hour (in-memory, per replica)
- Missing env vars → feature disabled with `console.warn`, server still starts
- BullMQ with graceful fallback to synchronous execution

## 7. Order expiry & stock reservation

Background job every 5 minutes:

- MP orders: 30 min unpaid → CANCELLED, stock restored
- WhatsApp manual: 24 h → same

Prevents inventory hoarding without manual intervention.

## 8. Tax-inclusive pricing (Colombia / DIAN)

Checkout computes net + IVA from gross variant prices using category or product `ivaRate`. Schema includes electronic invoice tables for future DIAN integration.

## 9. Feature flags without redeploy

Same binary serves multiple clients/branches:

- Toggle credit module off → staff credit routes return 404
- Toggle checkout off → 503 on cart/checkout
- Flags cached 60s per replica from PostgreSQL

## 10. Graceful shutdown

`SIGTERM` / `SIGINT` handlers:

1. Stop accepting new HTTP connections
2. Clear cron intervals
3. Disconnect Prisma pool
4. 25s hard timeout before forced exit

Required for zero-downtime deploys on Render/Kubernetes.

## 11. Observability

Pino structured logging with:

- JSON in production, pretty in development
- Request correlation via `pino-http`
- Sensitive field redaction

Health check at `GET /health` — Prisma `SELECT 1`, used by Docker HEALTHCHECK and load balancers.

## 12. Test pyramid

**2,056 tests** across:

- Use case unit tests (mocked repositories)
- DTO validation edge cases
- Subscriber resilience (WhatsApp fail → email still sent)
- JWT cross-context rejection
- Structural coupling guards
- Mercado Pago HMAC adapter tests
- Installment calculator pure domain tests

Tests live alongside code in `src/**/*.test.ts` — see [testing.md](testing.md).
