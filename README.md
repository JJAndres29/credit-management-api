# Credit Management System

> REST API for managing credit clients, sales, and payments for a retail business. Built with Node.js, TypeScript, Express, and PostgreSQL following **Clean Architecture** principles, now enhanced with a robust E-commerce platform, dynamic product variants, comprehensive analytics, and resilient background queues.

---

### 🌐 Language / Idioma
*   **English** (Current)
*   **[Versión en Español 🇪🇸](README_ES.md)**

---


## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Security](#security)
- [Testing](#testing)
- [Scripts](#scripts)
- [Roadmap](#roadmap)
- [Pagination & Filtering](#pagination--filtering)
- [Pricing System](#pricing-system)
- [Notification System](#notification-system)
- [PDF Report System](#pdf-report-system)
- [Product Categorization & Dynamic Attributes](#product-categorization--dynamic-attributes)
- [Dashboard Collections & Monthly Summary](#dashboard-collections--monthly-summary)
- [Payment Gateway (Mercado Pago)](#payment-gateway-mercado-pago)
- [E-commerce & Shopping Cart](#e-commerce--shopping-cart)
- [Product Variants & Assets](#product-variants--assets)
- [Feature Flags](#feature-flags)
- [Admin Analytics & Marketing](#admin-analytics--marketing)
- [Background Scheduled Jobs](#background-scheduled-jobs)
- [BullMQ Asynchronous Workers](#bullmq-asynchronous-workers)
- [Idempotency Protection](#idempotency-protection)
- [SEO & Sitemap System](#seo--sitemap-system)

---

## Overview

This system allows a retail business to manage credit operations for its clients. Staff members (admins and sellers) interact with the system through a private API. Clients themselves have no direct staff system access — they receive account statements externally via WhatsApp and email, and can log into a fully decoupled E-commerce storefront to view products, manage a shopping cart, configure shipping zones, and place online orders using Mercado Pago or manual WhatsApp checkouts.

**What it handles:**
- **Staff Authentication & RBAC**: Safe admin and seller credentials, renew mechanisms, and granular permissions.
- **Client & Balance Ledger**: Complete credit tracking, available limits, and balance calculation.
- **Cash & Credit Sales**: Atomic transactions that deduct stock and update customer debt.
- **Payments & Corrections**: Full support for PUT updates and DELETE actions on payments that automatically calculate balance differences and log audit logs inside atomic transactions.
- **E-commerce Storefront & Checkout**: Guest and customer checkout flows with tax breakdowns, coupon redemption, shipping zone calculators, and real-time stock reservations.
- **Shopping Cart**: Dual-mode session handling supporting both logged-in customers (stored in DB) and guest anonymous sessions (`X-Cart-Session` header).
- **Product Variants**: Rich attribute mapping supporting extensible categorization (color, size, weight) and individual SKU stock/pricing control.
- **Materialized Analytics & Marketing**: Materialized view caching for daily sales, cohort retention, profitability, dead stock, customer LTV, average ticket size, and price experimentation A/B tests.
- **Automatic Notifications**: Dynamic subscribers triggering email (Nodemailer) and manual WhatsApp Deep Links, throttled to 3 requests per client per hour.
- **BullMQ Background Workers**: BullMQ and Redis integration to process heavy notification queues asynchronously, backed by a circuit breaker policy.
- **Scheduled Background Cron Jobs**: In-process timers with re-entry protection to clean up expired orders, refresh analytics dashboards, and evaluate critical business triggers.
- **Graceful Shutdown**: Proper handler listening to `SIGTERM`/`SIGINT` signals to gracefully close HTTP servers, release background job intervals, and safely disconnect the Prisma connection pool.

---

## Architecture

The project follows **Clean Architecture**, organized in three strict layers. Inner layers never depend on outer layers.

```
┌──────────────────────────────────────────────────────┐
│                  Presentation Layer                   │
│      Express Routers · Controllers · Middlewares      │
├──────────────────────────────────────────────────────┤
│                    Domain Layer                       │
│   Entities · Use Cases · DTOs · Interfaces (ports)   │
├──────────────────────────────────────────────────────┤
│                Infrastructure Layer                   │
│     Prisma Datasources · Repository Implementations  │
│         Service Adapters (JWT · Cloudinary)          │
└──────────────────────────────────────────────────────┘
```

**Patterns applied:**

| Pattern | Purpose |
|---------|---------|
| **Repository** | Abstracts data access — swapping PostgreSQL requires no domain changes. |
| **Use Case** | Each business action is an isolated, testable class. |
| **Adapter** | External libraries implement domain interfaces — replace any library without touching business logic. |
| **DTO** | Input validation happens at the system boundary before reaching use cases. |
| **Dependency Injection** | Constructor-based throughout — no service locator or global state. |
| **Domain Service (Installments)** | Pure business logic, no framework or DB dependencies, fully unit-testable installment computation. |
| **Domain Events** | Use cases emit events after committing transactions. Subscribers handle side effects asynchronously. |
| **Anti-Corruption Layer (ACL)** | `ClientLookupPort` acts as a clean boundary between the E-commerce `Customer` context and the staff `Client` context, translating entities and preventing direct schema coupling. |
| **Feature Flags** | Dynamic route checking middleware allowing runtime module toggling without deployment or server crashes. |
| **Idempotency** | Double-submit transaction safety via `Idempotency-Key` headers stored in an append-only DB ledger. |
| **Tax-Inclusive Service** | Automatic breakdown of gross prices into net and tax (IVA) fields following standard invoicing guidelines. |
| **Risk Evaluation** | Antifraud scoring scoring orders by velocity checks per IP, customer risk categories, and address validation. |

---

## Tech Stack

| Concern | Technology |
|---------|-----------|
| Runtime | Node.js 20 |
| Language | TypeScript 5 (strict mode) |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache & Queue | Redis (`ioredis` + **BullMQ** for background job queues) |
| Authentication | JWT (`jsonwebtoken` / separate staff and customer secret keys) + Google OAuth 2.0 |
| Password hashing | `bcryptjs` |
| File uploads | `multer` (memory storage) |
| Image hosting | Cloudinary (`cloudinary` v2) |
| Security headers | `helmet` |
| CORS | `cors` (supporting dynamic whitelists and credentials) |
| Rate limiting | `express-rate-limit` (custom limits for logins, order creations, and public reads) |
| Testing | Jest + ts-jest |
| PDF generation | PDFKit |
| Logging | `pino` + `pino-http` (JSON structured, ISO timestamps, sensitive data redaction) |
| Graceful Shutdown | Native Unix signals catchers with 25-second safeguard timeout |

---

## Project Structure

```
credit-management-system/
├── prisma/
│   ├── schema.prisma              # ~30+ models: Core Accounting + E-commerce + Coupons + Cart + Variants
│   └── seed.ts                    # Creates default admin user and default categories/flags
├── src/
│   ├── app.ts                     # Server entry point, cron bootstrapper, and signal handler
│   ├── config/
│   │   ├── envs.ts                # Validates required env vars at startup
│   │   ├── prisma.ts              # Prisma client singleton
│   │   └── regular-exp.ts         # Shared regex patterns (email, strong password)
│   ├── domain/                    # Pure business logic — no framework dependencies
│   │   ├── datasources/           # Abstract datasource interfaces
│   │   ├── types/
│   │   │   └── paginated.type.ts  # PaginatedResult<T> generic
│   │   ├── dtos/
│   │   │   ├── auth/              # LoginDto
│   │   │   ├── clients/           # CreateClientDto, UpdateClientDto, FilterClientsDto
│   │   │   ├── customer-auth/     # E-commerce customer registration, claim client, address DTOs
│   │   │   ├── online-orders/     # Online order checkout DTOs
│   │   │   ├── payments/          # CreatePaymentDto, FilterPaymentsDto
│   │   │   ├── products/          # CreateProductDto, AdjustStockDto
│   │   │   ├── sales/             # CreateSaleDto, FilterSalesDto
│   │   │   └── admin/             # FeatureFlagUpdateDto, CreateCouponDto
│   │   ├── entities/              # Core business entities (User, Client, Product, Variant, OnlineOrder, Cart)
│   │   ├── value-objects/         # Money (COP/USD currency safe value object)
│   │   ├── errors/                # CustomError with HTTP status factory methods
│   │   ├── repositories/          # Repository interfaces (ports)
│   │   ├── services/
│   │   │   └── ...                # FeatureFlagPort, ClientLookupPort, Tax Service, PDFService
│   │   └── use-cases/
│   │       ├── analytics/         # Materialized dashboard views logic
│   │       ├── auth/              # LoginUseCase, RenewTokenUseCase
│   │       ├── business-alerts/   # Evaluating alerts & triggers
│   │       ├── cart/              # Cart fetching, additions, merges, clear on checkout
│   │       ├── categories/        # Custom category structures, dynamic attributes and values
│   │       ├── clients/           # GetClients, GetClientById, ClaimClient, NotifyClient
│   │       ├── customer-auth/     # GoogleAuth, ChangeCustomerPassword, ManageAddresses
│   │       ├── online-orders/     # Checkout, Expiry timers, Webhook payment callbacks
│   │       ├── payments/          # CreatePayment, UpdatePayment, DeletePayment
│   │       ├── products/          # QuickCreate, AdjustStock, UploadProductImages
│   │       ├── variants/          # Variants management CRUD
│   │       └── users/             # GetUsers, ToggleUserStatus, ChangePassword
│   ├── infrastructure/            # Implements domain interfaces (adapters)
│   │   ├── datasources/           # Prisma implementations of all domain datasources
│   │   ├── repositories/          # Repository implementations
│   │   ├── jobs/                  # Cron timers (Order Expiry, Read Models, Business Alerts)
│   │   ├── messaging/             # BullMQ Redis Queue, serializable workers, in-process fallbacks
│   │   └── services/              # JwtAdapter, CloudinaryAdapter, MetaWhatsApp, Nodemailer, PinoLogger
│   ├── presentation/              # HTTP Express controllers and routes
│   │   ├── admin/                 # Feature flags, dead letters, coupons, analytics routers
│   │   ├── cart/                  # CartController, CartRouter
│   │   ├── categories/            # Category & Attribute routers
│   │   ├── customer-auth/         # E-commerce customer auth router
│   │   ├── ecommerce/             # Mercado Pago Webhooks raw receiver
│   │   ├── health/                # Health checks (Prisma SELECT 1)
│   │   ├── middlewares/           # FeatureFlagMiddleware, IdempotencyMiddleware, RBAC, CachePublic
│   │   ├── online-orders/         # Online orders API router
│   │   └── server.ts              # Express app setup and middleware cascades
│   └── workers/
│       └── notification.worker.ts # BullMQ separated Redis email/WhatsApp worker
├── Dockerfile                     # Multi-stage production build (Node 20 Alpine)
├── docker-compose.yml             # PostgreSQL 16 + Redis containers
├── jest.config.js
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Redis (optional, automatically fallback to inline memory if redis is not running)
- npm

### 1. Clone the repository

```bash
git clone <repository-url>
cd credit-management-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.template .env
```

Open `.env` and set your values. At minimum, generate strong signing secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

See [Environment Variables](#environment-variables) for the full reference.

### 4. Start the database & cache

```bash
docker-compose up -d
```

This starts PostgreSQL 16 and Redis containers.

### 5. Run migrations

```bash
npm run db:migrate
```

### 6. Seed the default admin user

```bash
npm run db:seed
```

| Field | Value |
|-------|-------|
| Email | `admin@credit.com` |
| Password | `Admin1234!` |
| Role | `ADMIN` |

### 7. Start the development server

```bash
npm run dev
```

API available at: `http://localhost:3000`

### 8. Run background queues (Optional)

In another terminal window:
```bash
npm run worker:notifications
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (e.g. `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `DATABASE_URL` | Yes | PostgreSQL transaction connection string |
| `DIRECT_URL` | Yes | PostgreSQL direct migration string |
| `JWT_SECRET` | Yes | JWT signing secret for staff members — 64+ hex characters |
| `JWT_EXPIRES_IN` | Yes | Staff Token TTL (e.g. `24h`) |
| `JWT_CUSTOMER_SECRET` | Yes* | JWT signing secret for E-commerce customers |
| `JWT_CUSTOMER_EXPIRES_IN` | No | Customer Token TTL (default: `7d`) |
| `GOOGLE_CLIENT_ID` | No | OAuth2 Client ID for Google customer login |
| `REDIS_URL` | No | Redis connection URL (e.g. `redis://localhost:6379`). Enables BullMQ async queues. |
| `APP_URL` | Yes | Public origin URL of the server (required for webhooks and SEO paths) |
| `CLOUDINARY_CLOUD_NAME` | Yes* | Cloudinary cloud account name |
| `CLOUDINARY_API_KEY` | Yes* | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Yes* | Cloudinary API Secret |
| `MP_ACCESS_TOKEN` | Yes* | Mercado Pago access credentials |
| `MP_WEBHOOK_SECRET` | Yes* | Mercado Pago signature validation key |
| `MP_WEBHOOK_DEBUG` | No | Toggle verbose logs for MP webhook events (`true`/`false`) |
| `MP_SANDBOX_MODE` | No | Forces test environment for gateway integration |
| `MP_BACK_URL_SUCCESS` | No | Post-payment success redirect target URL |
| `MP_BACK_URL_FAILURE` | No | Post-payment failed redirect target URL |
| `MP_BACK_URL_PENDING` | No | Post-payment pending redirect target URL |
| `MAILER_EMAIL` | No† | Sender address used for email reports |
| `MAILER_SECRET_KEY` | No† | Gmail App Password (16 characters) |
| `META_WHATSAPP_TOKEN` | No‡ | WhatsApp permanent system user token |
| `META_WHATSAPP_PHONE_NUMBER_ID`| No‡ | WhatsApp meta phone sender identity |
| `SEO_PRODUCT_PATH_PREFIX` | No | Sitemap route product folder prefix (default: `/api/products/by-slug`) |
| `SEO_CATEGORY_PATH_PREFIX` | No | Sitemap route category folder prefix (default: `/api/categories/by-slug`) |
| `BUSINESS_ALERT_EMAILS` | No | Comma-separated admin emails to alert on critical business triggers |

> \* Required if the E-commerce module, customer login, product image catalog or checkout is active.
> † Email credentials are required to dispatch account statements.
> ‡ WhatsApp credentials are required to trigger direct message events.

---

## Database Schema

```
User             — System staff with role (ADMIN | SELLER)
Client           — Credit customers: credit limit, current balance, contact info
Product          — Inventory items: name, stock count, weight, optional suggested retailPrice
ProductVariant   — SKU level item variation with distinct stock, MSRP, and attributeCombinationHash
ProductImage     — Product photos: Cloudinary URL, publicId, display order
ProductAsset     — Rich media asset manager linking images/videos to specific variants
StockMovement    — Comprehensive physical catalog track of product changes and order reservations
Category         — Core product categories with default tax (IVA) rates and SEO meta keys
CategoryAttribute— Extensible list of attribute keys scoped inside categories (Color, Size, Material)
AttributeValue   — List of allowed terms linked to attributes (Red, XL, Cotton)
ProductAttribute — Links product templates to concrete attribute values
Cart             — Shopping carts containing items for customers or guest sessions
CartItem         — Specific items inside carts tracking addition price snapshots
Coupon           — Discount code catalog (PERCENT / FIXED) restricting by product, category, or order
CouponRedemption — Coupon usage history linked to order checkouts
ShippingZone     — Delivery zone directories
ShippingRate     — Specific shipping cost rules and weight multipliers per zone
CustomerAddress  — Customer saved addresses listing defaults
OnlineOrder      — Storefront orders tracking detailed guest/customer data, shipping addresses, tax breakdowns, and status
OnlineOrderItem  — Storefront order line item records and quantity snapshots
OrderEvent       — Append-only operational audit trail recording status updates of online orders
IdempotencyRecord— Server response log mapping cryptographic hashes of request bodies to idempotency keys
ProcessedWebhook — Event tracker to ensure single processing of third-party hook callbacks
FeatureFlag      — Runtime toggle configuration registry (Checkout, MP, physical credit limits, etc.)
LedgerEntry      — Clean append-only accounting book storing signed client balance adjustments
DianResolution   — DIAN invoicing resolution range container (Colombia compliance)
ElectronicInvoice— DIAN electronic invoice payload, Cufe hash, XML links, and status
ElectronicInvoiceItem — DIAN invoice line items with IVA breakdowns
InvoiceAuditLog  — Traceability log of electronic invoice status changes
CustomerFiscalData— Standard Nit/Cedula profiles for B2B or B2C checkouts
DiscountCampaign — Row-level discount campaigns targeting categories
PriceExperiment  — A/B pricing test configuration tracking revenue or conversion winners
ProductSlugHistory— Slug change database tracker to trigger clean 301 redirects
AuditLog         — Immutable staff balance action tracker
NotificationLog  — Email & WhatsApp dispatch trace logs
```

---

## API Reference

Base URL: `http://localhost:3000/api`

### Health Check
- `GET /health` — Anonymous server state monitor. Returns database status and uptime.

### Authentication
- `POST /api/auth/login` — Rate limited staff auth. Returns JWT + User payload.
- `POST /api/auth/renew` — Staff token renew endpoint.

### Customer Authentication (E-commerce)
- `POST /api/customer-auth/register` — Customer sign up.
- `POST /api/customer-auth/login` — Customer login.
- `POST /api/customer-auth/google` — Sign in with Google OAuth token (`idToken`).
- `POST /api/customer-auth/forgot-password` — Requests temporary password generation.
- `POST /api/customer-auth/renew` — Customer token renew (Customer JWT required).
- `POST /api/customer-auth/claim-client` — Binds a storefront Customer to a staff Client (Customer JWT).
- `PATCH /api/customer-auth/change-password` — Customer password change (Customer JWT).
- `GET /api/customer-auth/me` — Fetches profile + linked Client summary (Customer JWT).
- `PATCH /api/customer-auth/me` — Updates profile info (Customer JWT).
- `GET /api/customer-auth/me/addresses` — Lists saved addresses.
- `POST /api/customer-auth/me/addresses` — Creates a new checkout address.
- `PATCH /api/customer-auth/me/addresses/:addressId/default` — Sets default address.
- `PATCH /api/customer-auth/me/addresses/:addressId` — Modifies address data.
- `DELETE /api/customer-auth/me/addresses/:addressId` — Removes saved address.
- `GET /api/customer-auth` — Lists customers (Staff JWT + ADMIN).
- `PATCH /api/customer-auth/:id` — Edit customer details (Staff JWT + ADMIN).
- `POST /api/customer-auth/:id/reset-password` — Force reset customer password (Staff JWT + ADMIN).

### Products & Variants
- `GET /api/products` — Returns active products.
- `GET /api/products/:id` — Detailed product template.
- `GET /api/products/by-slug/:slug` — Fetch product by SEO URL handle.
- `POST /api/products` — Create product (Staff JWT + ADMIN).
- `PUT /api/products/:id` — Update product details (Staff JWT + ADMIN).
- `DELETE /api/products/:id` — Soft deletes product (Staff JWT + ADMIN).
- `POST /api/products/quick-create` — Fast single item creation (Staff JWT + ADMIN).
- `POST /api/products/quick-create-with-variants` — Create product and sub-variants in one request (Staff JWT + ADMIN).
- `PATCH /api/products/:id/stock` — Adjust stock (Staff JWT + ADMIN).
- `PATCH /api/products/:id/retail-price` — Change reference price (Staff JWT + ADMIN).
- `POST /api/products/:id/images` — Upload multiple gallery photos (Staff JWT + ADMIN).
- `DELETE /api/products/:id/images/:imageId` — Remove image from Cloudinary (Staff JWT + ADMIN).
- `GET /api/products/:productId/variants` — Lists variants of a product.
- `POST /api/products/:productId/variants` — Create product variant (Staff JWT + ADMIN).
- `PUT /api/products/:productId/variants/:variantId` — Edit product variant (Staff JWT + ADMIN).
- `DELETE /api/products/:productId/variants/:variantId` — Delete product variant (Staff JWT + ADMIN).
- `POST /api/products/:id/attributes` — Dynamic category attributes sync (Staff JWT + ADMIN).
- `PUT /api/products/:id/attributes` — Dynamic category attributes sync replace (Staff JWT + ADMIN).
- `DELETE /api/products/:id/attributes/:valueId` — Remove attribute value link (Staff JWT + ADMIN).
- `POST /api/products/:id/assets` — Variant dynamic media assets upload (Staff JWT + ADMIN).
- `POST /api/products/:id/assets/reuse` — Link existing asset to variant (Staff JWT + ADMIN).
- `DELETE /api/products/:id/assets/:assetId` — Remove asset record (Staff JWT + ADMIN).

### Categories & Attributes
- `GET /api/categories` — Get active categories.
- `GET /api/categories/by-slug/:slug` — Get category by SEO slug.
- `POST /api/categories` — Create category (Staff JWT + ADMIN).
- `PUT /api/categories/:id` — Update category details (Staff JWT + ADMIN).
- `DELETE /api/categories/:id` — Delete category (Staff JWT + ADMIN).
- `GET /api/categories/:id/attributes` — Get attributes inside category.
- `POST /api/categories/:id/attributes` — Add attribute to category (Staff JWT + ADMIN).
- `PUT /api/attributes/:id` — Edit attribute key name (Staff JWT + ADMIN).
- `DELETE /api/attributes/:id` — Delete category attribute (Staff JWT + ADMIN).
- `GET /api/attributes/:id/values` — Lists allowed terms for attribute.
- `POST /api/attributes/:id/values` — Create attribute value term (Staff JWT + ADMIN).
- `PUT /api/values/:id` — Rename attribute value term (Staff JWT + ADMIN).
- `DELETE /api/values/:id` — Delete attribute value term (Staff JWT + ADMIN).

### E-commerce & Shopping Cart
- `GET /api/cart` — Fetches items (X-Cart-Session or Customer JWT).
- `POST /api/cart/items` — Adds a SKU variant to cart (X-Cart-Session or Customer JWT).
- `PATCH /api/cart/items/:itemId` — Updates quantity (X-Cart-Session or Customer JWT).
- `DELETE /api/cart/items/:itemId` — Removes item from cart (X-Cart-Session or Customer JWT).
- `POST /api/online-orders` — Checkout order. Supports guests (requires guest name, email, phone) or logged-in customers. (Idempotency Key supported).
- `GET /api/online-orders/:id` — Returns online order details (linked customer, or guest email verification in query parameter).
- `GET /api/online-orders` — Lists all online orders (Staff JWT + ADMIN).
- `PATCH /api/online-orders/:id/status` — Updates order delivery/processing status (Staff JWT + ADMIN).
- `GET /api/shipping/zones` — Get active shipping zones and standard delivery rates.
- `POST /api/ecommerce/webhooks/mercadopago` — Mercado Pago webhook gateway integration (Raw bytes HMAC check).

### Staff Clients
- `GET /api/clients` — Returns active clients (Staff JWT).
- `GET /api/clients/:id` — Get client detail (Staff JWT).
- `POST /api/clients` — Create a new client (Staff JWT).
- `PUT /api/clients/:id` — Edit client detail (Staff JWT).
- `DELETE /api/clients/:id` — Soft deletes client (Staff JWT + ADMIN).
- `POST /api/clients/:id/notify` — Trigger statement reminder to Client (Staff JWT).

### Staff Sales & Collections
- `GET /api/sales` — List physical sales (Staff JWT).
- `GET /api/sales/client/:clientId` — Sales of client (Staff JWT).
- `GET /api/sales/:id` — Sale detail (Staff JWT).
- `POST /api/sales` — Create physical cash/credit sale (Staff JWT + Idempotency Key).
- `PUT /api/sales/:id` — Correct collection days and custom sales dates (Staff JWT + ADMIN).
- `DELETE /api/sales/:id` — Erases sale and restores inventory (Staff JWT + ADMIN).
- `GET /api/collections/installments` — Get upcoming, pending, or overdue installments (Staff JWT).

### Staff Payments
- `GET /api/payments` — Get payments (Staff JWT).
- `GET /api/payments/client/:clientId` — Payments of client (Staff JWT).
- `GET /api/payments/sale/:saleId` — Payments of sale (Staff JWT).
- `GET /api/payments/:id` — Payment details (Staff JWT).
- `POST /api/payments` — Register payment (Staff JWT + Idempotency Key).
- `PUT /api/payments/:id` — Edit amount, custom date, or note (Staff JWT + ADMIN).
- `DELETE /api/payments/:id` — Rollback payment and restore customer debt (Staff JWT + ADMIN).

### Audit Logs & Reports
- `GET /api/audit-logs` — Lists financial audit logs (Staff JWT + ADMIN).
- `GET /api/audit-logs/client/:clientId` — Audit logs of client (Staff JWT + ADMIN).
- `GET /api/reports/account-statement/:clientId` — Streams client statement PDF directly (Staff JWT + ADMIN).
- `GET /api/dashboard` — Returns metrics & dashboard highlights (Staff JWT).
- `GET /api/dashboard/monthly-summary` — Monthly collections and dashboard summary (Staff JWT).

### Admin Features & System Operations
- `GET /api/admin/feature-flags` — Lists runtime flags (Staff JWT + ADMIN).
- `PATCH /api/admin/feature-flags/:key` — Toggle a feature flag (Staff JWT + ADMIN).
- `POST /api/admin/coupons` — Create checkout coupon (Staff JWT + ADMIN).
- `PATCH /api/admin/products/bulk-active` — Bulk active/inactive products status (Staff JWT + ADMIN).
- `GET /api/admin/dead-letters` — Inspect failed background notification jobs (Staff JWT + ADMIN).

### Admin Analytics & Marketing
- `POST /api/admin/analytics/read-models/refresh` — Manually trigger analytics database view update (Staff JWT + ADMIN).
- `GET /api/admin/analytics/daily-sales` — Daily sales metrics (Staff JWT + ADMIN).
- `GET /api/admin/analytics/profitability` — Profitability metrics per product (Staff JWT + ADMIN).
- `GET /api/admin/analytics/dead-stock` — Stagnant stock alert list (Staff JWT + ADMIN).
- `GET /api/admin/analytics/inventory-turnover` — Catalog turnover speed index (Staff JWT + ADMIN).
- `GET /api/admin/analytics/cohorts` — E-commerce retention cohorts (Staff JWT + ADMIN).
- `GET /api/admin/analytics/customer-ltv` — Customer lifetime value reports (Staff JWT + ADMIN).
- `GET /api/admin/analytics/ticket-average` — Ticket size metrics (Staff JWT + ADMIN).
- `POST /api/admin/analytics/business-alerts/evaluate` — Runs real-time evaluation of alarms (Staff JWT + ADMIN).
- `POST /api/admin/marketing/discount-campaigns` — Create category discount campaigns (Staff JWT + ADMIN).
- `GET /api/admin/marketing/discount-campaigns` — List discount campaigns (Staff JWT + ADMIN).
- `POST /api/admin/marketing/price-experiments` — Register A/B pricing experiment (Staff JWT + ADMIN).
- `GET /api/admin/marketing/price-experiments` — Get A/B tests (Staff JWT + ADMIN).
- `GET /api/admin/marketing/rotation-alerts` — List low rotation products (Staff JWT + ADMIN).

### SEO Routes
- `GET /sitemap.xml` — Returns product & category XML sitemap (cached, public, rate limited).
- `GET /robots.txt` — Standard search engine configuration.

---

## Security

### Implemented Measures

| Measure | Details |
|---------|---------|
| **Password Hashing** | Enforces `bcryptjs` with 10 salt rounds. |
| **Token Isolation** | Distinct secret keys for staff members (`JWT_SECRET`) and storefront users (`JWT_CUSTOMER_SECRET`). |
| **Dual JWT Middleware** | `AuthMiddleware` blocks standard routes while `CustomerAuthMiddleware` handles customer context. |
| **HMAC Webhook Check** | Validate Mercado Pago signature with SHA256 hashes using a secure raw payload check. |
| **Idempotency middleware** | Evaluates SHA256 hashes on POST body contents against incoming `Idempotency-Key` headers. |
| **Anti-Corruption Layer** | Minimizes dependency coupling: e.g., the customer e-commerce engine communicates with physical staff databases only via the `ClientLookupPort` translation interface. |
| **Feature Flags Guard** | Dynamic route blockers checking DB feature values at runtime. |
| **BullMQ Resilience** | Dispatches background jobs using BullMQ/Redis with graceful fallbacks to inline execution when Redis is offline. |
| **Strict Rate Limiting** | Dynamic rate-limiting rules targeting login attempts, forgot password requests, catalog reading, and checkout operations. |
| **Graceful Shutdown** | SIGTERM/SIGINT signal listeners closing connections and servers with a 25-second timeout. |
| **Input size restriction** | Limits JSON and URL-encoded requests to 10 KB to prevent buffer overflow attacks. |

---

## Testing

Tests are written using **Jest + ts-jest** and located alongside the code they test (`*.test.ts`).

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

### Coverage Highlights

- **Customer Auth (36 tests)**: Ensures register, login, claim client, profile boundaries, JWT isolation, and structural no-coupling rules.
- **Online Orders**: Validates cart clear upon order creation, order expiration rules, and risk evaluation.
- **Variant Catalog**: Verifies SKU unique hashes and stock integrity.
- **Mercado Pago Gateway Adapter**: Validates checkout preference generation and raw body webhook HMAC signatures.
- **Coupling Struct Guard (`no-coupling.test.ts`)**: Structural static checks confirming that the `customer-auth` domain logic never imports `ClientRepository`, `ClientEntity`, or other core staff systems directly.
- **Notification Subscribers (25 tests)**: Confirms WhatsApp templates, email attachments, and throttle limits.
- **PDF Report System (20 tests)**: Validates parallel queries, product deduplication, and streaming.

---

## Scripts

```bash
npm run dev                 # Dev server with hot reload
npm run build               # Compile TypeScript -> dist/
npm start                   # Run compiled production build
npm run worker:notifications# Run the BullMQ Redis notification queue worker
npm test                    # Run test suite
npm run test:watch          # Run tests in watch mode
npm run db:migrate          # Apply Prisma migrations
npm run db:generate         # Regenerate Prisma Client
npm run db:seed             # Populate seed defaults (admin, categories)
npm run db:studio           # Visual Prisma Studio database editor
```

---

## Roadmap

| Phase | Module | Status |
|-------|--------|--------|
| 1-22 | Core systems: staff, clients, products, physical sales, payments, custom dates, collections installments dashboard, audit logs, PDF statements, WhatsApp payload deep links. | ✅ Done |
| 23 | **E-commerce Platform**: Dynamic variants, category attributes catalog, checkout flow, Mercado Pago integration, Google OAuth login. | ✅ Done |
| 24 | **Admin Materialized View Analytics**: Caching summaries, cohort calculations, customer LTV reports, dead stock lists, price experiments. | ✅ Done |
| 25 | **Robust System Infrastructure**: Redis / BullMQ async queues, background cron-like jobs, idempotency headers, DIAN electronic invoicing schema structure, graceful shutdowns. | ✅ Done |

---

## Pagination & Filtering

Every `GET /` listing endpoint supports optional pagination and module-specific filters via query string. No change to the URL path — only query parameters differ.

### Response Shape

```json
{
  "data": [...],
  "pagination": {
    "total": 47,
    "page": 2,
    "limit": 10,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

---

## Pricing System

Prices on physical sales are **set manually at sale time** by the seller, while storefront checkout orders fetch dynamic pricing directly from active variants (`ProductVariant.retailPrice`) or apply coupon discounts server-side.

### Storefront Invoicing and DIAN Tax Splits

E-commerce checkout orders are resolved using a **tax-inclusive (gross) pricing model** according to DIAN (Colombia) guidelines. Subtotal and Tax are automatically resolved and split server-side based on product override `ivaRate` or category fallback values:

```
grossTotal = netSubtotal + ivaAmount
netSubtotal = grossTotal / (1 + ivaPercent / 100)
ivaAmount = grossTotal - netSubtotal
```

---

## Notification System

After every payment and every credit sale, the system automatically sends a WhatsApp message and an email to the client. Notifications are **decoupled from the financial transaction** using the Domain Events pattern.

### BullMQ Background Job Dispatcher

If `REDIS_URL` is set, notification tasks are dispatched into a resilient Redis-backed BullMQ queue. A separate background worker (`npm run worker:notifications`) consumes these jobs, applying retries and preventing main server process blocks. If Redis is down, the system falls back gracefully to synchronous inline execution.

### Throttling Safeguard

Subscribers apply an in-memory throttle limit of **maximum 3 notifications per client per hour**, preventing meta charges or mailer spam.

---

## PDF Report System

The PDF report module generates account statements fully in memory using **PDFKit**. The domain layer defines a `PdfService` interface — the presentation and domain layers are completely unaware of PDFKit. If the PDF library needs to change, only `src/infrastructure/services/pdfkit-pdf.service.ts` needs to be rewritten.

---

## Product Categorization & Dynamic Attributes

The product catalog supports **extensible categorization and dynamic attributes** with zero hardcoded fields (`color`, `size`, etc.).  
`Product` remains generic; category metadata is modeled in separate tables and linked by relations.

### Product Payload with Attributes & Categories

```json
{
  "id": "product-id",
  "name": "Sabana Premium",
  "categoryId": "category-id",
  "categoryName": "Sabanas",
  "attributes": [
    { "attribute": "Color", "value": "Rojo" },
    { "attribute": "Tamano", "value": "Queen" }
  ]
}
```

---

## Payment Gateway (Mercado Pago)

### Secure Webhook Verification Flow

The platform implements a secure, trust-but-verify workflow to capture and evaluate external webhook payment callbacks:

```
POST /api/ecommerce/webhooks/mercadopago
  ├── express.raw() -> captures raw body bytes
  ├── HMAC signature verification -> timingSafeEqual checks
  ├── ProcessedWebhook lookup -> double-processing idempotency check
  ├── GET /v1/payments/{paymentId} -> directly query MP logs (never trust raw webhook body payload)
  └── Atomic Transaction -> Updates order status (PAID/CANCELLED) + saves ProcessedWebhook
```

---

## E-commerce & Shopping Cart

### Checkout Order Expiration Lifetimes

To prevent cart inventory hoarding, the background scheduler runs `OnlineOrderExpiryJob` every 5 minutes:
- **ONLINE_GATEWAY (Mercado Pago)**: Orders expire after **30 minutes** if unpaid.
- **WHATSAPP_MANUAL**: Orders expire after **24 hours** if the customer fails to submit payment proof manually.
- When an order expires, the system automatically frees the reserved stock variants and releases inventory back to the catalog.

---

## Product Variants & Assets

### Individual SKU Variation Models

Storefront items map distinct SKU variants under the `ProductVariant` table. Each variant tracks its stock, cost, suggested price, weight, and holds a unique `attributeHash` (an alphabetized SHA256 string representing the attribute combination). Variants are linked to dynamic assets (images/videos) via the `ProductAsset` manager.

---

## Feature Flags

Runtime switches dynamically toggle system routes and integrations without server reload:
- `checkout_enabled` — Toggles E-commerce cart and checkout routes (returns 503 if off).
- `mp_enabled` — Enables Mercado Pago checkout option.
- `email_enabled` — Toggles Nodemailer dispatches.
- `whatsapp_enabled` — Toggles WhatsApp meta integration.
- `coupon_enabled` — Enables coupon validation at checkout.
- `fraud_strict_mode` — Forces strict antifraud risk checks.
- `credit_module_enabled` — Enables core physical credit limits.
- `physical_sales_enabled` — Enables staff credit/cash sale endpoints.

---

## Admin Analytics & Marketing

Analytics use cases fetch data directly from highly optimized materialized database views. Admins can call `POST /api/admin/analytics/read-models/refresh` to run clean view refreshes:
- **Cohort Retention**: Groups customer profiles monthly to calculate recurring storefront purchase rates.
- **Customer Lifetime Value (LTV)**: Totals customer checkouts to identify VIP buyers.
- **Profitability Reports**: Computes margins using `retailPrice` and `investmentCost`.
- **Rotation Alerts**: Flags low-turnover, stagnant stock items.
- **A/B Price Experiments**: Registers A/B price targets to evaluate revenue or conversion winners.

---

## Background Scheduled Jobs

Background tasks are registered in `app.ts` and run inside in-process intervals backed by re-entry locks:
1. `OnlineOrderExpiryJob` — Resolves and cancels expired pending orders (5 min intervals).
2. `AnalyticsReadModelsRefreshJob` — Refreshes PostgreSQL materialized analytics views (1 hour intervals).
3. `BusinessAlertsEvaluationJob` — Evaluates metrics and fires `BUSINESS_ALERT_TRIGGERED` alerts (15 min intervals).

---

## BullMQ Asynchronous Workers

Heavy system tasks (email dispatches and WhatsApp document uploads) are offloaded to background BullMQ queues:
- **Setup**: Workers listen to redis connections using `npm run worker:notifications`.
- **Fault-Tolerance**: If Redis fails or is not configured, the app falls back safely to synchronous inline execution.
- **Traceability**: Audit attempts and errors are logged inside the `NotificationLog` database.

---

## Idempotency Protection

To protect financial transactions against network double-clicks or double-submits, endpoints (sales, payments, online orders) support unique `Idempotency-Key` headers:
- The server records the incoming key, hashes the payload, and saves the HTTP response inside the `IdempotencyRecord` table.
- Subsequent requests with the same key receive the cached response immediately, bypassing duplicate writes.

---

## SEO & Sitemap System

The storefront serves a dynamic XML sitemap fully optimized for web search engines:
- **Sitemap XML**: Accessible at `GET /sitemap.xml`, generating active category and product links dynamically.
- **Redirection History**: `ProductSlugHistory` tracks slug changes and triggers clean HTTP 301 redirects, preserving search engine ranking points.
- **Performance**: Sitemap and robots.txt endpoints utilize `cachePublic` HTTP cache headers and are rate-limited to prevent crawler scrapers from overwhelming the catalog database.
