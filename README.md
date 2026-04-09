# Credit Management System

> REST API for managing credit clients, sales, and payments for a retail business. Built with Node.js, TypeScript, Express, and PostgreSQL following **Clean Architecture** principles.

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

---

## Overview

This system allows a retail business to manage credit operations for its clients. Staff members (admins and sellers) interact with the system through a private API. Clients themselves have no system access — they receive account statements externally via WhatsApp and email.

**What it handles:**
- Staff authentication and role-based authorization
- Client management with credit limits and balance tracking
- Product catalog management with stock control and multi-image uploads via Cloudinary
- Cash and credit sales with automatic stock deduction and client balance update (atomic transaction)
- **Differential pricing by sale type** — cash and credit sales apply different prices via a pluggable Pricing Domain Service (Strategy Pattern). Prices are always computed server-side; clients cannot supply them
- Payment registration with automatic sale status update (PENDING → PARTIAL → PAID) and client balance reduction (atomic transaction)
- Immutable audit log of every balance-changing operation (credit sales and payments), written atomically inside each transaction
- **Automatic notifications** — WhatsApp (via Twilio) and email (via Nodemailer/Gmail) sent after every payment and credit sale. Payment emails include the full account statement as a PDF attachment. Notifications are optional and best-effort: if the provider fails or credentials are missing, the financial operation is not affected
- **PDF account statements** — On-demand PDF generation for any client via `GET /api/reports/account-statement/:clientId`. The PDF is generated in memory and streamed directly to the browser — nothing is ever saved to disk

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
| **Repository** | Abstracts data access — swapping PostgreSQL requires no domain changes |
| **Use Case** | Each business action is an isolated, testable class |
| **Adapter** | External libraries (JWT, Cloudinary, Twilio, Nodemailer) implement domain interfaces — replace any library without touching business logic |
| **DTO** | Input validation happens at the system boundary before reaching use cases |
| **Dependency Injection** | Constructor-based throughout — no service locator or global state |
| **Strategy (Pricing)** | Pricing rules are interchangeable strategies. Adding a new pricing rule = one new class, no existing code touched |
| **Domain Service (Pricing)** | `PricingService` lives in the domain layer — pure business logic, no framework or DB dependencies, fully unit-testable |
| **Domain Events** | Use cases emit events after committing transactions. Subscribers handle side effects (notifications) asynchronously — financial operations never wait for or fail because of notifications |
| **Domain Service (PDF)** | `PdfService` interface lives in the domain layer. `PdfkitPdfService` in infrastructure is the only file that knows about PDFKit. Replacing the PDF library requires changing only one file |

---

## Tech Stack

| Concern | Technology |
|---------|-----------|
| Runtime | Node.js 20 |
| Language | TypeScript 5 (strict mode) |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Authentication | JWT (`jsonwebtoken`) |
| Password hashing | `bcryptjs` |
| File uploads | `multer` (memory storage) |
| Image hosting | Cloudinary (`cloudinary` v2) |
| Security headers | `helmet` |
| CORS | `cors` |
| Rate limiting | `express-rate-limit` |
| Testing | Jest + ts-jest |
| PDF generation | PDFKit |
| Dev server | ts-node-dev |
| Containerization | Docker Compose (PostgreSQL) |

---

## Project Structure

