# Module Map

High-level overview of system capabilities. Endpoint paths are summarized by area — the full private API has 80+ routes with pagination, filters, and RBAC on each module.

## Staff operations

| Module | Key capabilities |
|--------|------------------|
| **Auth** | Login, token renew, rate-limited |
| **Users** | CRUD, role assignment (ADMIN / SELLER), password management |
| **Clients** | Credit limits, balances, soft-delete, notify (statement reminder) |
| **Sales** | Cash & credit sales, installment plans (MONTHLY / BIWEEKLY / WEEKLY), inline product creation, idempotent create |
| **Payments** | Register, update (ADMIN), delete (ADMIN) — all with audit trail |
| **Collections** | Upcoming / overdue installment dashboard |
| **Audit logs** | Read-only immutable financial action history |
| **Reports** | PDF account statement generation (in-memory stream) |
| **Dashboard** | KPIs and monthly collection summary |

## E-commerce

| Module | Key capabilities |
|--------|------------------|
| **Customer auth** | Register, login, Google OAuth, forgot/change password, claim staff client link |
| **Addresses** | CRUD, default address |
| **Catalog** | Products, categories, dynamic attributes, SEO slugs, 301 redirect history |
| **Variants** | SKU-level stock, pricing, attribute hash, media assets |
| **Cart** | Guest session (`X-Cart-Session`) or customer JWT; merge on login |
| **Checkout** | Tax-inclusive totals, coupons, shipping zones, risk evaluation |
| **Orders** | Mercado Pago or WhatsApp manual flow; expiry jobs; webhook processing |
| **SEO** | `/sitemap.xml`, `/robots.txt` with public cache headers |

## Admin & platform

| Module | Key capabilities |
|--------|------------------|
| **Feature flags** | Runtime toggle checkout, MP, email, credit module, etc. |
| **Coupons** | PERCENT / FIXED discounts with scope rules |
| **Analytics** | Materialized views: daily sales, profitability, dead stock, cohorts, LTV, ticket average |
| **Marketing** | Discount campaigns, A/B price experiments, rotation alerts |
| **Dead letters** | Inspect failed background notification jobs |
| **Bulk ops** | Mass activate/deactivate products |

## Integrations

| Service | Role |
|---------|------|
| **Mercado Pago** | Checkout preferences, webhook HMAC, payment status sync |
| **Cloudinary** | Product images and variant assets |
| **Nodemailer** | Account statements, order confirmations, password reset |
| **Meta WhatsApp** | Optional API (currently deep-link payloads from backend) |
| **Google OAuth** | Customer sign-in |
| **Redis / BullMQ** | Async notification queue with inline fallback |

## Data model highlights

Core entities (30+ tables) group into:

- **Ledger**: Client balance, Sale, Payment, AuditLog, LedgerEntry
- **Catalog**: Product, ProductVariant, Category, AttributeValue, ProductAsset, StockMovement
- **Commerce**: Cart, CartItem, OnlineOrder, Coupon, ShippingZone
- **Platform**: FeatureFlag, IdempotencyRecord, ProcessedWebhook, NotificationLog
- **Compliance**: DianResolution, ElectronicInvoice, CustomerFiscalData
- **Analytics**: Materialized read-model views (refreshed by cron)

Schema details and migrations live in `prisma/schema.prisma` and `prisma/migrations/`.
