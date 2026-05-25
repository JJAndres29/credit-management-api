# Testing Strategy

The codebase maintains **2,056 automated tests** in **32 Jest suites**, colocated with source in `src/**/*.test.ts`.

## Philosophy

| Principle | Application |
|-----------|-------------|
| **Test behavior, not implementation** | Use cases tested via mocked ports — assert outcomes and error types |
| **Financial rules are sacred** | Payment/sale tests cover balance math, audit log payloads, sale status transitions |
| **Side effects are optional** | Use cases accept optional `EventEmitterPort`; tests verify no throw when omitted |
| **Structure is enforced** | Static analysis tests scan imports for forbidden cross-context coupling |
| **Subscribers are resilient** | Notification tests simulate partial failures (WhatsApp down, PDF fail) |

## Coverage by area

### Auth & users
- Login: invalid credentials, inactive user, token payload, password never exposed
- Renew: stale user, inactive user, successful rotation

### Sales (CreateSaleUseCase)
- Client/product not found, inactive product, insufficient stock/credit
- CASH vs CREDIT paths, audit log presence, domain event emission
- Installment fields (collectionDay, BIWEEKLY day pairs)
- Manual unit pricing (`appliedRule: null`)

### Payments (CreatePaymentUseCase)
- Balance overflow, sale ownership, sale already PAID, partial vs full payment
- Audit log `before`/`after` math, `PAYMENT_REGISTERED` event data

### Customer auth
- Register/login anti-enumeration (same 401 message)
- Claim client: 404, 409 already linked, ACL returns `ClientSummary` only
- JWT isolation: staff token rejected by customer adapter and vice versa
- Structural `no-coupling.test.ts` on customer-auth folder

### Online orders
- Checkout clears cart, expiry restores stock, risk evaluation scoring
- Mercado Pago webhook HMAC verification (adapter tests)

### Notifications
- 25 subscriber tests: throttle (4th blocked), parallel send, failure isolation
- PDF attachment optional when generation fails

### Reports
- Parallel repository calls, product name deduplication, 404 short-circuit

### Catalog & variants
- Attribute assignment, variant hash uniqueness, asset reuse without duplicate Cloudinary uploads

## Running tests

```bash
npm test              # Full suite
npm run test:watch    # Watch mode
```

CI: PostgreSQL 16 service container, `prisma migrate deploy`, then `npm test` on every push/PR (`.github/workflows/ci.yml`).