```
credit-management-system/
├── prisma/
│   ├── schema.prisma              # 9 models: User, Client, Product, ProductImage, Sale, SaleItem, Payment, AuditLog
│   └── seed.ts                    # Creates default admin user
├── src/
│   ├── app.ts                     # Entry point
│   ├── config/
│   │   ├── envs.ts                # Validates required env vars at startup
│   │   ├── prisma.ts              # Prisma client singleton
│   │   └── regular-exp.ts         # Shared regex patterns (email, strong password)
│   ├── domain/                    # Pure business logic — no framework dependencies
│   │   ├── datasources/           # Abstract datasource interfaces
│   │   ├── types/
│   │   │   └── paginated.type.ts  # PaginatedResult<T> generic — returned by all paginated endpoints
│   │   ├── dtos/
│   │   │   ├── auth/              # LoginDto
│   │   │   ├── clients/           # CreateClientDto, UpdateClientDto, FilterClientsDto
│   │   │   ├── payments/          # CreatePaymentDto, FilterPaymentsDto
│   │   │   ├── products/          # CreateProductDto, UpdateProductDto, AdjustStockDto, FilterProductsDto
│   │   │   ├── sales/             # CreateSaleDto, FilterSalesDto
│   │   │   ├── shared/            # PaginationDto (page, limit, skip getter)
│   │   │   ├── audit-logs/        # FilterAuditLogsDto
│   │   │   └── users/             # CreateUserDto, UpdateUserDto, ChangePasswordDto
│   │   ├── entities/              # UserEntity, ClientEntity, ProductEntity, ProductImageEntity, SaleEntity, SaleItemEntity, PaymentEntity
│   │   ├── errors/                # CustomError with HTTP status factory methods
│   │   ├── repositories/          # Repository interfaces (ports)
│   │   ├── services/
│   │   │   ├── pricing/           # Pricing Domain Service (Strategy Pattern)
│   │   │   │   ├── pricing-context.ts          # Input value object
│   │   │   │   ├── pricing-result.ts           # Output value object
│   │   │   │   ├── pricing-strategy.interface.ts
│   │   │   │   ├── pricing.service.ts          # Orchestrator — selects highest-priority matching strategy
│   │   │   │   └── strategies/
│   │   │   │       ├── cash-pricing.strategy.ts     # CASH → base price, no surcharge
│   │   │   │       └── credit-pricing.strategy.ts   # CREDIT → base price + CREDIT_SURCHARGE_PERCENT%
│   │   │   └── ...                # JwtService, EmailService, NotificationService, PdfService, FileStorageService
│   │   └── use-cases/
│   │       ├── auth/              # LoginUseCase, RenewTokenUseCase
│   │       ├── clients/           # CreateClient, GetClients, GetClientById, UpdateClient, DeleteClient
│   │       ├── audit-logs/        # GetAuditLogs, GetAuditLogsByClient
│   │       ├── payments/          # CreatePayment, GetPayments, GetPaymentById, GetPaymentsByClient, GetPaymentsBySale
│   │       ├── products/          # GetProducts, GetProductById, CreateProduct, UpdateProduct, AdjustStock, DeleteProduct, UploadProductImages, DeleteProductImage
│   │       ├── reports/           # GenerateAccountStatement
│   │       ├── sales/             # CreateSale, GetSales, GetSaleById, GetSalesByClient
│   │       └── users/             # GetUsers, GetUserById, CreateUser, UpdateUser, ToggleUserStatus, ChangePassword
│   ├── infrastructure/            # Implements domain interfaces (adapters)
│   │   ├── datasources/           # PrismaAuthDatasource, PrismaClientDatasource, PrismaProductDatasource, PrismaUserDatasource, PrismaSaleDatasource, PrismaPaymentDatasource, PrismaAuditLogDatasource
│   │   ├── repositories/          # AuthRepositoryImpl, ClientRepositoryImpl, ProductRepositoryImpl, UserRepositoryImpl, SaleRepositoryImpl, PaymentRepositoryImpl, AuditLogRepositoryImpl
│   │   └── services/              # JwtAdapter, CloudinaryAdapter, TwilioWhatsAppService, NodemailerEmailService, PdfkitPdfService
│   └── presentation/              # HTTP layer
│       ├── auth/                  # AuthController, AuthRouter
│       ├── audit-logs/            # AuditLogController, AuditLogRouter
│       ├── clients/               # ClientController, ClientRouter
│       ├── payments/              # PaymentController, PaymentRouter
│       ├── products/              # ProductController, ProductRouter
│       ├── reports/               # ReportController, ReportRouter
│       ├── sales/                 # SaleController, SaleRouter
│       ├── users/                 # UserController, UserRouter
│       ├── middlewares/
│       │   ├── auth.middleware.ts         # JWT validation + DB user check
│       │   ├── rbac.middleware.ts         # Role-based access control (checkRole)
│       │   ├── rate-limit.middleware.ts   # Login rate limiter
│       │   └── upload.middleware.ts       # Multer: memory storage, file type + size validation
│       └── server.ts              # Express app setup (helmet, cors, body limit, routes)
├── .env.template                  # Environment variables template
├── docker-compose.yml             # PostgreSQL 16 container
├── jest.config.js
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
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

Open `.env` and set your values. At minimum, generate a strong `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

See [Environment Variables](#environment-variables) for the full reference.

### 4. Start the database

```bash
docker-compose up -d
```

This starts a PostgreSQL 16 container on port `5433`.

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

> Change these credentials immediately in any non-local environment.

### 7. Start the development server

```bash
npm run dev
```

API available at: `http://localhost:3000`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (e.g. `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret — use 64+ random hex chars in production |
| `JWT_EXPIRES_IN` | Yes | Token TTL (e.g. `7d`, `24h`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins. Defaults to `localhost:4200,localhost:5173` |
| `CREDIT_SURCHARGE_PERCENT` | No | Surcharge % applied to credit sales. Default: `0`. Example: `15` adds 15% to the base product price on all CREDIT sales |
| `CLOUDINARY_CLOUD_NAME` | Yes* | Required for product image uploads |
| `CLOUDINARY_API_KEY` | Yes* | Required for product image uploads |
| `CLOUDINARY_API_SECRET` | Yes* | Required for product image uploads |
| `MAILER_EMAIL` | No† | Gmail address used as the sender: `youraddress@gmail.com` |
| `MAILER_SECRET_KEY` | No† | Gmail App Password (16 chars). Generate at: Google Account → Security → 2-Step Verification → App passwords. **Not your Gmail password** |
| `MAILER_SERVICE` | No | Email provider (default: `gmail`) |
| `TWILIO_ACCOUNT_SID` | No‡ | Twilio Account SID — found at console.twilio.com → Dashboard. Starts with `AC...` |
| `TWILIO_AUTH_TOKEN` | No‡ | Twilio Auth Token — same page, click the eye icon to reveal |
| `TWILIO_WHATSAPP_FROM` | No‡ | WhatsApp Sandbox sender number, format: `whatsapp:+14155238886` (shown in Twilio → Messaging → Try it out → Send a WhatsApp message) |

> \* Required if you use the `POST /api/products/:id/images` endpoint.
> † Both `MAILER_EMAIL` and `MAILER_SECRET_KEY` must be set together to enable email notifications. If either is missing, the server starts normally with a warning and emails are skipped.
> ‡ All three Twilio variables must be set together to enable WhatsApp notifications. Same behavior — missing vars = warning + feature disabled, no crash.

---

## Database Schema

```
User             — System staff with role (ADMIN | SELLER)
Client           — Credit customers: credit limit, current balance, contact info
Product          — Inventory items: name, price (base price), stock count
ProductImage     — Product photos: Cloudinary URL, publicId, display order (one product → many images)
Sale             — Orders per client: type (CASH | CREDIT), status (PAID | PENDING | PARTIAL)
SaleItem         — Line items per sale: product, quantity, basePrice (snapshot), unitPrice (final charged), subtotal, appliedRule
Payment          — Payments per client/sale: amount, optional note
AuditLog         — Immutable log of balance changes: user, IP, before/after values
NotificationLog  — Log of every notification attempt: channel (WHATSAPP|EMAIL), event, status (SENT|FAILED), errorMessage
```

**`SaleItem` pricing fields:**

| Field | Description |
|-------|-------------|
| `basePrice` | Snapshot of `Product.price` at the time of the sale — immutable, for audit purposes |
| `unitPrice` | Final price charged per unit (may include a credit surcharge) |
| `appliedRule` | Pricing rule applied — e.g. `"CASH_BASE"`, `"CREDIT_SURCHARGE_15PCT"`. Null on sales created before the Pricing Domain Service |

**Enums:**

| Enum | Values |
|------|--------|
| `Role` | `ADMIN`, `SELLER` |
| `SaleType` | `CASH`, `CREDIT` |
| `SaleStatus` | `PAID`, `PENDING`, `PARTIAL` |

All entities use **soft deletes** (`isActive` flag) — no data is ever permanently removed.

**ProductImage relation:**

`ProductImage` stores each photo separately, linked to its product by `productId`. The `order` field controls display priority (0 = cover/primary image). Uploading multiple images in a single request assigns sequential `order` values starting after the last existing image.

---

## API Reference

Base URL: `http://localhost:3000/api`

### Health check

```http
GET /health
```

**Response `200`:**
```json
{ "status": "ok" }
```

No authentication required.

---

### Authentication

#### POST `/api/auth/login`

Authenticate and receive a JWT.

> Rate limited: **10 requests per 15 minutes per IP**.

**Request body:**
```json
{
  "email": "admin@credit.com",
  "password": "Admin1234!"
}
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Administrador",
    "email": "admin@credit.com",
    "role": "ADMIN"
  }
}
```

**Response `401`:** `{ "error": "Credenciales inválidas" }` — same message whether email or password is wrong (prevents email enumeration).

**Response `429`:** Rate limit exceeded.

---

#### POST `/api/auth/renew`

Exchange a valid JWT for a new one (extends session).

**Headers:** `Authorization: Bearer <token>`

**Response `200`:** Same structure as login response with a fresh token.

---

### Products

All product endpoints require `Authorization: Bearer <token>`.

> Endpoints that modify data (`POST`, `PUT`, `PATCH`, `DELETE`) require `ADMIN` role. `GET` endpoints are available to any authenticated user.

#### GET `/api/products`

Returns active products with their images, sorted by creation date (newest first). Supports pagination and filters.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `search` | string | Filter by product name (case-insensitive) |
| `minPrice` | number | Minimum price |
| `maxPrice` | number | Maximum price |
| `minStock` | integer | Minimum stock |
| `maxStock` | integer | Maximum stock |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Camisa Azul",
      "price": 45000,
      "stock": 100,
      "images": [
        {
          "id": "uuid",
          "productId": "uuid",
          "url": "https://res.cloudinary.com/...",
          "publicId": "products/abc123",
          "order": 0,
          "createdAt": "2026-04-07T00:00:00.000Z"
        }
      ],
      "isActive": true,
      "createdAt": "2026-04-07T00:00:00.000Z",
      "updatedAt": "2026-04-07T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

#### GET `/api/products/:id`

Returns a single active product with its images.

**Response `404`:** Product not found or inactive.

---

#### POST `/api/products`

Create a new product. Images are added separately via `POST /:id/images`.

> **Requires `ADMIN` role.**

**Request body:**
```json
{
  "name": "Camisa Azul",
  "price": 45000,
  "stock": 100
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | Yes | Min 2 characters |
| `price` | number | Yes | Greater than 0 |
| `stock` | number | No | Integer >= 0, defaults to `0` |

**Response `201`:** Created product object with empty `images` array.

---

#### PUT `/api/products/:id`

Update product name and/or price. At least one field required. Use dedicated endpoints for stock (`PATCH /:id/stock`) and images (`POST /:id/images`).

> **Requires `ADMIN` role.**

**Request body (all fields optional):**
```json
{
  "name": "Camisa Azul Premium",
  "price": 55000
}
```

**Response `404`:** Product not found or inactive.

---

#### PATCH `/api/products/:id/stock`

Adjust stock by a positive or negative integer. The use case validates the resulting stock never goes below 0.

> **Requires `ADMIN` role.**

**Request body:**
```json
{ "quantity": -10 }
```

| Field | Type | Validation |
|-------|------|-----------|
| `quantity` | integer | Non-zero. Positive to add, negative to subtract |

**Response `400`:** Insufficient stock (would result in negative stock).

**Response `404`:** Product not found or inactive.

---

#### POST `/api/products/:id/images`

Upload one or more images for a product. Images are stored in Cloudinary and referenced in the `ProductImage` table. Each request can include up to **5 files**. Multiple calls accumulate — existing images are preserved.

> **Requires `ADMIN` role.**

**Request:** `multipart/form-data`

| Field | Type | Details |
|-------|------|---------|
| `images` | file(s) | 1–5 files. Accepted formats: **JPG, PNG, WebP**. Max size per file: **5 MB** |

**Response `200`:** Updated product object with all images (including newly uploaded ones), sorted by `order` ascending.

**Response `400`:** No files sent, invalid format, or file exceeds 5 MB.

**Response `404`:** Product not found or inactive.

---

#### DELETE `/api/products/:id/images/:imageId`

Delete a specific image. The file is permanently removed from Cloudinary before the database record is deleted. If Cloudinary deletion fails, the database record is not touched.

> **Requires `ADMIN` role.**

**Response `200`:** Updated product object without the deleted image.

**Response `404`:** Product not found, or image does not belong to this product.

---

#### DELETE `/api/products/:id`

Soft delete — sets `isActive = false`. The product (and its images) remain in the database and are preserved for historical sale records.

> **Requires `ADMIN` role.**

---

### Clients

All client endpoints require `Authorization: Bearer <token>`.

#### GET `/api/clients`

Returns active clients, sorted by creation date (newest first). Supports pagination and filters.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `search` | string | Filter by name, phone, or email (case-insensitive) |
| `minBalance` | number | Minimum balance |
| `maxBalance` | number | Maximum balance |
| `hasDebt` | boolean | `true` = clients with balance > 0; `false` = clients with balance = 0 |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "María García",
      "phone": "3001234567",
      "email": "maria@ejemplo.com",
      "creditLimit": 500000,
      "balance": 150000,
      "isActive": true,
      "createdAt": "2026-04-06T00:00:00.000Z",
      "updatedAt": "2026-04-06T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 18,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

#### GET `/api/clients/:id`

**Response `404`:** Client not found or inactive.

---

#### POST `/api/clients`

Create a new client.

**Request body:**
```json
{
  "name": "María García",
  "phone": "3001234567",
  "email": "maria@ejemplo.com",
  "creditLimit": 500000
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | Yes | Min 2 characters |
| `phone` | string | Yes | |
| `email` | string | No | Valid format, must be unique |
| `creditLimit` | number | Yes | >= 0 |

**Response `201`:** Created client object.

**Response `409`:** Email already registered.

---

#### PUT `/api/clients/:id`

Update one or more fields. At least one field required.

**Request body (all fields optional):**
```json
{
  "name": "María García López",
  "phone": "3009876543",
  "email": "nuevo@ejemplo.com",
  "creditLimit": 750000
}
```

---

#### DELETE `/api/clients/:id`

Soft delete — sets `isActive = false`. Client history is preserved.

> **Requires `ADMIN` role.** Returns `403` for `SELLER` accounts.

---

### Sales

All sales endpoints require `Authorization: Bearer <token>`. Any authenticated user (ADMIN or SELLER) can create and view sales.

#### GET `/api/sales`

Returns sales with their line items, sorted by creation date (newest first). Supports pagination and filters.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `clientId` | string | Filter by client ID |
| `type` | string | `CASH` or `CREDIT` |
| `status` | string | `PAID`, `PENDING`, or `PARTIAL` |
| `dateFrom` | string | ISO 8601 date — start of range (inclusive) |
| `dateTo` | string | ISO 8601 date — end of range (inclusive, adjusted to 23:59:59) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clientId": "uuid",
      "type": "CREDIT",
      "status": "PENDING",
      "total": 135000,
      "createdAt": "2026-04-08T00:00:00.000Z",
      "items": [
        {
          "id": "uuid",
          "saleId": "uuid",
          "productId": "uuid",
          "quantity": 3,
          "unitPrice": 45000,
          "subtotal": 135000
        }
      ]
    }
  ],
  "pagination": {
    "total": 63,
    "page": 1,
    "limit": 20,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

#### GET `/api/sales/client/:clientId`

Returns all sales for a specific client, sorted by creation date (newest first). Returns `404` if the client does not exist or is inactive.

---

#### GET `/api/sales/:id`

Returns a single sale with its line items. Returns `404` if not found.

---

#### POST `/api/sales`

Create a new sale. Prices are always taken from the current product catalog — client cannot supply prices.

**Request body:**
```json
{
  "clientId": "uuid",
  "type": "CREDIT",
  "items": [
    { "productId": "uuid", "quantity": 3 },
    { "productId": "uuid", "quantity": 1 }
  ]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `clientId` | string | Yes | Client must exist and be active |
| `type` | string | Yes | `CASH` or `CREDIT` |
| `items` | array | Yes | Min 1 item. No duplicate `productId` values |
| `items[].productId` | string | Yes | Product must exist, be active, and have sufficient stock |
| `items[].quantity` | integer | Yes | Positive integer |

**Business rules applied:**
- Stock is verified before creating the sale — insufficient stock returns `400`
- **Prices are always computed server-side by the Pricing Domain Service** — the client never supplies unit prices
  - `CASH` sales apply the base product price (`CASH_BASE` rule)
  - `CREDIT` sales apply a configurable surcharge (`CREDIT_SURCHARGE_{N}PCT` rule, set via `CREDIT_SURCHARGE_PERCENT` env var)
- For `CREDIT` sales: `client.creditLimit - client.balance >= total` (computed with the surcharge-adjusted total), otherwise `400`
- All operations (stock deduction, balance update, sale + items creation) run in a **single atomic database transaction**
- `CASH` sales are created with status `PAID`. `CREDIT` sales start as `PENDING`
- Each `SaleItem` records `basePrice`, `unitPrice`, and `appliedRule` for full pricing traceability

**Response `201`:** Created sale object with items. Each item includes `basePrice`, `unitPrice`, and `appliedRule`.

**Response `400`:** Validation error, insufficient stock, or insufficient credit.

**Response `404`:** Client or any product not found.

---

### Payments

All payment endpoints require `Authorization: Bearer <token>`. Any authenticated user (ADMIN or SELLER) can register and view payments.

#### GET `/api/payments`

Returns payments, sorted by creation date (newest first). Supports pagination and filters.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `clientId` | string | Filter by client ID |
| `saleId` | string | Filter by sale ID |
| `dateFrom` | string | ISO 8601 date — start of range (inclusive) |
| `dateTo` | string | ISO 8601 date — end of range (inclusive) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clientId": "uuid",
      "saleId": "uuid",
      "amount": 50000,
      "note": "Abono parcial",
      "createdAt": "2026-04-08T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 31,
    "page": 1,
    "limit": 20,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

#### GET `/api/payments/client/:clientId`

Returns all payments for a specific client, sorted by creation date (newest first). Returns `404` if the client does not exist.

---

#### GET `/api/payments/sale/:saleId`

Returns all payments associated with a specific sale. Returns `404` if the sale does not exist.

---

#### GET `/api/payments/:id`

Returns a single payment. Returns `404` if not found.

---

#### POST `/api/payments`

Register a payment from a client. Optionally links the payment to a specific sale, which triggers an automatic sale status update.

**Request body:**
```json
{
  "clientId": "uuid",
  "amount": 50000,
  "saleId": "uuid",
  "note": "Abono parcial"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `clientId` | string | Yes | Client must exist and be active |
| `amount` | number | Yes | Greater than 0, max 2 decimal places |
| `saleId` | string | No | If provided, sale must exist, belong to the client, and not be `PAID` |
| `note` | string | No | Max 500 characters |

**Business rules applied:**
- `amount` cannot exceed the client's current `balance` (prevents overpayment)
- If `saleId` is provided: the sale must belong to the same `clientId` (prevents cross-client manipulation), and `amount` cannot exceed the remaining unpaid amount on that sale
- All operations (payment creation, client balance decrement, sale status update) run in a **single atomic database transaction**
- Sale status is computed inside the transaction by summing all payments for that sale: if `totalPaid >= sale.total` → `PAID`, otherwise → `PARTIAL`

**Response `201`:** Created payment object.

**Response `400`:** Validation error, amount exceeds client balance, sale already paid, or amount exceeds sale's remaining balance.

**Response `403`:** Sale does not belong to the specified client.

**Response `404`:** Client or sale not found.

---

### Audit Logs

All audit log endpoints require `Authorization: Bearer <token>` and **`ADMIN` role**.

Audit log entries are created automatically inside the atomic transactions of credit sales and payments — there is no public creation endpoint. The log records every client balance change with who triggered it, from which IP, and the before/after values.

#### GET `/api/audit-logs`

Returns audit log entries, sorted by creation date (newest first). Supports pagination and filters.

> **Requires `ADMIN` role.**

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: `1`) |
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `clientId` | string | Filter by client ID |
| `userId` | string | Filter by user (staff member) who triggered the operation |
| `action` | string | `CREDIT_SALE` or `PAYMENT` |
| `dateFrom` | string | ISO 8601 date — start of range (inclusive) |
| `dateTo` | string | ISO 8601 date — end of range (inclusive) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clientId": "uuid",
      "userId": "uuid",
      "action": "PAYMENT",
      "before": 150000,
      "after": 100000,
      "ip": "::1",
      "createdAt": "2026-04-08T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 9,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

| `action` value | Meaning |
|----------------|---------|
| `CREDIT_SALE` | Client balance increased — a credit sale was registered |
| `PAYMENT` | Client balance decreased — a payment was registered |

---

#### GET `/api/audit-logs/client/:clientId`

Returns all audit log entries for a specific client. Returns `404` if the client does not exist.

> **Requires `ADMIN` role.**

---

### Users

All user endpoints require `Authorization: Bearer <token>`.

> Most endpoints require `ADMIN` role. The only exception is `PATCH /:id/password`, which allows the authenticated user to change their own password.

#### GET `/api/users`

Returns all users (active and inactive), sorted by creation date.

> **Requires `ADMIN` role.**

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Juan Vendedor",
    "email": "juan@empresa.com",
    "role": "SELLER",
    "isActive": true,
    "createdAt": "2026-04-07T00:00:00.000Z",
    "updatedAt": "2026-04-07T00:00:00.000Z"
  }
]
```

Password is never included in any response.

---

#### GET `/api/users/:id`

> **Requires `ADMIN` role.**

**Response `404`:** User not found.

---

#### POST `/api/users`

Create a new user (admin or seller).

> **Requires `ADMIN` role.**

**Request body:**
```json
{
  "name": "Juan Vendedor",
  "email": "juan@empresa.com",
  "password": "Password123!",
  "role": "SELLER"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | Yes | Min 2 characters |
| `email` | string | Yes | Valid format, must be unique |
| `password` | string | Yes | Min 8 chars, uppercase, lowercase, number, special character |
| `role` | string | No | `ADMIN` or `SELLER` (defaults to `SELLER`) |

**Response `201`:** Created user object (no password).

**Response `409`:** Email already registered.

---

#### PUT `/api/users/:id`

Update one or more fields. At least one field required. Password changes use a dedicated endpoint.

> **Requires `ADMIN` role.**

**Request body (all fields optional):**
```json
{
  "name": "Juan Vendedor Actualizado",
  "email": "nuevo@empresa.com",
  "role": "ADMIN"
}
```

---

#### PATCH `/api/users/:id/status`

Activate or deactivate a user. Deactivated users are immediately blocked from all endpoints.

> **Requires `ADMIN` role.**

**Request body:**
```json
{ "isActive": false }
```

**Response `400`:** User is already in the requested state.

---

#### PATCH `/api/users/:id/password`

Change a user's password.

> **Allowed for:** the authenticated user changing their own password, or any `ADMIN` changing anyone's password.

**Request body:**
```json
{
  "currentPassword": "Password123!",
  "newPassword": "NuevoPassword456@"
}
```

**Response `200`:** `{ "message": "Contraseña actualizada correctamente" }`

**Response `401`:** Current password is incorrect.

**Response `400`:** New password is the same as the current one, or does not meet the password policy.

---

### Reports

All report endpoints require `Authorization: Bearer <token>` and **`ADMIN` role**.

#### GET `/api/reports/account-statement/:clientId`

Generates and downloads the full account statement for a client as a PDF file.

> **Requires `ADMIN` role.**

**Response `200`:** Binary PDF file.

| Header | Value |
|--------|-------|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment; filename="estado-cuenta-{clientId}.pdf"` |

**PDF contents:**
1. **Header** — Business name, generation date and time, name of the user who generated it
2. **Client info** — Name, phone, email, client ID
3. **Credit usage bar** — Visual bar with percentage used: green (<50%), amber (50–80%), red (>80%). Shows debt, available credit, and limit
4. **Sales table** — Each sale shows ID, date, type (Contado/Crédito), status (color-coded), and total. Sub-rows list each line item: product name, quantity, unit price, subtotal
5. **Payments table** — Each payment shows ID, date, amount, note, and associated sale ID
6. **Financial summary** — Three cards: total sales, total paid, current balance
7. **Footer** — Exact generation timestamp, marked "Confidencial"

**Automatic page breaks:** The generator checks available vertical space before each section and adds a new page if needed — tables are never cut mid-row.

**Response `403`:** Not authenticated or not ADMIN.

**Response `404`:** Client not found.

---

### Error format

All errors follow this consistent structure:

```json
{ "error": "Descriptive error message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Validation error |
| `401` | Missing, invalid, or expired token |
| `403` | Authenticated but insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate email) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Security

### Implemented measures

| Measure | Details |
|---------|---------|
| **Password hashing** | bcryptjs, 10 salt rounds |
| **JWT authentication** | Signed tokens verified on every protected request |
| **Active user check** | On every request: token validity + user confirmed active in DB |
| **Anti-enumeration** | Login always returns the same error regardless of whether the email exists |
| **Role-based access control** | Per-endpoint role enforcement (`ADMIN` / `SELLER`) |
| **Rate limiting** | Login: max 10 attempts / 15 min per IP |
| **Security headers** | `helmet` sets `X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security`, and more |
| **CORS whitelist** | Configurable via `ALLOWED_ORIGINS` — defaults to localhost dev ports |
| **Request body size limit** | 10 KB cap — prevents payload-based DoS |
| **Strong password policy** | Enforced at user creation: min 8 chars + uppercase + lowercase + number + special character |
| **SQL injection prevention** | Prisma ORM uses parameterized queries exclusively |
| **No hardcoded secrets** | All sensitive values from environment variables; server refuses to start if any required variable is missing |
| **Soft deletes** | Data is never permanently deleted — full history preserved |
| **File upload validation** | Multer enforces allowed MIME types (JPG, PNG, WebP), 5 MB per-file limit, and max 5 files per request — malformed or oversized uploads are rejected before reaching business logic |
| **Cloudinary-side storage** | Uploaded images never touch the server disk — processed in memory and streamed to Cloudinary, eliminating local file exposure |
| **Image ownership check** | `DELETE /products/:id/images/:imageId` verifies the image belongs to the specified product before deletion |
| **Cross-client payment prevention** | `POST /payments` validates that the provided `saleId` belongs to the same `clientId` in the request body — prevents a malicious actor from linking a payment to another client's sale |
| **Payment overpayment protection** | Amount is validated against both the client's total balance and the specific sale's remaining balance before the transaction executes |

| **Immutable audit log** | Every credit sale and payment writes an `AuditLog` entry inside the same atomic transaction — records `userId`, `clientId`, `action`, `before`/`after` balance, and request IP. If the operation rolls back, the log entry rolls back too |

### Planned

- Refresh token + short-lived access tokens (15 min access / 7 day refresh)
- Account lockout after N consecutive failed login attempts
- Structured security event logging (login failures, invalid tokens)

---

## Testing

Tests are written with **Jest + ts-jest** and located alongside the code they test (`*.test.ts`).

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode (re-runs on file save)
```

### Current coverage

| Module | Unit tests |
|--------|-----------|
| `LoginUseCase` | Covered — invalid user, inactive user, wrong password, success, token payload, password not exposed |
| `RenewTokenUseCase` | Covered — invalid user, inactive user, success |
| Pricing strategies | Pending (high priority — pure domain logic, no mocks needed) |
| User use cases | Pending |
| Client use cases | Pending |
| Product use cases | Pending |
| Sales use cases | Pending |
| Payments use cases | Pending |
| DTOs | Pending |

---

## Scripts

```bash
npm run dev             # Start dev server with hot reload
npm run build           # Compile TypeScript → dist/
npm start               # Run compiled production build
npm test                # Run test suite once
npm run test:watch      # Run tests in watch mode
npm run db:migrate      # Apply pending Prisma migrations
npm run db:generate     # Regenerate Prisma client after schema changes
npm run db:studio       # Open Prisma Studio (visual database browser)
npm run db:seed         # Create default admin user
```

---

## Roadmap

| Phase | Module | Status |
|-------|--------|--------|
| 1 | Security baseline (helmet, cors, rate-limit, RBAC, password policy) | ✅ Done |
| 2 | User management (CRUD for admins and sellers) | ✅ Done |
| 3 | Products (catalog, stock control, multi-image upload via Cloudinary) | ✅ Done |
| 4 | Sales (cash + credit, stock deduction, balance update) | ✅ Done |
| 5 | Payments (register payments, update sale status, reduce client balance) | ✅ Done |
| 6 | Audit log (atomic writes on balance changes + read API) | ✅ Done |
| 7 | Pricing Domain Service (Strategy Pattern — differential pricing by sale type) | ✅ Done |
| 8 | Notifications (WhatsApp via Twilio + email via Nodemailer, Domain Events pattern) | ✅ Done |
| 9 | PDF reports (on-demand account statements + auto-attach on payment emails) | ✅ Done |
| 10 | API improvements (pagination, filters, search) | ✅ Done |

---

## Pagination & Filtering

Every `GET /` listing endpoint supports optional pagination and module-specific filters via query string. No change to the URL path — only query parameters differ.

### Response shape (all paginated endpoints)

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

### Pagination parameters (all modules)

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `page` | `1` | — | Page number (1-indexed) |
| `limit` | `20` | `100` | Items per page |

### Filter quick reference

```
GET /api/clients?search=maria&hasDebt=true&page=1&limit=10
GET /api/products?search=camisa&maxStock=5
GET /api/sales?type=CREDIT&status=PENDING&dateFrom=2026-01-01&dateTo=2026-04-30
GET /api/payments?clientId=uuid&dateFrom=2026-04-01
GET /api/audit-logs?action=PAYMENT&userId=uuid&limit=50
```

### Architecture

Filters follow Clean Architecture: `req.query` → `PaginationDto` + `FilterXxxDto` (validation in domain layer) → Use Case → Repository → Prisma datasource (`buildWhere()` translates DTOs to Prisma `where`). `findMany` and `count` run in parallel via `Promise.all` — one database round trip per request.

---

## Pricing System

The system uses a **Pricing Domain Service** with the **Strategy Pattern** to calculate prices at sale time.

### How it works

1. When a sale is created, `CreateSaleUseCase` calls `PricingService.calculate(context)` for each item
2. `PricingService` selects the highest-priority `PricingStrategy` that matches the context
3. The selected strategy computes `basePrice`, `unitPrice`, `surchargeAmount`, and `appliedRule`
4. The use case uses `unitPrice` for totals and credit limit checks
5. All three values are persisted in `SaleItem` for permanent audit traceability

### Active strategies

| Strategy | Rule name | Applies to | Priority |
|----------|-----------|-----------|----------|
| `CashPricingStrategy` | `CASH_BASE` | All `CASH` sales | 10 |
| `CreditPricingStrategy` | `CREDIT_SURCHARGE_{N}PCT` | All `CREDIT` sales | 10 |

### Adding a new pricing rule

Create a class implementing `PricingStrategy`, set `priority >= 20` to override base rules, and register it in `sale.router.ts`:

```typescript
const pricingService = new PricingService([
  new CashPricingStrategy(),
  new CreditPricingStrategy(envs.creditSurchargePercent),
  new WholesaleClientStrategy(), // new — priority 20, overrides base when applicable
]);
```

No other files need to change.

---

## Notification System

After every payment and every credit sale, the system automatically sends a WhatsApp message and an email to the client. Notifications are **decoupled from the financial transaction** using the Domain Events pattern.

### How it works

1. `CreatePaymentUseCase` / `CreateSaleUseCase` execute the atomic DB transaction (payment/sale + balance + audit log)
2. After the transaction commits, the use case emits a domain event via `EventEmitterPort`
3. The corresponding subscriber receives the event asynchronously
4. The subscriber applies a **throttle** (max 3 notifications per client per hour) to prevent accidental message floods
5. WhatsApp and email are sent in parallel via `Promise.allSettled` — one channel can fail without affecting the other
6. Every attempt (success or failure) is persisted to the `NotificationLog` table

The HTTP response is already returned at step 2. Notifications never block the API response and never roll back the transaction.

### Security

| Concern | Implementation |
|---------|---------------|
| **WhatsApp content** | Messages confirm a movement occurred and redirect to email for details — no balance or debt amount exposed (stolen phone scenario) |
| **Email content** | Full detail: amount, new balance, note, date, reference ID |
| **Throttle** | In-memory cap of 3 notifications per client per hour — prevents Twilio charges from runaway loops |
| **NotificationLog** | Every attempt is recorded with channel, event, status (SENT/FAILED), and error message |
| **Graceful degradation** | Missing env vars → server starts normally, feature disabled with a console warning |

### Channels

| Channel | Triggered by | Content |
|---------|-------------|---------|
| WhatsApp | Payment registered | Confirms amount received, redirects to email |
| Email | Payment registered | Amount, new balance, note, date, reference + **PDF account statement attached** |
| WhatsApp | Credit sale created | Confirms sale amount, redirects to email |
| Email | Credit sale created | Total, new balance, date, sale reference |

> **PDF attachment on payment emails:** When a payment is registered, the system automatically generates the client's full account statement as a PDF (in memory) and attaches it to the email. If PDF generation fails, the email is still sent without the attachment — the notification is never blocked by a PDF error.

### Enabling notifications

Set the following in `.env` (see [Environment Variables](#environment-variables) for details):

```env
# WhatsApp (Twilio Sandbox)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Email (Gmail + App Password)
MAILER_EMAIL=youraddress@gmail.com
MAILER_SECRET_KEY=abcd efgh ijkl mnop
MAILER_SERVICE=gmail
```

Both services are independent — you can enable only WhatsApp, only email, or both.

### Checking notification logs

```bash
npm run db:studio   # Open Prisma Studio → NotificationLog table
```

---

## PDF Report System

The PDF report module generates account statements fully in memory using **PDFKit**. The domain layer defines a `PdfService` interface — the presentation and domain layers are completely unaware of PDFKit. If the PDF library needs to change, only `src/infrastructure/services/pdfkit-pdf.service.ts` needs to be rewritten.

### Two ways to get a PDF

**1. On-demand via API (admin panel / staff use)**

```http
GET /api/reports/account-statement/:clientId
Authorization: Bearer <admin-token>
```

The browser or API client receives the PDF as a binary download. No file is ever saved to the server.

**2. Automatic attachment on payment emails (client-facing)**

When `POST /api/payments` registers a payment, the `PaymentNotificationSubscriber` automatically:
1. Generates the account statement PDF for that client (using the same use case as the endpoint)
2. Attaches it to the confirmation email as `estado-cuenta-{clientId}.pdf`
3. If PDF generation fails — the email still sends without attachment

### Architecture

```
GET /api/reports/account-statement/:clientId
  └── ReportController
        └── GenerateAccountStatementUseCase
              ├── ClientRepository.findById()
              ├── SaleRepository.findByClientId()    ─┐ parallel
              ├── PaymentRepository.findByClientId() ─┘
              ├── ProductRepository.findById() ×N    (deduplicated, parallel)
              └── PdfService.generateAccountStatement(data)
                    └── PdfkitPdfService             (only file that knows about PDFKit)
                          └── Buffer → HTTP response / email attachment
```

### Extending the PDF

To add new sections to the PDF, edit only `src/infrastructure/services/pdfkit-pdf.service.ts`. The interface in `src/domain/services/pdf.service.ts` only changes if the data contract changes (e.g. adding a new field to `AccountStatementData`).

